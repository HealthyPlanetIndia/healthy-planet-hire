import { Router } from "express";
import { VERSION } from "../version.js";
import express from "express";
import { saveClip, MAX_CLIP_BYTES, readClip, verifyClipToken } from "../services/clips.js";
import { transcribeEnabled, transcribeClip, transcribeAllPending } from "../services/transcribe.js";
import { ttsEnabled, speak } from "../services/tts.js";
import { db, rowInterview, rowCandidate, rowRole, rowEvaluation, logEvent } from "../db.js";
import { getTemplates, fill, deliver } from "../services/messaging.js";
import { transcriptText } from "../services/video.js";
import { interviewTurn, interviewReport, analyseAnswers, aiEnabled, gradeWriting } from "../ai.js";
import { fire } from "../services/rules.js";
import { LANGUAGES } from "../db.js";
import { ruleBasedFlags, combine } from "../services/integrity.js";

export const pub = Router();
const load = (token) => {
  const i = rowInterview(db.prepare("SELECT * FROM interviews WHERE token = ?").get(token));
  if (!i) return null;
  const c = rowCandidate(db.prepare("SELECT * FROM candidates WHERE id = ?").get(i.candidate_id));
  return { i, c, r: rowRole(db.prepare("SELECT * FROM roles WHERE id = ?").get(c.role_id)) };
};

pub.get("/interview/:token", (req, res) => {
  const x = load(req.params.token); if (!x) return res.status(404).json({ error: "This interview link is not valid" });
  const expired = new Date(x.i.expires_at) < new Date() && x.i.status !== "completed";
  res.json({ candidate: x.c.name.split(" ")[0], role: x.r.title, status: expired ? "expired" : x.i.status, language: x.i.language, languages: Object.fromEntries(Object.entries(LANGUAGES).filter(([k]) => x.r.languages.includes(k))), mode: x.i.mode || "video", tts: ttsEnabled(), retake_used: x.i.retakes.length > 0, thinking_seconds: 3, candidate_email: !!x.c.email, allow_text: process.env.ALLOW_TEXT_INTERVIEWS === "true", interactive: x.r.interview_mode === "interactive" && !!x.r.scenario, total: x.r.questions.length + (x.r.interview_mode === "interactive" && x.r.scenario ? 4 : 0), proctor: !!x.i.proctor, transcript: x.i.transcript.filter((m) => m.role !== "user" || !m.content.startsWith("(")).map(({ role, content }) => ({ role, content })) });
});

pub.post("/interview/:token/start", async (req, res, next) => {
  try {
    const x = load(req.params.token); if (!x) return res.status(404).json({ error: "Invalid link" });
    if (x.i.status === "completed") return res.status(400).json({ error: "This interview is already complete" });
    if (new Date(x.i.expires_at) < new Date()) return res.status(400).json({ error: "This link has expired. Please ask the school for a new one." });
    if (x.i.transcript.length) return res.json({ transcript: x.i.transcript });
    if (req.body.language) x.i.language = req.body.language;
    const t = await interviewTurn(x.r, x.c, x.i.language, []);
    const transcript = [{ role: "assistant", content: t.content, at: Date.now() }];
    db.prepare("UPDATE interviews SET status='in_progress', language=?, transcript=?, started_at=datetime('now') WHERE id=?").run(x.i.language, JSON.stringify(transcript), x.i.id);
    logEvent(x.c.id, "interview_started", "");
    res.json({ transcript });
  } catch (e) { next(e); }
});

