import cron from "node-cron";
import { db, rowCandidate, rowRole, ACTIVE_STAGES, logEvent } from "../db.js";
import { waEnabled } from "./whatsapp.js";
import { getTemplates, fill, deliver } from "./messaging.js";

// Follow-up sequence: step 1 after FOLLOWUP_DAYS quiet days, step 2 after 2x, step 3 after 3x, then stop.
// Stops as soon as the candidate replies or moves stage. Only runs when WhatsApp API is configured.
export async function runFollowups() {
  if (!waEnabled()) return { sent: 0, reason: "WhatsApp API not configured; use the Follow-ups screen to nudge manually" };
  const days = +(process.env.FOLLOWUP_DAYS || 3), t = getTemplates();
  const list = db.prepare(`SELECT * FROM candidates WHERE phone <> '' AND stage IN (${ACTIVE_STAGES.map(() => "?").join(",")}) AND stage <> 'Joined'
    AND julianday('now') - julianday(COALESCE(last_reply_at, stage_at)) >= ?
    AND (last_contact_at IS NULL OR last_contact_at < stage_at OR julianday('now') - julianday(last_contact_at) >= ?)`).all(...ACTIVE_STAGES, days, days);
  let sent = 0;
  for (const raw of list) {
    const c = rowCandidate(raw), role = rowRole(db.prepare("SELECT * FROM roles WHERE id = ?").get(c.role_id));
    const step = db.prepare("SELECT COUNT(*) n FROM events WHERE candidate_id=? AND type='auto_followup' AND created_at >= ?").get(c.id, c.stage_at).n;
    if (step >= 3) continue;
    const quiet = (Date.now() - new Date((c.last_reply_at || c.stage_at) + "Z").getTime()) / 86400000;
    if (quiet < days * (step + 1)) continue;
    const pending = c.stage === "AI interview" && db.prepare("SELECT token, kind FROM interviews WHERE candidate_id=? AND status<>'completed' ORDER BY created_at DESC LIMIT 1").get(c.id);
    const key = ["followup", "followup_2", "followup_3"][step];
    const body = pending && step === 0 ? fill(t.interview_reminder, c, role, { link: `${process.env.PUBLIC_URL}/${pending.kind === "video" ? "video" : "interview"}/${pending.token}` }) : fill(t[key], c, role);
    try { await deliver(c, "whatsapp", body); logEvent(c.id, "auto_followup", `${c.stage} step ${step + 1}`); sent++; } catch (e) { logEvent(c.id, "auto_followup_failed", e.message); }
  }
  return { sent };
}
export function scheduleFollowups() { cron.schedule("0 10 * * *", () => runFollowups().catch(console.error), { timezone: "Asia/Kolkata" }); }
