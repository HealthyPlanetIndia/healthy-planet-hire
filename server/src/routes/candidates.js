import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db, rowCandidate, rowCandidateFull, rowRole, rowInterview, rowEvaluation, logEvent, audit, STAGES, MANAGER_STAGES, ROUNDS, ensureChecks, offerBlockers, finalApproved, findDuplicates, nextLetterRef, FILES_DIR } from "../db.js";
import { screenResume } from "../ai.js";
import { extractText } from "../services/resume.js";
import { getTemplates, fill, deliver } from "../services/messaging.js";
import { ics, gcalLink } from "../services/ics.js";
import { videoEnabled, createRoom, recordingLink } from "../services/video.js";
import { purgeCandidate } from "../services/retention.js";
import { requireStaff } from "../auth.js";
import { fire } from "../services/rules.js";
import { signClip } from "../services/clips.js";
import { transcribeEnabled, transcribeAllPending, transcribeClip } from "../services/transcribe.js";
import { interviewReport, consolidatedSummary, aiEnabled } from "../ai.js";
import { requireAdmin } from "../auth.js";
import { enqueueScreening, queueStatus, isQueued, screenOne, resetCounters } from "../services/queue.js";
import { userCampuses } from "../db.js";

export const candidates = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 200 } });
const getC = (id) => rowCandidateFull(db.prepare("SELECT * FROM candidates WHERE id = ?").get(id));
const getR = (id) => rowRole(db.prepare("SELECT * FROM roles WHERE id = ?").get(id));
const publicUrl = () => (process.env.PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
const isManager = (req) => req.user.role === "manager";
const token = () => crypto.randomBytes(12).toString("base64url");

// Hiring managers only see candidates from Shortlist onward, for roles assigned to them
function managerScope(req) {
  let sql = "", p = [];
  const camp = userCampuses(req.user);
  if (camp) { sql += ` AND (c.role_id IS NULL OR c.role_id IN (SELECT id FROM roles WHERE campus IN (${camp.map(() => "?").join(",")})) OR c.stage = 'Talent pool')`; p.push(...camp); } // talent pool is shared across campuses
  if (isManager(req)) { sql += ` AND c.role_id IN (SELECT id FROM roles WHERE manager_id = ?) AND c.stage IN (${MANAGER_STAGES.map(() => "?").join(",")})`; p.push(req.user.id, ...MANAGER_STAGES); }
  return { sql, p };
}
function canSee(req, c) { if (!isManager(req)) return true; const r = getR(c.role_id); return r?.manager_id === req.user.id && MANAGER_STAGES.includes(c.stage); }

candidates.get("/", (req, res) => {
  const { role_id, stage, q } = req.query, scope = managerScope(req);
  let sql = "SELECT c.*, r.title AS role_title FROM candidates c LEFT JOIN roles r ON r.id = c.role_id WHERE c.anonymized = 0" + scope.sql, p = [...scope.p];
  if (role_id) { sql += " AND c.role_id = ?"; p.push(role_id); }
  if (stage) { sql += " AND c.stage = ?"; p.push(stage); }
  if (q) { sql += " AND (c.name LIKE ? OR c.resume_text LIKE ? OR c.notes LIKE ? OR r.title LIKE ?)"; p.push(...Array(4).fill(`%${q}%`)); }
  sql += " ORDER BY c.stage_at DESC";
  const risk = db.prepare("SELECT json_extract(integrity,'$.risk') r FROM interviews WHERE candidate_id=? AND integrity IS NOT NULL ORDER BY created_at DESC LIMIT 1");
  const blockers = db.prepare("SELECT COUNT(*) n FROM checks WHERE candidate_id=? AND required=1 AND category IN ('document','safety') AND status NOT IN ('verified','na')");
  res.json(db.prepare(sql).all(...p).map((r) => ({ ...rowCandidate(r), integrity_risk: risk.get(r.id)?.r || null, queued: isQueued(r.id), blockers: r.stage === "School interview" || r.stage === "Demo lesson" ? blockers.get(r.id).n : 0 })));
});
candidates.get("/queue", (req, res) => res.json(queueStatus()));

async function createOne(req, b, file) {
  let resume_text = b.resume_text || "";
  if (file) resume_text = (await extractText(file)).trim();
  if (!b.name?.trim() && resume_text) b.name = (resume_text.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 60 && !/@|\d{5}/.test(l)) || file?.originalname || "Unnamed").replace(/\.(pdf|docx?)$/i, "");
  const dups = findDuplicates(b);
  if (b.source === "Referral" && !b.referrer?.trim()) throw new Error("Referrals must be logged with the referrer's name");
  const r = db.prepare("INSERT INTO candidates (role_id, name, phone, email, source, resume_text, resume_file, owner_id, booking_token, referrer, location, current_employer, expected_salary, notice_period) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(b.role_id || null, b.name.trim(), b.phone || "", b.email || "", b.source || "Job portal", resume_text, file?.originalname || null, req.user.id, token(), b.referrer || "", b.location || "", b.current_employer || "", b.expected_salary || "", b.notice_period || "");
  logEvent(r.lastInsertRowid, "created", `via ${b.source || "Job portal"}${dups.length ? `, possible duplicate of #${dups.map((d) => d.id).join(",")}` : ""}`);
  return { ...getC(r.lastInsertRowid), duplicates: dups };
}

candidates.post("/", requireStaff, upload.single("resume"), async (req, res, next) => {
  try { if (!req.body.name?.trim() && !req.file) return res.status(400).json({ error: "Name or a resume file is required" }); const c = await createOne(req, req.body, req.file); audit(req, `created candidate ${c.name}`); res.status(201).json(c); } catch (e) { next(e); }
});

// Bulk: many resume files at once (name is read from the file), or a CSV with name,phone,email,resume_text
candidates.post("/bulk", requireStaff, upload.array("files"), async (req, res, next) => {
  try {
    const out = { created: 0, duplicates: 0, failed: [] };
    for (const f of req.files || []) {
      try {
        if (f.originalname.toLowerCase().endsWith(".csv")) {
          const [head, ...rows] = f.buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
          const cols = head.split(",").map((h) => h.trim().toLowerCase());
          for (const row of rows) { const vals = row.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((v) => v.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); const o = Object.fromEntries(cols.map((c, i) => [c, vals[i] || ""])); if (!o.name) continue; const c = await createOne(req, { ...o, role_id: req.body.role_id, source: req.body.source || "CSV import" }, null); out.created++; if (c.duplicates.length) out.duplicates++; }
        } else { const c = await createOne(req, { role_id: req.body.role_id, source: req.body.source || "Bulk upload" }, f); out.created++; if (c.duplicates.length) out.duplicates++; }
      } catch (e) { out.failed.push(`${f.originalname}: ${e.message}`); }
    }
    audit(req, `bulk import: ${out.created} created`); res.json(out);
  } catch (e) { next(e); }
});

candidates.get("/:id", (req, res) => {
  const c = getC(req.params.id); if (!c || !canSee(req, c)) return res.status(404).json({ error: "Candidate not found" });
  const role = getR(c.role_id);
  const messages = isManager(req) ? [] : db.prepare("SELECT * FROM messages WHERE candidate_id = ? ORDER BY created_at").all(c.id);
  const events = db.prepare("SELECT * FROM events WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 80").all(c.id);
  const interviews = db.prepare("SELECT * FROM interviews WHERE candidate_id = ? ORDER BY created_at DESC").all(c.id).map(rowInterview).map((i) => ({ ...i, link: `${publicUrl()}/${i.kind === "video" ? "video" : i.kind === "written" ? "written" : "interview"}/${i.token}` }));
  const checks = db.prepare("SELECT * FROM checks WHERE candidate_id = ? ORDER BY CASE category WHEN 'document' THEN 1 WHEN 'safety' THEN 2 ELSE 3 END, id").all(c.id);
  const evaluations = db.prepare("SELECT * FROM evaluations WHERE candidate_id = ? ORDER BY created_at").all(c.id).map(rowEvaluation).map((e) => ({ ...e, link: `${publicUrl()}/score/${e.token}` }));
  const slot = c.interview_at ? db.prepare("SELECT * FROM slots WHERE candidate_id = ? ORDER BY starts_at DESC LIMIT 1").get(c.id) : null;
  if (!c.share_token) { c.share_token = token(); db.prepare("UPDATE candidates SET share_token=? WHERE id=?").run(c.share_token, c.id); }
  res.json({ ...c, role, messages, events, interviews, checks, evaluations, slot, share_link: `${publicUrl()}/report/${c.share_token}`, booking_link: `${publicUrl()}/book/${c.booking_token}`, duplicates: findDuplicates(c, c.id), offer_blockers: c.stage === "School interview" || c.stage === "Demo lesson" ? offerBlockers(c.id) : [] });
});

candidates.put("/:id", upload.single("resume"), async (req, res, next) => {
  try {
    const cur = getC(req.params.id); if (!cur || !canSee(req, cur)) return res.status(404).json({ error: "Candidate not found" });
    if (isManager(req) && Object.keys(req.body).some((k) => k !== "notes")) return res.status(403).json({ error: "Hiring managers can only add notes" });
    const b = { ...cur, ...req.body };
    if (req.file) { b.resume_text = (await extractText(req.file)).trim(); b.resume_file = req.file.originalname; }
    if (b.stage !== cur.stage) {
      if (!STAGES.includes(b.stage)) return res.status(400).json({ error: "Unknown stage" });
      if (["HR discussion", "Offer", "Joined"].includes(b.stage) && !finalApproved(cur.id) && !(req.body.override && req.user.role === "admin")) return res.status(409).json({ error: "Final Review: the Director's approval is required before the HR discussion and offer", blockers: ["Director approval at Final review"] });
      if (b.stage === "Offer" || b.stage === "Joined") {
        const blockers = offerBlockers(cur.id);
        if (blockers.length && !(req.body.override && req.user.role === "admin") && !(b.stage === "Offer" && req.body.conditional)) return res.status(409).json({ error: "Complete the verification checks before making an offer, or mark the offer as conditional on verification", blockers });
        if (blockers.length) logEvent(cur.id, b.stage === "Offer" && req.body.conditional ? "conditional_offer" : "override", b.stage === "Offer" && req.body.conditional ? `offer conditional on: ${blockers.join("; ")}` : `admin ${req.user.name} moved to ${b.stage} with ${blockers.length} checks pending`);
      }
      if (b.stage === "Joined") { try { await notifyOnboarding(cur.id); } catch {} }
      if (["Screening call", "Shortlist", ...ROUNDS, "Written assessment", "Final review"].includes(b.stage)) ensureChecks(cur.id);
      b.stage_at = new Date().toISOString(); logEvent(cur.id, "stage", `${cur.stage} → ${b.stage}`);
    }
    if (String(b.role_id) !== String(cur.role_id)) b.screening = null;
    db.prepare("UPDATE candidates SET role_id=?, name=?, phone=?, email=?, source=?, resume_text=?, resume_file=?, notes=?, stage=?, stage_at=?, screening=?, owner_id=?, join_date=?, salary=?, referrer=?, location=?, current_employer=?, expected_salary=?, notice_period=? WHERE id=?")
      .run(b.role_id || null, b.name, b.phone, b.email, b.source, b.resume_text, b.resume_file, b.notes, b.stage, b.stage_at, b.screening ? JSON.stringify(b.screening) : null, b.owner_id, b.join_date || null, b.salary || "", b.referrer || "", b.location || "", b.current_employer || "", b.expected_salary || "", b.notice_period || "", cur.id);
    audit(req, `updated candidate ${cur.id}${b.stage !== cur.stage ? ` → ${b.stage}` : ""}`);
    if (req.body.needs_human === 0 || req.body.needs_human === "0") db.prepare("UPDATE candidates SET needs_human=0 WHERE id=?").run(cur.id);
    let automation = []; if (b.stage !== cur.stage) automation = await fire("stage_change", cur.id, {});
    res.json({ ...getC(cur.id), automation });
  } catch (e) { next(e); }
});

candidates.delete("/:id", requireStaff, (req, res) => { db.prepare("DELETE FROM candidates WHERE id = ?").run(req.params.id); audit(req, `deleted candidate ${req.params.id}`); res.json({ ok: true }); });
// Full erasure on request (DPDP): files, messages, interviews, photos, everything
candidates.delete("/:id/purge", requireStaff, (req, res) => { const ok = purgeCandidate(req.params.id); audit(req, `purged candidate ${req.params.id}`); res.json({ ok }); });
// Export everything held about a person (for a data access request)
candidates.get("/:id/export", requireStaff, (req, res) => {
  const c = getC(req.params.id); if (!c) return res.status(404).json({ error: "Not found" });
  const grab = (t) => db.prepare(`SELECT * FROM ${t} WHERE candidate_id = ?`).all(c.id);
  res.setHeader("Content-Disposition", `attachment; filename="${c.name.replace(/\W+/g, "_")}_data.json"`);
  res.json({ candidate: c, messages: grab("messages"), interviews: grab("interviews").map(rowInterview).map((i) => ({ ...i, snapshots: `${i.snapshots.length} photos (not exported)` })), checks: grab("checks"), evaluations: grab("evaluations"), events: grab("events") });
});

candidates.post("/:id/screen", requireStaff, async (req, res, next) => {
  try {
    const c = getC(req.params.id), role = c && getR(c.role_id);
    if (!c) return res.status(404).json({ error: "Candidate not found" });
    if (!role) return res.status(400).json({ error: "Assign a role before screening" });
    if (!c.resume_text?.trim()) return res.status(400).json({ error: "Add resume text or upload a file first" });
    await screenOne(c.id); res.json(getC(c.id));
  } catch (e) { next(e); }
});
// Queues everything unscreened; returns immediately. Poll GET /candidates/queue for progress.
candidates.post("/screen-all", requireStaff, (req, res) => {
  const ids = db.prepare("SELECT id FROM candidates WHERE stage = 'Applied' AND screening IS NULL AND resume_text <> '' AND role_id IS NOT NULL" + (req.body.role_id ? " AND role_id = ?" : "")).all(...(req.body.role_id ? [req.body.role_id] : [])).map((r) => r.id);
  resetCounters(); res.json({ queued: ids.length, ...enqueueScreening(ids) });
});

// AI interview link (text) or video room
candidates.post("/:id/interviews", requireStaff, async (req, res, next) => {
  try {
    const c = getC(req.params.id), role = c && getR(c.role_id);
    if (req.body.kind !== "written" && !role?.questions?.length) return res.status(400).json({ error: "Add interview questions to the role first" });
    const kind = req.body.kind === "video" ? "video" : req.body.kind === "written" ? "written" : "text";
    if (kind === "video" && !videoEnabled()) return res.status(400).json({ error: "Video interviews need DAILY_API_KEY in server/.env" });
    const tok = token(), days = +(req.body.valid_days || 5), expires = new Date(Date.now() + days * 86400000);
    let room = null; if (kind === "video") room = await createRoom(`hph-${tok}`, expires);
    db.prepare("INSERT INTO interviews (candidate_id, token, language, expires_at, proctor, kind, room_url, room_name, mode) VALUES (?,?,?,?,?,?,?,?,?)").run(c.id, tok, req.body.language || "en", expires.toISOString(), req.body.proctor === false ? 0 : 1, kind, room?.url || null, room?.name || null, req.body.mode === "text" ? "text" : "video");
    if (kind !== "written" && (c.stage === "Applied" || c.stage === "Screened")) db.prepare("UPDATE candidates SET stage='AI interview', stage_at=datetime('now') WHERE id=?").run(c.id);
    if (kind === "written" && c.stage !== "Written assessment" && STAGES.indexOf(c.stage) < STAGES.indexOf("Written assessment")) db.prepare("UPDATE candidates SET stage='Written assessment', stage_at=datetime('now') WHERE id=?").run(c.id);
    logEvent(c.id, "interview_link", `${kind} ${tok}`);
    const link = `${publicUrl()}/${kind === "video" ? "video" : kind === "written" ? "written" : "interview"}/${tok}`;
    let delivery = null;
    if (req.body.send) {
      const body = fill(getTemplates()[kind === "written" ? "Written assessment" : "AI interview"], c, role, { link, deadline: expires.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }) });
      delivery = await deliver(c, req.body.send, body, `Your interview for ${role.title}`);
    }
    res.status(201).json({ token: tok, link, kind, expires_at: expires.toISOString(), delivery });
  } catch (e) { next(e); }
});