pub.post("/interview/:token/answer", async (req, res, next) => {
  try {
    const x = load(req.params.token); if (!x) return res.status(404).json({ error: "Invalid link" });
    if (x.i.status === "completed") return res.status(400).json({ error: "Already complete" });
    const answer = (req.body.answer || "").trim(); if (!answer) return res.status(400).json({ error: "Please type an answer" });
    const askedAt = x.i.transcript[x.i.transcript.length - 1]?.at || Date.now();
    const idx = x.i.transcript.filter((m) => m.role === "user").length;
    const served = x.i.clips.find((c) => c.index === idx)?.transcript;
    const content = served && served.length > 2 ? served : answer;
    const isRetake = x.i.retakes.some((r) => r.index === idx);
    const transcript = [...x.i.transcript, { role: "user", content, at: Date.now(), meta: { seconds: Math.max(1, Math.round((Date.now() - askedAt) / 1000)), ...(served ? { browser_text: answer, transcribed: true } : {}), ...(isRetake ? { retake: true } : {}) } }];
    const t = await interviewTurn(x.r, x.c, x.i.language, transcript.map(({ role, content }) => ({ role, content })));
    transcript.push({ role: "assistant", content: t.content, at: Date.now() });
    db.prepare("UPDATE interviews SET transcript=? WHERE id=?").run(JSON.stringify(transcript), x.i.id);
    if (t.ended) {
      db.prepare("UPDATE interviews SET status='completed', completed_at=datetime('now') WHERE id=?").run(x.i.id);
      logEvent(x.c.id, "interview_completed", "");
      // Generate the report in the background so the candidate isn't kept waiting
      finishInterview(x, transcript).catch((e) => logEvent(x.c.id, "interview_report_failed", e.message));
    }
    res.json({ transcript, ended: t.ended });
  } catch (e) { next(e); }
});

async function finishInterview(x, transcript) {
  // Give in-flight transcriptions a moment, then fill any gaps, so the report reads the best text we have
  if (transcribeEnabled()) { await new Promise((r) => setTimeout(r, 4000)); await transcribeAllPending(x.i.id); transcript = load(x.i.token).i.transcript; }
  const fresh0 = load(x.i.token).i;
  const confidence = fresh0.clips.map((k) => k.confidence);
  const rep = await interviewReport(x.r, x.c, transcript, { confidence: Object.fromEntries(fresh0.clips.map((k) => [k.index, k.confidence])) });
  const fresh = load(x.i.token).i; // pick up signals that arrived during the interview
  let ai = null; try { ai = await analyseAnswers(x.r, x.c, transcript); } catch {}
  const integrity = combine(ruleBasedFlags({ ...fresh, transcript }), ai);
  db.prepare("UPDATE interviews SET report=?, integrity=? WHERE id=?").run(JSON.stringify(rep), JSON.stringify(integrity), x.i.id);
  db.prepare("UPDATE candidates SET stage='Shortlist', stage_at=datetime('now') WHERE id=? AND stage='AI interview'").run(x.c.id);
  logEvent(x.c.id, "interview_report", `score ${rep.overall}: ${rep.recommendation}`);
  if (integrity.risk !== "clear" && integrity.risk !== "low") logEvent(x.c.id, "integrity_alert", `${integrity.risk} risk: ${integrity.reasons.map((r) => r.text).join("; ")}`);
  await fire("interview_report", x.c.id, { score: rep.overall, risk: integrity.risk });
}

