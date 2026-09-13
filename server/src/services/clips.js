// Video answers recorded in the candidate's browser, stored encrypted (AES-256-GCM) on the server's disk.
// Only signed-in staff can watch, through short-lived signed URLs; files are deleted with retention or erasure.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FILES_DIR, DATA_DIR, db, logEvent } from "../db.js";

const CLIP_DIR = path.join(FILES_DIR, "clips"); fs.mkdirSync(CLIP_DIR, { recursive: true });
let KEY = null;
function key() {
  if (KEY) return KEY;
  const f = path.join(DATA_DIR, ".mediakey");
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  return (KEY = Buffer.from(fs.readFileSync(f, "utf8").trim(), "hex"));
}
export const MAX_CLIP_BYTES = 40 * 1024 * 1024;

export function saveClip(token, index, buf, meta = {}) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(buf), c.final()]), tag = c.getAuthTag();
  const file = `${token}_${index}.enc`;
  fs.writeFileSync(path.join(CLIP_DIR, file), Buffer.concat([iv, tag, enc]));
  const row = db.prepare("SELECT id, clips, candidate_id FROM interviews WHERE token=?").get(token);
  const clips = JSON.parse(row.clips || "[]").filter((c) => c.index !== index);
  clips.push({ index, file, bytes: buf.length, seconds: meta.seconds || null, mime: meta.mime || "video/webm", at: Date.now() });
  clips.sort((a, b) => a.index - b.index);
  db.prepare("UPDATE interviews SET clips=? WHERE id=?").run(JSON.stringify(clips), row.id);
  return clips;
}
export function readClip(file) {
  const raw = fs.readFileSync(path.join(CLIP_DIR, path.basename(file)));
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), enc = raw.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]);
}
export function deleteClips(interviewIds) {
  if (!interviewIds.length) return 0; let n = 0;
  for (const id of interviewIds) {
    const row = db.prepare("SELECT clips FROM interviews WHERE id=?").get(id); if (!row) continue;
    for (const c of JSON.parse(row.clips || "[]")) { try { fs.unlinkSync(path.join(CLIP_DIR, path.basename(c.file))); n++; } catch {} }
    db.prepare("UPDATE interviews SET clips='[]' WHERE id=?").run(id);
  }
  return n;
}
// Signed, expiring URL so a <video> tag can play a clip without a header
export function signClip(ivId, index, minutes = 30) {
  const exp = Date.now() + minutes * 60000, data = `${ivId}.${index}.${exp}`;
  return `${data}.${crypto.createHmac("sha256", key()).update(data).digest("base64url")}`;
}
export function verifyClipToken(t) {
  const [ivId, index, exp, sig] = (t || "").split("."); if (!sig || +exp < Date.now()) return null;
  const good = crypto.createHmac("sha256", key()).update(`${ivId}.${index}.${exp}`).digest("base64url");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? { ivId: +ivId, index: +index } : null;
}
export function clipsDiskUsage() { let b = 0; for (const f of fs.readdirSync(CLIP_DIR)) b += fs.statSync(path.join(CLIP_DIR, f)).size; return b; }