// Signed links (30 min) to the recorded video answers; issuing them is audited
candidates.get("/:id/interviews/:ivId/clips", (req, res) => {
  const c = getC(req.params.id); if (!c || !canSee(req, c)) return res.status(404).json({ error: "Not found" });
  const iv = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=? AND candidate_id=?").get(req.params.ivId, c.id)); if (!iv) return res.status(404).json({ error: "Not found" });
  const questions = iv.transcript.filter((m) => m.role === "assistant").map((m) => m.content);
  audit(req, `opened video answers of candidate ${c.id}`); logEvent(c.id, "clips_viewed", req.user.name);
  const answers = iv.transcript.filter((m) => m.role === "user");
  res.json({ transcribe: transcribeEnabled(), retakes: iv.retakes, clips: iv.clips.map((k) => ({ index: k.index, superseded: !!k.superseded, retake: iv.retakes.some((r) => r.index === k.index), seconds: k.seconds, question: questions[k.index % 1000] || "", answer: k.superseded ? (iv.retakes.find((r) => r.index === k.index - 1000)?.previous || "") : answers[k.index]?.content || "", browser_text: answers[k.index]?.meta?.browser_text || null, candidate_note: answers[k.index]?.meta?.candidate_note || null, confidence: k.confidence ?? null, languages: k.languages || null, url: `${publicUrl()}/api/public/clip/${signClip(iv.id, k.index)}` })) });
});
// Recruiter watched the clips and disagrees with a transcript or verdict: add a note and rewrite the report with it
candidates.post("/:id/interviews/:ivId/rereport", requireStaff, async (req, res, next) => {
  try {
    const c = getC(req.params.id), iv = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=? AND candidate_id=?").get(req.params.ivId, c.id)); if (!iv) return res.status(404).json({ error: "Not found" });
    let transcript = iv.transcript;
    if (iv.status !== "completed") return res.status(400).json({ error: "The interview is not complete yet" });
    if (req.body.note) { transcript = [...transcript, { role: "user", content: `(Recruiter ${req.user.name} watched the recording and notes: ${req.body.note})`, meta: { recruiter_note: true } }]; logEvent(c.id, "recruiter_note", req.body.note.slice(0, 80)); }
    if (!iv.report) { try { const { transcribeAllPending } = await import("../services/transcribe.js"); await transcribeAllPending(iv.id); transcript = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=?").get(iv.id)).transcript; } catch {} }
    const rep = await interviewReport(getR(c.role_id), c, transcript, { confidence: Object.fromEntries(iv.clips.map((k) => [k.index, k.confidence])) });
    db.prepare("UPDATE interviews SET report=? WHERE id=?").run(JSON.stringify(rep), iv.id); audit(req, `report rewritten for ${c.id}`);
    if (!iv.integrity) { const { ruleBasedFlags, combine } = await import("../services/integrity.js"); const fresh = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=?").get(iv.id)); db.prepare("UPDATE interviews SET integrity=? WHERE id=?").run(JSON.stringify(combine(ruleBasedFlags(fresh), null)), iv.id); }
    if (c.stage === "AI interview") db.prepare("UPDATE candidates SET stage='Screening call', stage_at=datetime('now') WHERE id=?").run(c.id);
    res.json({ ok: true, report: rep });
  } catch (e) { next(e); }
});

// Re-run server transcription on every clip and rewrite the report from the improved text
candidates.post("/:id/interviews/:ivId/retranscribe", requireStaff, async (req, res, next) => {
  try {
    if (!transcribeEnabled()) return res.status(400).json({ error: "Set DEEPGRAM_API_KEY to enable server transcription" });
    const c = getC(req.params.id), iv = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=? AND candidate_id=?").get(req.params.ivId, c.id)); if (!iv) return res.status(404).json({ error: "Not found" });
    for (const k of iv.clips) await transcribeClip(iv.id, k.index);
    const fresh = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=?").get(iv.id));
    if (fresh.status === "completed") { const rep = await interviewReport(getR(c.role_id), c, fresh.transcript, { confidence: Object.fromEntries(fresh.clips.map((k) => [k.index, k.confidence])) }); db.prepare("UPDATE interviews SET report=? WHERE id=?").run(JSON.stringify(rep), iv.id); }
    logEvent(c.id, "retranscribed", `${iv.clips.length} clips`); audit(req, `retranscribed interview ${iv.id}`);
    res.json({ ok: true, clips: iv.clips.length });
  } catch (e) { next(e); }
});

// Short-lived viewing link for a video recording; every view is audited
candidates.get("/:id/interviews/:ivId/recording", async (req, res, next) => {
  try {
    const c = getC(req.params.id); if (!c || !canSee(req, c)) return res.status(404).json({ error: "Not found" });
    const iv = db.prepare("SELECT * FROM interviews WHERE id=? AND candidate_id=?").get(req.params.ivId, c.id);
    if (!iv?.recording_id) return res.status(404).json({ error: "No recording yet" });
    const url = await recordingLink(iv.recording_id, 900);
    audit(req, `viewed recording of candidate ${c.id}`); logEvent(c.id, "recording_viewed", req.user.name);
    res.json({ url, expires_in_minutes: 15 });
  } catch (e) { next(e); }
});

// Step 3.2 Screening call (HR, 10 to 15 minutes, after the AI interview)
candidates.put("/:id/screening-call", requireStaff, async (req, res) => {
  const c = getC(req.params.id); if (!c) return res.status(404).json({ error: "Not found" });
  const sc = { ...(c.screening_call || {}), ...req.body, by: req.user.name, at: new Date().toISOString() };
  db.prepare("UPDATE candidates SET screening_call=?, location=COALESCE(?, location), expected_salary=COALESCE(?, expected_salary), notice_period=COALESCE(?, notice_period), current_employer=COALESCE(?, current_employer) WHERE id=?").run(JSON.stringify(sc), req.body.location ?? null, req.body.expected_salary ?? null, req.body.notice_period ?? null, req.body.current_employer ?? null, c.id);
  logEvent(c.id, "screening_call", `${sc.outcome || "noted"}${sc.notes ? `: ${sc.notes.slice(0, 80)}` : ""}`); audit(req, `screening call ${c.id}: ${sc.outcome}`);
  const before = STAGES.indexOf(c.stage), target = STAGES.indexOf("Shortlist");
  if (sc.outcome === "proceed" && before < target) { db.prepare("UPDATE candidates SET stage='Shortlist', stage_at=datetime('now') WHERE id=?").run(c.id); logEvent(c.id, "stage", `${c.stage} → Shortlist (screening call)`); ensureChecks(c.id); }
  if (sc.outcome === "decline" && before <= target) { db.prepare("UPDATE candidates SET stage='Not now', stage_at=datetime('now') WHERE id=?").run(c.id); logEvent(c.id, "stage", `${c.stage} → Not now (screening call)`); }
  if (sc.outcome === "hold" && c.stage !== "Screening call" && before < target) db.prepare("UPDATE candidates SET stage='Screening call', stage_at=datetime('now') WHERE id=?").run(c.id);
  await fire("stage_change", c.id, {});
  res.json(getC(c.id));
});

// Round 5 Final Review: everything consolidated for the Director
candidates.get("/:id/consolidated", async (req, res, next) => {
  try {
    const c = getC(req.params.id); if (!c || !canSee(req, c)) return res.status(404).json({ error: "Not found" });
    const role = getR(c.role_id);
    const ivs = db.prepare("SELECT * FROM interviews WHERE candidate_id=? ORDER BY created_at").all(c.id).map(rowInterview);
    const ai = ivs.filter((i) => i.kind !== "written" && i.report).pop(), written = ivs.filter((i) => i.kind === "written").pop();
    const evals = db.prepare("SELECT * FROM evaluations WHERE candidate_id=? AND submitted_at IS NOT NULL").all(c.id).map(rowEvaluation);
    const rounds = ROUNDS.map((r) => { const e = evals.filter((x) => x.stage === r); const avg = e.length ? e.reduce((a, x) => a + Object.values(x.scores).reduce((p, q) => p + +q, 0) / Object.keys(x.scores).length, 0) / e.length : null; return { round: r, panelists: e.length, avg: avg ? +avg.toFixed(1) : null, recommendations: e.map((x) => `${x.panelist}: ${x.recommendation}`), comments: e.map((x) => x.comment).filter(Boolean) }; });
    const checks = db.prepare("SELECT label, status FROM checks WHERE candidate_id=? AND category IN ('document','safety') AND required=1").all(c.id);
    const material = [`Resume screening: ${c.screening ? `${c.screening.overall}/100, ${c.screening.recommendation}. ${c.screening.summary}` : "not done"}`, `AI interview: ${ai ? `${ai.report.overall}/100, ${ai.report.recommendation}. ${ai.report.summary} Integrity: ${ai.integrity?.risk || "n/a"}` : "not done"}`, `Screening call: ${c.screening_call ? `${c.screening_call.outcome}. ${c.screening_call.notes || ""}` : "not done"}`, ...rounds.map((r) => `${r.round}: ${r.avg ? `${r.avg}/5 from ${r.panelists} panelist(s). ${r.recommendations.join("; ")}. ${r.comments.join(" | ")}` : "not scored"}`), `Written assessment: ${written?.report ? `${written.report.overall}/100, ${written.report.recommendation}. ${written.report.summary}` : written ? "submitted, not graded" : "not done"}`, `Verification: ${checks.filter((k) => ["verified", "na"].includes(k.status)).length}/${checks.length} required checks complete`].join("\n");
    let summary = null; if (req.query.summary === "1" && aiEnabled()) { try { summary = await consolidatedSummary(role, c, material); } catch {} }
    res.json({ screening: c.screening, ai: ai ? { overall: ai.report.overall, recommendation: ai.report.recommendation, summary: ai.report.summary, integrity: ai.integrity?.risk } : null, screening_call: c.screening_call, rounds, written: written ? { status: written.status, report: written.report } : null, checks, material, summary, final_review: c.final_review });
  } catch (e) { next(e); }
});
candidates.post("/:id/final-review", requireAdmin, (req, res) => {
  const c = getC(req.params.id); if (!c) return res.status(404).json({ error: "Not found" });
  const decision = ["approved", "rejected", "hold"].includes(req.body.decision) ? req.body.decision : "hold";
  const fr = { decision, note: req.body.note || "", by: req.user.name, at: new Date().toISOString() };
  db.prepare("UPDATE candidates SET final_review=? WHERE id=?").run(JSON.stringify(fr), c.id);
  if (decision === "approved" && c.stage === "Final review") db.prepare("UPDATE candidates SET stage='HR discussion', stage_at=datetime('now') WHERE id=?").run(c.id);
  if (decision === "rejected" && c.stage === "Final review") db.prepare("UPDATE candidates SET stage='Not now', stage_at=datetime('now') WHERE id=?").run(c.id);
  logEvent(c.id, "final_review", `${decision} by ${req.user.name}${fr.note ? `: ${fr.note.slice(0, 80)}` : ""}`); audit(req, `final review ${c.id}: ${decision}`);
  res.json(getC(c.id));
});

// Round 6 HR discussion: compensation, joining timeline, policy clarifications
candidates.put("/:id/hr-discussion", requireStaff, (req, res) => {
  const c = getC(req.params.id); if (!c) return res.status(404).json({ error: "Not found" });
  const hd = { ...(c.hr_discussion || {}), ...req.body, by: req.user.name, at: new Date().toISOString() };
  db.prepare("UPDATE candidates SET hr_discussion=?, salary=COALESCE(?, salary), join_date=COALESCE(?, join_date) WHERE id=?").run(JSON.stringify(hd), req.body.agreed_salary ?? null, req.body.join_date ?? null, c.id);
  logEvent(c.id, "hr_discussion", hd.agreed_salary ? `agreed ${hd.agreed_salary}, joining ${hd.join_date || "tbd"}` : "noted");
  res.json(getC(c.id));
});

// Letter management: drafts get a reference number, the Executive Head approves, issuance is logged
candidates.get("/:id/letters", requireStaff, (req, res) => res.json(db.prepare("SELECT l.*, u1.name created_by_name, u2.name approved_by_name FROM letters l LEFT JOIN users u1 ON u1.id=l.created_by LEFT JOIN users u2 ON u2.id=l.approved_by WHERE candidate_id=? ORDER BY id DESC").all(req.params.id)));
candidates.post("/:id/letters", requireStaff, (req, res) => {
  const c = getC(req.params.id), role = getR(c.role_id), t = getTemplates();
  const type = req.body.type === "appointment" ? "appointment" : "offer";
  const body = req.body.body || fill(t[type === "appointment" ? "appointment_letter" : "offer_letter"], c, role, { salary: c.salary || "{salary}", join_date: c.join_date ? new Date(c.join_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "{join_date}", campus: role?.campus || "Noida", date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), department: role?.department || "", reporting_manager: role?.reporting_manager || "{reporting_manager}", ref_no: "{ref_no}" });
  const ref = nextLetterRef(type);
  const r = db.prepare("INSERT INTO letters (candidate_id, type, ref_no, body, created_by) VALUES (?,?,?,?,?)").run(c.id, type, ref, body.replace("{ref_no}", ref), req.user.id);
  logEvent(c.id, "letter_drafted", `${type} ${ref}`); audit(req, `drafted ${type} letter ${ref}`);
  res.status(201).json(db.prepare("SELECT * FROM letters WHERE id=?").get(r.lastInsertRowid));
});
candidates.put("/:id/letters/:lid", requireStaff, (req, res) => {
  const l = db.prepare("SELECT * FROM letters WHERE id=? AND candidate_id=?").get(req.params.lid, req.params.id); if (!l) return res.status(404).json({ error: "Not found" });
  if (l.status !== "draft") return res.status(400).json({ error: "Approved letters cannot be edited; draft a new one" });
  db.prepare("UPDATE letters SET body=? WHERE id=?").run(req.body.body, l.id); res.json(db.prepare("SELECT * FROM letters WHERE id=?").get(l.id));
});
candidates.post("/:id/letters/:lid/approve", requireAdmin, (req, res) => {
  const l = db.prepare("SELECT * FROM letters WHERE id=? AND candidate_id=?").get(req.params.lid, req.params.id); if (!l) return res.status(404).json({ error: "Not found" });
  db.prepare("UPDATE letters SET status='approved', approved_by=?, approved_at=datetime('now') WHERE id=?").run(req.user.id, l.id);
  logEvent(req.params.id, "letter_approved", `${l.type} ${l.ref_no} by ${req.user.name}`); audit(req, `approved letter ${l.ref_no}`);
  res.json(db.prepare("SELECT * FROM letters WHERE id=?").get(l.id));
});
candidates.post("/:id/letters/:lid/issue", requireStaff, async (req, res, next) => {
  try {
    const c = getC(req.params.id), role = getR(c.role_id), l = db.prepare("SELECT * FROM letters WHERE id=? AND candidate_id=?").get(req.params.lid, c.id);
    if (!l) return res.status(404).json({ error: "Not found" }); if (l.status !== "approved") return res.status(400).json({ error: "The letter must be approved by the Executive Head before it is issued" });
    let delivery = { status: "manual" };
    if (req.body.via === "email") delivery = await deliver(c, "email", `${l.body}\n\nReference: ${l.ref_no}`, `${l.type === "appointment" ? "Appointment letter" : "Offer of employment"}: ${role?.title} at Healthy Planet School (${l.ref_no})`);
    db.prepare("UPDATE letters SET status='issued', issued_at=datetime('now'), issued_via=? WHERE id=?").run(req.body.via || "printed", l.id);
    if (l.type === "offer") db.prepare("UPDATE candidates SET offer_sent_at=datetime('now') WHERE id=?").run(c.id);
    logEvent(c.id, "letter_issued", `${l.type} ${l.ref_no} via ${req.body.via || "print"}`); audit(req, `issued letter ${l.ref_no}`);
    res.json({ ...db.prepare("SELECT * FROM letters WHERE id=?").get(l.id), delivery });
  } catch (e) { next(e); }
});

// Pre-boarding: tell IT/Admin what to prepare (ONBOARDING_NOTIFY_EMAIL), and log it on the checklist
async function notifyOnboarding(candidate_id) {
  const c = getC(candidate_id), role = getR(c.role_id); ensureChecks(c.id);
  const to = process.env.ONBOARDING_NOTIFY_EMAIL; if (!to) return;
  const { sendEmail, mailEnabled } = await import("../services/email.js"); if (!mailEnabled()) return;
  await sendEmail(to, `New joiner: ${c.name}, ${role?.title} (${role?.campus}) on ${c.join_date || "date tbc"}`, `Please prepare before Day 1:\n- Workstation\n- Email ID\n- Biometric / attendance access\n- ID card\n\nName: ${c.name}\nRole: ${role?.title}\nDepartment: ${role?.department}\nCampus: ${role?.campus}\nReporting manager: ${role?.reporting_manager || "see HR"}\nJoining date: ${c.join_date || "to be confirmed"}\n\nTick "IT/Admin notified" on the candidate's checklist once done.`);
  db.prepare("UPDATE checks SET status='received', notes='Notification email sent to ' || ? , updated_at=datetime('now') WHERE candidate_id=? AND key='it_notified' AND status='pending'").run(to, c.id);
  logEvent(c.id, "onboarding_notified", to);
}

// Documents and checks
candidates.get("/:id/checks", (req, res) => { ensureChecks(req.params.id); res.json(db.prepare("SELECT * FROM checks WHERE candidate_id=? ORDER BY id").all(req.params.id)); });
candidates.put("/:id/checks/:key", requireStaff, upload.single("file"), (req, res) => {
  ensureChecks(req.params.id);
  const cur = db.prepare("SELECT * FROM checks WHERE candidate_id=? AND key=?").get(req.params.id, req.params.key); if (!cur) return res.status(404).json({ error: "Unknown check" });
  let file = cur.file;
  if (req.file) { file = `${req.params.id}_${req.params.key}_${Date.now()}${path.extname(req.file.originalname)}`; fs.writeFileSync(path.join(FILES_DIR, file), req.file.buffer); }
  const status = req.body.status || (req.file && cur.status === "pending" ? "received" : cur.status);
  db.prepare("UPDATE checks SET status=?, notes=?, file=?, updated_by=?, updated_at=datetime('now') WHERE id=?").run(status, req.body.notes ?? cur.notes, file, req.user.id, cur.id);
  logEvent(req.params.id, "check", `${cur.label}: ${status}`); audit(req, `check ${cur.key}=${status} for ${req.params.id}`);
  res.json(db.prepare("SELECT * FROM checks WHERE id=?").get(cur.id));
});
candidates.post("/:id/checks", requireStaff, (req, res) => {
  const { label, category = "document", required = 1 } = req.body; if (!label) return res.status(400).json({ error: "Label required" });
  db.prepare("INSERT INTO checks (candidate_id, key, label, category, required) VALUES (?,?,?,?,?)").run(req.params.id, "custom_" + token(), label, category, required ? 1 : 0);
  res.json(db.prepare("SELECT * FROM checks WHERE candidate_id=? ORDER BY id").all(req.params.id));
});
candidates.get("/:id/checks/:key/file", (req, res) => {
  const c = db.prepare("SELECT file FROM checks WHERE candidate_id=? AND key=?").get(req.params.id, req.params.key);
  if (!c?.file) return res.status(404).json({ error: "No file" }); res.sendFile(path.join(FILES_DIR, c.file));
});

// Panel scoring links (demo lesson or school interview). Panelists don't need an account.
candidates.post("/:id/evaluations", (req, res) => {
  const c = getC(req.params.id); if (!c || !canSee(req, c)) return res.status(404).json({ error: "Not found" });
  const stage = ROUNDS.includes(req.body.stage) ? req.body.stage : ROUNDS.includes(c.stage) ? c.stage : "Leadership interview";
  const tok = token();
  db.prepare("INSERT INTO evaluations (candidate_id, token, panelist, stage) VALUES (?,?,?,?)").run(c.id, tok, req.body.panelist || req.user.name, stage);
  res.status(201).json({ token: tok, link: `${publicUrl()}/score/${tok}` });
});

// Scheduling: candidate self-books from open slots for their role
candidates.post("/:id/booking-invite", requireStaff, async (req, res, next) => {
  try {
    const c = getC(req.params.id), role = getR(c.role_id);
    const open = db.prepare("SELECT COUNT(*) n FROM slots WHERE role_id=? AND candidate_id IS NULL AND starts_at > datetime('now')").get(c.role_id).n;
    if (!open) return res.status(400).json({ error: "No open slots for this role. Add some under Roles → Slots first." });
    const link = `${publicUrl()}/book/${c.booking_token}`;
    const body = fill(getTemplates().Shortlist, c, role, { slots: `Pick a time here: ${link}` });
    res.json(await deliver(c, req.body.channel || "whatsapp", body, `Interview at Healthy Planet School`));
  } catch (e) { next(e); }
});
candidates.get("/:id/calendar.ics", (req, res) => {
  const c = getC(req.params.id), role = getR(c.role_id), slot = db.prepare("SELECT * FROM slots WHERE candidate_id=? ORDER BY starts_at DESC LIMIT 1").get(c.id);
  if (!slot) return res.status(404).json({ error: "No booking" });
  res.setHeader("Content-Type", "text/calendar"); res.setHeader("Content-Disposition", `attachment; filename="interview-${c.id}.ics"`);
  res.send(ics({ title: `${slot.stage}: ${c.name} for ${role?.title}`, starts_at: slot.starts_at, ends_at: slot.ends_at, location: slot.location, description: `${publicUrl()}/pipeline`, uid: `slot-${slot.id}` }));
});
candidates.get("/:id/calendar-link", (req, res) => {
  const c = getC(req.params.id), role = getR(c.role_id), slot = db.prepare("SELECT * FROM slots WHERE candidate_id=? ORDER BY starts_at DESC LIMIT 1").get(c.id);
  if (!slot) return res.status(404).json({ error: "No booking" });
  res.json({ google: gcalLink({ title: `${slot.stage}: ${c.name} for ${role?.title}`, starts_at: slot.starts_at, ends_at: slot.ends_at, location: slot.location }) });
});

// Offer letter from template
candidates.get("/:id/offer-letter", requireStaff, (req, res) => {
  const c = getC(req.params.id), role = getR(c.role_id), t = getTemplates();
  const body = fill(t.offer_letter, c, role, { salary: c.salary || "{salary}", join_date: c.join_date ? new Date(c.join_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "{join_date}", campus: role?.campus || "Noida", date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), department: role?.department || "" });
  res.json({ body });
});
candidates.post("/:id/offer-letter/send", requireStaff, async (req, res, next) => {
  try { const c = getC(req.params.id), role = getR(c.role_id); const r = await deliver(c, "email", req.body.body, `Offer of employment: ${role?.title} at Healthy Planet School`); db.prepare("UPDATE candidates SET offer_sent_at=datetime('now') WHERE id=?").run(c.id); logEvent(c.id, "offer_sent", ""); res.json(r); } catch (e) { next(e); }
});

candidates.get("/:id/message-draft", requireStaff, (req, res) => {
  const c = getC(req.params.id), role = getR(c.role_id), t = getTemplates();
  const key = req.query.key || c.stage;
  const latest = db.prepare("SELECT token, kind FROM interviews WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1").get(c.id);
  const slot = db.prepare("SELECT * FROM slots WHERE candidate_id=? ORDER BY starts_at DESC LIMIT 1").get(c.id);
  const when = slot ? new Date(slot.starts_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  res.json({ body: fill(t[key] || t.followup, c, role, { link: latest ? `${publicUrl()}/${latest.kind === "video" ? "video" : "interview"}/${latest.token}` : "{link}", slots: req.query.slots || when || `Pick a time here: ${publicUrl()}/book/${c.booking_token}`, deadline: req.query.deadline || "{deadline}" }) });
});
candidates.post("/:id/share/rotate", requireStaff, (req, res) => { const tk = token(); db.prepare("UPDATE candidates SET share_token=? WHERE id=?").run(tk, req.params.id); audit(req, `rotated share link ${req.params.id}`); res.json({ share_link: `${publicUrl()}/report/${tk}` }); });
candidates.post("/:id/messages", requireStaff, async (req, res, next) => {
  try { const c = getC(req.params.id), role = getR(c.role_id); const { channel, body } = req.body; if (!body?.trim()) return res.status(400).json({ error: "Message is empty" }); res.json(await deliver(c, channel, body, `${role?.title || "Your application"} at Healthy Planet School`)); } catch (e) { next(e); }
});