// Recorded video answer for question `index` (raw webm/mp4 body). Stored encrypted; transcript text comes separately via /answer.
pub.post("/interview/:token/clip/:index", express.raw({ type: () => true, limit: MAX_CLIP_BYTES }), (req, res) => {
  const x = load(req.params.token); if (!x) return res.status(404).json({ error: "Invalid link" });
  if (x.i.status === "completed" && Date.now() - new Date(x.i.completed_at + "Z").getTime() > 600000) return res.status(400).json({ error: "Interview closed" });
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000) { logEvent(x.c.id, "clip_rejected", `answer ${+req.params.index + 1}: ${Buffer.isBuffer(req.body) ? req.body.length + " bytes" : "no body"}, type ${req.headers["content-type"]}`); return res.status(400).json({ error: "Empty recording" }); }
  const mime = String(req.headers["content-type"] || "video/webm").split(";")[0].trim();
  const clips = saveClip(x.i.token, +req.params.index, req.body, { seconds: +req.query.seconds || null, mime: /^video\//.test(mime) ? mime : "video/webm" });
  res.json({ ok: true, clips: clips.length });
  // Transcribe in the background; the browser's own transcript is used until this lands
  if (transcribeEnabled()) transcribeClip(x.i.id, +req.params.index).catch((e) => logEvent(x.c.id, "transcribe_failed", `clip ${req.params.index}: ${e.message}`));
});
// Maya's voice for a line of the interview (falls back to the browser voice when the service is not configured)
pub.post("/interview/:token/speak", async (req, res) => {
  const x = load(req.params.token); if (!x) return res.status(404).end();
  if (!ttsEnabled()) return res.status(204).end();
  const line = String(req.body.text || "").slice(0, 1200); if (!line) return res.status(400).end();
  try { const buf = await speak(line, x.i.language); res.setHeader("Content-Type", "audio/mpeg"); res.setHeader("Cache-Control", "private, max-age=3600"); res.send(buf); } catch (e) { res.status(502).json({ error: e.message }); }
});

// One re-take per interview: rolls the transcript back to before the last answer, keeps the first recording, and labels the second
pub.post("/interview/:token/retake", (req, res) => {
  const x = load(req.params.token); if (!x) return res.status(404).json({ error: "Invalid link" });
  if (x.i.status === "completed") return res.status(400).json({ error: "The interview is complete" });
  if (x.i.retakes.length) return res.status(400).json({ error: "You have already used your one re-take" });
  const lastUser = x.i.transcript.map((m) => m.role).lastIndexOf("user"); if (lastUser < 0) return res.status(400).json({ error: "Nothing to re-take yet" });
  const idx = x.i.transcript.slice(0, lastUser + 1).filter((m) => m.role === "user").length - 1;
  const prev = x.i.transcript[lastUser];
  const transcript = x.i.transcript.slice(0, lastUser);
  const clips = x.i.clips.map((k) => (k.index === idx ? { ...k, index: 1000 + idx, superseded: true } : k)); // keep the first recording, out of the way
  db.prepare("UPDATE interviews SET transcript=?, clips=?, retakes=? WHERE id=?").run(JSON.stringify(transcript), JSON.stringify(clips), JSON.stringify([{ index: idx, previous: prev.content, at: Date.now() }]), x.i.id);
  logEvent(x.c.id, "retake", `answer ${idx + 1}`);
  res.json({ transcript: transcript.map(({ role, content }) => ({ role, content })), index: idx });
});
// Send the candidate their own link by email so they can open it on a laptop
pub.post("/interview/:token/email-link", async (req, res) => {
  const x = load(req.params.token); if (!x || !x.c.email) return res.status(400).json({ error: "No email on file" });
  try { await deliver(x.c, "email", `Hello ${x.c.name.split(" ")[0]},\n\nHere is your interview link for ${x.r.title} at Healthy Planet School, to open on a laptop or desktop:\n${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/interview/${x.i.token}\n\nBefore you begin: a quiet, well-lit room; 20 uninterrupted minutes; camera at eye level.`, `Your interview link: ${x.r.title}`); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); }
});

// The candidate can see how their last answer was transcribed (server version once it lands, phone version until then)
pub.get("/interview/:token/transcript/:index", (req, res) => {
  const x = load(req.params.token); if (!x) return res.status(404).json({ error: "Invalid link" });
  const idx = +req.params.index, clip = x.i.clips.find((c) => c.index === idx), ans = x.i.transcript.filter((m) => m.role === "user")[idx];
  const serverText = clip?.transcript; const ready = !transcribeEnabled() || !clip || serverText != null;
  res.json({ ready, source: serverText != null ? "server" : "phone", text: serverText != null && serverText.length > 2 ? serverText : ans?.content || "", note: ans?.meta?.candidate_note || null, confidence: clip?.confidence ?? null });
});
// If the transcript misheard them, the candidate can add a short note. It never replaces the transcript;
// recruiters see both, and the video is the record.
pub.post("/interview/:token/transcript/:index/note", (req, res) => {
  const x = load(req.params.token); if (!x) return res.status(404).json({ error: "Invalid link" });
  if (x.i.status === "completed" && Date.now() - new Date(x.i.completed_at + "Z").getTime() > 900000) return res.status(400).json({ error: "Interview closed" });
  const idx = +req.params.index, note = String(req.body.note || "").trim().slice(0, 600); if (!note) return res.status(400).json({ error: "Empty note" });
  let seen = -1; const t = x.i.transcript.map((m) => { if (m.role !== "user") return m; seen++; return seen === idx ? { ...m, meta: { ...(m.meta || {}), candidate_note: note } } : m; });
  db.prepare("UPDATE interviews SET transcript=? WHERE id=?").run(JSON.stringify(t), x.i.id);
  logEvent(x.c.id, "transcript_note", `Q${idx + 1}: ${note.slice(0, 80)}`);
  res.json({ ok: true });
});

