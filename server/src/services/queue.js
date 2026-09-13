// In-process job queue for screening at volume. Three CVs at a time; progress visible in the UI.
import { db, rowCandidate, rowRole, logEvent } from "../db.js";
import { screenResume } from "../ai.js";
import { fire } from "./rules.js";

const pending = [], active = new Set(); let done = 0, failed = 0, running = false;
export const queueStatus = () => ({ pending: pending.length, active: active.size, done, failed });
export const isQueued = (id) => pending.includes(id) || active.has(id);

export function enqueueScreening(ids) { for (const id of ids) if (!isQueued(id)) pending.push(id); tick(); return queueStatus(); }
export function resetCounters() { done = 0; failed = 0; }

export async function screenOne(id) {
  const c = rowCandidate(db.prepare("SELECT * FROM candidates WHERE id=?").get(id)); if (!c?.resume_text?.trim() || !c.role_id) throw new Error("nothing to screen");
  const role = rowRole(db.prepare("SELECT * FROM roles WHERE id=?").get(c.role_id));
  const s = await screenResume(role, c);
  const stage = c.stage === "Applied" ? "Screened" : c.stage;
  db.prepare("UPDATE candidates SET screening=?, stage=?, stage_at=CASE WHEN stage<>? THEN datetime('now') ELSE stage_at END WHERE id=?").run(JSON.stringify(s), stage, stage, c.id);
  logEvent(c.id, "screened", `score ${s.overall}, ${s.recommendation}`);
  await fire("screened", c.id, { score: s.overall });
  if (stage !== c.stage) await fire("stage_change", c.id, {});
  return s;
}
async function tick() {
  if (running) return; running = true;
  while (pending.length) {
    while (active.size < 3 && pending.length) {
      const id = pending.shift(); active.add(id);
      screenOne(id).then(() => done++).catch(() => failed++).finally(() => { active.delete(id); });
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  running = false;
}
