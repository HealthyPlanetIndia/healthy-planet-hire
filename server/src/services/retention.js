import cron from "node-cron";
import fs from "fs";
import path from "path";
import { db, FILES_DIR, DATA_DIR, logEvent } from "../db.js";
import { videoEnabled, deleteRecording, deleteTranscript, deleteRoom } from "./video.js";

// Data protection housekeeping (DPDP Act 2023): keep only what is needed, for as long as needed.
//  - camera snapshots deleted after SNAPSHOT_DAYS (default 90)
//  - candidates in "Not now" with no activity for RETENTION_MONTHS (default 12) are anonymized
//  - nightly SQLite backup, keeping BACKUP_KEEP (default 14) copies
// Remove video recordings and transcripts held at Daily for these interviews (best effort, logged)
export async function deleteRemoteMedia(interviews) {
  if (!videoEnabled()) return;
  for (const iv of interviews) {
    try { if (iv.recording_id) await deleteRecording(iv.recording_id); if (iv.transcript_id) await deleteTranscript(iv.transcript_id); if (iv.room_name) await deleteRoom(iv.room_name); }
    catch (e) { console.error("media delete", iv.id, e.message); }
  }
  const ids = interviews.map((i) => i.id); if (ids.length) db.prepare(`UPDATE interviews SET recording_id=NULL, transcript_id=NULL, recording_url=NULL WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids);
}
export function purgeCandidate(id) {
  const c = db.prepare("SELECT * FROM candidates WHERE id=?").get(id); if (!c) return false;
  deleteRemoteMedia(db.prepare("SELECT id, recording_id, transcript_id, room_name FROM interviews WHERE candidate_id=?").all(id)).catch(() => {});
  for (const f of db.prepare("SELECT file FROM checks WHERE candidate_id=? AND file IS NOT NULL").all(id)) try { fs.unlinkSync(path.join(FILES_DIR, f.file)); } catch {}
  db.prepare("DELETE FROM candidates WHERE id=?").run(id); // cascades to interviews, messages, checks, evaluations, events
  return true;
}
export function anonymizeCandidate(id) {
  deleteRemoteMedia(db.prepare("SELECT id, recording_id, transcript_id, room_name FROM interviews WHERE candidate_id=?").all(id)).catch(() => {});
  db.prepare("UPDATE candidates SET name='Former applicant', phone='', email='', resume_text='', resume_file=NULL, notes='', screening=NULL, salary='', anonymized=1 WHERE id=?").run(id);
  db.prepare("DELETE FROM messages WHERE candidate_id=?").run(id);
  db.prepare("UPDATE interviews SET transcript='[]', snapshots='[]', signals='[]', report=NULL, integrity=NULL, recording_url=NULL WHERE candidate_id=?").run(id);
  for (const f of db.prepare("SELECT file FROM checks WHERE candidate_id=? AND file IS NOT NULL").all(id)) try { fs.unlinkSync(path.join(FILES_DIR, f.file)); } catch {}
  db.prepare("DELETE FROM checks WHERE candidate_id=?").run(id);
  logEvent(id, "anonymized", "retention policy");
}
export function runRetention() {
  const snapDays = +(process.env.SNAPSHOT_DAYS || 90), months = +(process.env.RETENTION_MONTHS || 12);
  const snaps = db.prepare("UPDATE interviews SET snapshots='[]' WHERE snapshots <> '[]' AND created_at < datetime('now', ?)").run(`-${snapDays} days`).changes;
  // Video recordings follow the same clock as camera photos: gone after SNAPSHOT_DAYS (default 90). The written report stays.
  const oldVideo = db.prepare("SELECT id, recording_id, transcript_id, room_name FROM interviews WHERE (recording_id IS NOT NULL OR transcript_id IS NOT NULL) AND created_at < datetime('now', ?)").all(`-${snapDays} days`);
  deleteRemoteMedia(oldVideo).catch(() => {});
  const old = db.prepare("SELECT id FROM candidates WHERE anonymized=0 AND stage='Not now' AND stage_at < datetime('now', ?)").all(`-${months} months`);
  for (const r of old) anonymizeCandidate(r.id);
  return { snapshotsCleared: snaps, recordingsDeleted: oldVideo.length, anonymized: old.length };
}
export function backup() {
  const dir = path.join(DATA_DIR, "backups"); fs.mkdirSync(dir, { recursive: true });
  const name = `hph-${new Date().toISOString().slice(0, 10)}.db`;
  db.backup(path.join(dir, name)).then(() => {
    const keep = +(process.env.BACKUP_KEEP || 14);
    fs.readdirSync(dir).filter((f) => f.startsWith("hph-")).sort().slice(0, -keep).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  }).catch(console.error);
  return name;
}
export function scheduleHousekeeping() {
  cron.schedule("30 2 * * *", () => { try { runRetention(); backup(); } catch (e) { console.error(e); } }, { timezone: "Asia/Kolkata" });
}