// Streams a clip to a staff member holding a signed token (issued by the authenticated API)
pub.get("/clip/:t", (req, res) => {
  const v = verifyClipToken(req.params.t); if (!v) return res.status(403).send("Link expired");
  const iv = db.prepare("SELECT clips FROM interviews WHERE id=?").get(v.ivId); const c = iv && JSON.parse(iv.clips || "[]").find((k) => k.index === v.index);
  if (!c) return res.status(404).send("No clip");
  const buf = readClip(c.file); res.setHeader("Content-Type", c.mime || "video/webm"); res.setHeader("Cache-Control", "private, no-store"); res.send(buf);
});

// Behaviour signals from the candidate's browser: hidden, blur, paste, copy, faces, camera_denied
pub.post("/interview/:token/signal", (req, res) => {
  const x = load(req.params.token); if (!x || x.i.status === "completed") return res.json({ ok: true });
  const { type, detail = "" } = req.body || {};
  if (!["hidden", "blur", "paste", "copy", "faces", "camera_denied", "camera_ok", "clip_failed", "resumed", "dark", "audio_low"].includes(type)) return res.status(400).json({ error: "Unknown signal" });
  const signals = [...x.i.signals, { type, detail: String(detail).slice(0, 400), at: Date.now() }].slice(-300);
  db.prepare("UPDATE interviews SET signals=? WHERE id=?").run(JSON.stringify(signals), x.i.id);
  res.json({ ok: true });
});

// Small webcam frames (JPEG data URL, downscaled in the browser). Kept to 8 per interview.
pub.post("/interview/:token/snapshot", (req, res) => {
  const x = load(req.params.token); if (!x || x.i.status === "completed") return res.json({ ok: true });
  const img = req.body?.image || "";
  if (!img.startsWith("data:image/jpeg;base64,") || img.length > 120000) return res.status(400).json({ error: "Bad image" });
  const snaps = [...x.i.snapshots, { image: img, at: Date.now() }].slice(-8);
  db.prepare("UPDATE interviews SET snapshots=? WHERE id=?").run(JSON.stringify(snaps), x.i.id);
  res.json({ ok: true });
});

// Records which device/browser opened the link
pub.post("/interview/:token/session", (req, res) => {
  const x = load(req.params.token); if (!x) return res.json({ ok: true });
  const id = String(req.body?.id || "").slice(0, 64); if (!id) return res.json({ ok: true });
  if (!x.i.sessions.includes(id)) db.prepare("UPDATE interviews SET sessions=? WHERE id=?").run(JSON.stringify([...x.i.sessions, id]), x.i.id);
  res.json({ ok: true });
});

// Video interview page data
pub.get("/video/:token", (req, res) => {
  const x = load(req.params.token); if (!x || x.i.kind !== "video") return res.status(404).json({ error: "This interview link is not valid" });
  const expired = new Date(x.i.expires_at) < new Date() && x.i.status !== "completed";
  if (x.i.status === "pending") db.prepare("UPDATE interviews SET status='in_progress', started_at=datetime('now') WHERE id=?").run(x.i.id);
  res.json({ candidate: x.c.name.split(" ")[0], role: x.r.title, status: expired ? "expired" : x.i.status, room_url: expired ? null : x.i.room_url, questions: x.r.questions });
});
pub.post("/video/:token/done", (req, res) => {
  const x = load(req.params.token); if (!x) return res.json({ ok: true });
  db.prepare("UPDATE interviews SET status='completed', completed_at=datetime('now') WHERE id=? AND status<>'completed'").run(x.i.id);
  logEvent(x.c.id, "interview_completed", "video; waiting for recording and transcript"); res.json({ ok: true });
});

