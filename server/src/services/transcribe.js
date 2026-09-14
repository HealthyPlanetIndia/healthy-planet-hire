// Server-side transcription of recorded video answers via Deepgram. Set DEEPGRAM_API_KEY to enable.
// Nova-3 with language=multi handles Hindi-English code-switching (Hinglish); other Indian languages use
// their own code on nova-2. Costs roughly ₹1 to ₹1.5 per minute of audio. The browser transcript is kept
// as a fallback and the two are compared in the recruiter view.
import { db, rowInterview, logEvent } from "../db.js";
import { readClip } from "./clips.js";
import { noDashes } from "../ai.js";

export const transcribeEnabled = () => !!process.env.DEEPGRAM_API_KEY;
const MULTI = new Set(["en", "hi"]);

export async function transcribeBuffer(buf, mime, lang = "en") {
  const q = new URLSearchParams({ smart_format: "true", punctuate: "true", filler_words: "false" });
  if (MULTI.has(lang)) { q.set("model", "nova-3"); q.set("language", "multi"); } else { q.set("model", "nova-2"); q.set("language", lang); }
  const r = await fetch(`https://api.deepgram.com/v1/listen?${q}`, { method: "POST", headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": mime || "video/webm" }, body: buf });
  const d = await r.json(); if (!r.ok) throw new Error(d.err_msg || d.message || "Transcription failed");
  const alt = d.results?.channels?.[0]?.alternatives?.[0];
  return { text: noDashes((alt?.transcript || "").trim()), confidence: alt?.confidence ?? null, languages: d.results?.channels?.[0]?.detected_language || (alt?.languages || []).join(",") };
}

// Transcribes clip `index` of an interview and writes the result into the clip record and, if the
// candidate's answer for that index already exists, into the transcript (keeping what the browser heard).
export async function transcribeClip(interviewId, index) {
  const iv = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=?").get(interviewId)); if (!iv) return null;
  const clip = iv.clips.find((c) => c.index === index); if (!clip) return null;
  const buf = readClip(clip.file);
  const res = await transcribeBuffer(buf, clip.mime, iv.language);
  const clips = iv.clips.map((c) => (c.index === index ? { ...c, transcript: res.text, confidence: res.confidence, languages: res.languages } : c));
  db.prepare("UPDATE interviews SET clips=? WHERE id=?").run(JSON.stringify(clips), iv.id);
  applyToTranscript(iv.id, index, res.text);
  return res;
}

// Replace the browser-heard answer with the server transcript (when we have one and it's substantive)
export function applyToTranscript(interviewId, index, text) {
  if (!text || text.length < 3) return;
  const iv = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=?").get(interviewId));
  let seen = -1; const t = iv.transcript.map((m) => { if (m.role !== "user") return m; seen++; if (seen !== index) return m; return { ...m, content: text, meta: { ...(m.meta || {}), browser_text: m.meta?.browser_text ?? m.content, transcribed: true } }; });
  db.prepare("UPDATE interviews SET transcript=? WHERE id=?").run(JSON.stringify(t), iv.id);
}

// Make sure every clip has a server transcript before a report is written
export async function transcribeAllPending(interviewId) {
  if (!transcribeEnabled()) return 0;
  const iv = rowInterview(db.prepare("SELECT * FROM interviews WHERE id=?").get(interviewId)); let n = 0;
  for (const c of iv.clips) if (c.transcript == null) { try { await transcribeClip(iv.id, c.index); n++; } catch (e) { logEvent(iv.candidate_id, "transcribe_failed", `clip ${c.index}: ${e.message}`); } }
  return n;
}