// Round 4: written English assessment, done by the candidate on their own device with a timer
pub.get("/written/:token", (req, res) => {
  const x = load(req.params.token); if (!x || x.i.kind !== "written") return res.status(404).json({ error: "This link is not valid" });
  const expired = new Date(x.i.expires_at) < new Date() && x.i.status !== "completed";
  res.json({ candidate: x.c.name.split(" ")[0], role: x.r.title, status: expired ? "expired" : x.i.status, prompt: x.r.written_prompt, minutes: 30, started_at: x.i.started_at, text: x.i.transcript.find((m) => m.role === "user")?.content || "" });
});
pub.post("/written/:token/start", (req, res) => {
  const x = load(req.params.token); if (!x || x.i.kind !== "written") return res.status(404).json({ error: "Invalid link" });
  if (x.i.status === "pending") db.prepare("UPDATE interviews SET status='in_progress', started_at=datetime('now'), transcript=? WHERE id=?").run(JSON.stringify([{ role: "assistant", content: x.r.written_prompt, at: Date.now() }]), x.i.id);
  res.json({ ok: true, started_at: new Date().toISOString() });
});
pub.post("/written/:token/submit", async (req, res, next) => {
  try {
    const x = load(req.params.token); if (!x || x.i.kind !== "written") return res.status(404).json({ error: "Invalid link" });
    if (x.i.status === "completed") return res.status(400).json({ error: "Already submitted" });
    const essay = String(req.body.text || "").trim(); if (essay.length < 40) return res.status(400).json({ error: "Please write a little more before submitting" });
    const startedAt = x.i.started_at ? new Date(x.i.started_at + "Z").getTime() : Date.now();
    const transcript = [{ role: "assistant", content: x.r.written_prompt }, { role: "user", content: essay, at: Date.now(), meta: { seconds: Math.round((Date.now() - startedAt) / 1000) } }];
    db.prepare("UPDATE interviews SET status='completed', completed_at=datetime('now'), transcript=? WHERE id=?").run(JSON.stringify(transcript), x.i.id);
    logEvent(x.c.id, "written_submitted", `${essay.split(/\s+/).length} words`);
    res.json({ ok: true });
    if (aiEnabled()) { try { const rep = await gradeWriting(x.r, x.c, x.r.written_prompt, essay); const fresh = load(x.i.token).i; const integ = combine(ruleBasedFlags({ ...fresh, transcript }), null); db.prepare("UPDATE interviews SET report=?, integrity=? WHERE id=?").run(JSON.stringify(rep), JSON.stringify(integ), x.i.id); logEvent(x.c.id, "written_graded", `${rep.overall}: ${rep.recommendation}`); } catch (e) { logEvent(x.c.id, "written_grade_failed", e.message); } }
  } catch (e) { next(e); }
});

// Panel scoring form (demo lesson / school interview), no login needed
pub.get("/score/:token", (req, res) => {
  const e = rowEvaluation(db.prepare("SELECT * FROM evaluations WHERE token=?").get(req.params.token)); if (!e) return res.status(404).json({ error: "This scoring link is not valid" });
  const c = db.prepare("SELECT name, role_id FROM candidates WHERE id=?").get(e.candidate_id), r = rowRole(db.prepare("SELECT * FROM roles WHERE id=?").get(c.role_id));
  res.json({ candidate: c.name, role: r.title, stage: e.stage, panelist: e.panelist, rubric: r.rubrics[e.stage] || r.rubric, submitted: !!e.submitted_at, scores: e.scores, comment: e.comment, recommendation: e.recommendation });
});
pub.post("/score/:token", (req, res) => {
  const e = db.prepare("SELECT * FROM evaluations WHERE token=?").get(req.params.token); if (!e) return res.status(404).json({ error: "Invalid link" });
  const { scores, comment = "", recommendation = "", panelist } = req.body;
  if (!scores || !Object.keys(scores).length) return res.status(400).json({ error: "Give a score for each item" });
  db.prepare("UPDATE evaluations SET scores=?, comment=?, recommendation=?, panelist=COALESCE(?, panelist), submitted_at=datetime('now') WHERE id=?").run(JSON.stringify(scores), comment, recommendation, panelist || null, e.id);
  const avg = Object.values(scores).reduce((a, b) => a + +b, 0) / Object.keys(scores).length;
  logEvent(e.candidate_id, "evaluation", `${e.stage} scored ${avg.toFixed(1)}/5 by ${panelist || e.panelist}: ${recommendation}`);
  res.json({ ok: true });
});

// Self-booking: candidate picks an open slot for their role
pub.get("/book/:token", (req, res) => {
  const c = db.prepare("SELECT * FROM candidates WHERE booking_token=?").get(req.params.token); if (!c) return res.status(404).json({ error: "This booking link is not valid" });
  const r = db.prepare("SELECT title, campus FROM roles WHERE id=?").get(c.role_id);
  const mine = db.prepare("SELECT * FROM slots WHERE candidate_id=? ORDER BY starts_at DESC LIMIT 1").get(c.id);
  const open = db.prepare("SELECT id, starts_at, ends_at, location, stage FROM slots WHERE role_id=? AND candidate_id IS NULL AND starts_at > datetime('now') ORDER BY starts_at").all(c.role_id);
  res.json({ candidate: c.name.split(" ")[0], role: r?.title, booked: mine, open });
});
pub.post("/book/:token", async (req, res, next) => {
  try {
    const c = rowCandidate(db.prepare("SELECT * FROM candidates WHERE booking_token=?").get(req.params.token)); if (!c) return res.status(404).json({ error: "Invalid link" });
    const slot = db.prepare("SELECT * FROM slots WHERE id=? AND role_id=? AND candidate_id IS NULL").get(req.body.slot_id, c.role_id);
    if (!slot) return res.status(409).json({ error: "That time has just been taken. Please pick another." });
    db.prepare("UPDATE slots SET candidate_id=NULL WHERE candidate_id=?").run(c.id); // release any earlier booking
    db.prepare("UPDATE slots SET candidate_id=?, booked_at=datetime('now') WHERE id=?").run(c.id, slot.id);
    db.prepare("UPDATE candidates SET interview_at=?, stage=CASE WHEN stage IN ('Shortlist','AI interview','Screened') THEN ? ELSE stage END, stage_at=CASE WHEN stage IN ('Shortlist','AI interview','Screened') THEN datetime('now') ELSE stage_at END WHERE id=?").run(slot.starts_at, slot.stage, c.id);
    logEvent(c.id, "booked", `${slot.stage} on ${slot.starts_at}`);
    await fire("booked", c.id, {});
    const role = rowRole(db.prepare("SELECT * FROM roles WHERE id=?").get(c.role_id));
    const when = new Date(slot.starts_at).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    try { if (c.phone || c.email) await deliver(c, c.phone ? "whatsapp" : "email", fill(getTemplates()["School interview"], c, role, { slots: `${when} at ${slot.location}` })); } catch {}
    res.json({ ok: true, slot });
  } catch (e) { next(e); }
});

// Shareable candidate report for hiring managers, board members or external panelists (no login; rotate the link to revoke)
pub.get("/report/:token", (req, res) => {
  const c = rowCandidate(db.prepare("SELECT * FROM candidates WHERE share_token=? AND anonymized=0").get(req.params.token)); if (!c) return res.status(404).json({ error: "This report link is not valid" });
  const r = rowRole(db.prepare("SELECT * FROM roles WHERE id=?").get(c.role_id));
  const iv = db.prepare("SELECT * FROM interviews WHERE candidate_id=? AND report IS NOT NULL ORDER BY created_at DESC LIMIT 1").get(c.id);
  const evals = db.prepare("SELECT panelist, stage, scores, comment, recommendation FROM evaluations WHERE candidate_id=? AND submitted_at IS NOT NULL").all(c.id).map(rowEvaluation);
  res.json({ name: c.name, role: r?.title, campus: r?.campus, stage: c.stage, criteria: r?.criteria || [], rubric: r?.rubric || [], rubrics: r?.rubrics || {}, screening: c.screening, interview: iv ? { report: JSON.parse(iv.report), integrity: iv.integrity ? JSON.parse(iv.integrity).risk : null, kind: iv.kind } : null, evaluations: evals, resume_excerpt: (c.resume_text || "").slice(0, 1500) });
});

// Daily.co webhooks: recording ready, transcript ready
pub.post("/webhooks/daily", async (req, res) => {
  res.sendStatus(200);
  try {
    const ev = req.body || {}, room = ev.payload?.room_name || ev.payload?.room; if (!room) return;
    const iv = rowInterview(db.prepare("SELECT * FROM interviews WHERE room_name=?").get(room)); if (!iv) return;
    if (ev.type === "recording.ready-to-download") { db.prepare("UPDATE interviews SET recording_id=?, recording_url=NULL, status='completed', completed_at=COALESCE(completed_at, datetime('now')) WHERE id=?").run(ev.payload.recording_id, iv.id); logEvent(iv.candidate_id, "recording_ready", ""); }
    if (ev.type === "transcript.ready-to-download" && ev.payload.transcript_id) {
      db.prepare("UPDATE interviews SET transcript_id=? WHERE id=?").run(ev.payload.transcript_id, iv.id);
      const text = await transcriptText(ev.payload.transcript_id);
      const transcript = text.split("\n").filter(Boolean).map((line) => ({ role: /^(maya|interviewer|panel)/i.test(line) ? "assistant" : "user", content: line }));
      const c = rowCandidate(db.prepare("SELECT * FROM candidates WHERE id=?").get(iv.candidate_id)), r = rowRole(db.prepare("SELECT * FROM roles WHERE id=?").get(c.role_id));
      db.prepare("UPDATE interviews SET transcript=? WHERE id=?").run(JSON.stringify(transcript), iv.id);
      const rep = await interviewReport(r, c, transcript);
      db.prepare("UPDATE interviews SET report=? WHERE id=?").run(JSON.stringify(rep), iv.id);
      logEvent(c.id, "interview_report", `video: score ${rep.overall}`);
    }
  } catch (e) { console.error("daily webhook", e.message); }
});

// Indeed/Google-for-Jobs compatible XML feed of open roles
pub.get("/jobs.xml", (req, res) => {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, ""), esc = (s) => `<![CDATA[${s || ""}]]>`;
  const rows = db.prepare("SELECT * FROM roles WHERE status='open' AND (ijp_until IS NULL OR ijp_until < date('now'))").all().map(rowRole);
  res.type("application/xml").send(`<?xml version="1.0" encoding="utf-8"?><source><publisher>Healthy Planet School</publisher><publisherurl>${base}</publisherurl>${rows.map((r) => `<job><title>${esc(r.title)}</title><date>${esc(r.created_at)}</date><referencenumber>${r.id}</referencenumber><url>${esc(`${base}/apply/${r.id}`)}</url><company>Healthy Planet School</company><city>${esc(r.campus)}</city><state>Uttar Pradesh</state><country>IN</country><description>${esc(r.description || r.criteria.map((c) => c.text).join(". "))}</description><jobtype>fulltime</jobtype>${r.salary_band ? `<salary>${esc(r.salary_band)}</salary>` : ""}</job>`).join("")}</source>`);
});

pub.get("/version", (req, res) => res.json({ version: VERSION, features: ["video-clips", "report-v2", "briefing-checklist", "retake", "thinking-time"] }));

// Careers-page form can post straight here
pub.post("/apply", (req, res) => {
  const { role_id, name, phone, email, resume_text, location = "", current_employer = "", expected_salary = "", notice_period = "", referrer = "", internal = false } = req.body;
  if (!name || !role_id) return res.status(400).json({ error: "Name and role are required" });
  const source = internal ? "Internal (IJP)" : referrer ? "Referral" : "Careers page";
  const r = db.prepare("INSERT INTO candidates (role_id, name, phone, email, source, resume_text, booking_token, location, current_employer, expected_salary, notice_period, referrer) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(role_id, name, phone || "", email || "", source, resume_text || "", Math.random().toString(36).slice(2) + Date.now().toString(36), location, current_employer, expected_salary, notice_period, referrer);
  logEvent(r.lastInsertRowid, "created", "via careers page");
  res.status(201).json({ ok: true });
});
pub.get("/roles", (req, res) => res.json(db.prepare("SELECT id, title, department, campus, description, salary_band, grade, subject FROM roles WHERE status = 'open' AND (ijp_until IS NULL OR ijp_until < date('now'))").all()));
