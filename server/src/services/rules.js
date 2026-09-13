// Automation rules: "when X happens and Y is true, do Z". Edited in Settings → Automation.
// Triggers: stage_change, screened, interview_report, booked, reply
// Conditions: { stage, min_score, max_score, risk: ["high", ...], role_id }
// Actions: { type: "send_message", channel, template } | { type: "send_interview", kind } | { type: "move_stage", stage } | { type: "add_tag_note", text }
import { db, rowRule, rowCandidate, rowRole, logEvent } from "../db.js";
import { getTemplates, fill, deliver } from "./messaging.js";
import crypto from "crypto";

export const DEFAULT_RULES = [
  { name: "Strong screening → send AI interview", trigger: "screened", conditions: { min_score: 70 }, actions: [{ type: "send_interview", kind: "text" }], enabled: 0 },
  { name: "Weak screening → talent pool with a kind note", trigger: "screened", conditions: { max_score: 39 }, actions: [{ type: "move_stage", stage: "Talent pool" }, { type: "send_message", channel: "whatsapp", template: "Talent pool" }], enabled: 0 },
  { name: "Strong interview → shortlist message", trigger: "interview_report", conditions: { min_score: 70, risk: ["clear", "low", "medium"] }, actions: [{ type: "send_message", channel: "whatsapp", template: "Shortlist" }], enabled: 0 },
  { name: "High integrity risk → hold for review", trigger: "interview_report", conditions: { risk: ["high", "medium-high"] }, actions: [{ type: "add_note", text: "Held by automation: integrity risk flagged, review before contacting." }], enabled: 1 },
  { name: "Moved to Offer → send offer message", trigger: "stage_change", conditions: { stage: "Offer" }, actions: [{ type: "send_message", channel: "whatsapp", template: "Offer" }], enabled: 0 },
  { name: "Moved to Not now → thank the candidate", trigger: "stage_change", conditions: { stage: "Not now" }, actions: [{ type: "send_message", channel: "whatsapp", template: "Not now" }], enabled: 0 },
];
export function seedRules() { if (!db.prepare("SELECT 1 FROM rules LIMIT 1").get()) for (const r of DEFAULT_RULES) db.prepare("INSERT INTO rules (name, trigger, conditions, actions, enabled) VALUES (?,?,?,?,?)").run(r.name, r.trigger, JSON.stringify(r.conditions), JSON.stringify(r.actions), r.enabled); }

function matches(rule, cand, ctx) {
  const c = rule.conditions;
  if (c.stage && cand.stage !== c.stage) return false;
  if (c.role_id && String(cand.role_id) !== String(c.role_id)) return false;
  const score = ctx.score ?? cand.screening?.overall;
  if (c.min_score != null && !(score >= c.min_score)) return false;
  if (c.max_score != null && !(score <= c.max_score)) return false;
  if (c.risk?.length && !c.risk.includes(ctx.risk || "clear")) return false;
  return true;
}

// depth guards against rules triggering each other forever
export async function fire(trigger, candidate_id, ctx = {}, depth = 0) {
  if (depth > 2) return [];
  const cand = rowCandidate(db.prepare("SELECT * FROM candidates WHERE id=?").get(candidate_id)); if (!cand) return [];
  const role = rowRole(db.prepare("SELECT * FROM roles WHERE id=?").get(cand.role_id));
  const done = [];
  for (const raw of db.prepare("SELECT * FROM rules WHERE enabled=1 AND trigger=?").all(trigger)) {
    const rule = rowRule(raw); if (!matches(rule, cand, ctx)) continue;
    for (const a of rule.actions) {
      try {
        if (a.type === "send_message") { const t = getTemplates(); if (!t[a.template]) throw new Error(`no template ${a.template}`); await deliver(cand, a.channel || "whatsapp", fill(t[a.template], cand, role, { link: ctx.link || "{link}" })); }
        else if (a.type === "move_stage") { if (cand.stage !== a.stage) { db.prepare("UPDATE candidates SET stage=?, stage_at=datetime('now') WHERE id=?").run(a.stage, cand.id); logEvent(cand.id, "stage", `${cand.stage} → ${a.stage} (rule: ${rule.name})`); cand.stage = a.stage; await fire("stage_change", cand.id, {}, depth + 1); } }
        else if (a.type === "send_interview") {
          if (!role?.questions?.length) throw new Error("role has no questions");
          const token = crypto.randomBytes(12).toString("base64url"), expires = new Date(Date.now() + 5 * 86400000);
          db.prepare("INSERT INTO interviews (candidate_id, token, language, expires_at, proctor, kind) VALUES (?,?,?,?,1,'text')").run(cand.id, token, "en", expires.toISOString());
          if (["Applied", "Screened"].includes(cand.stage)) db.prepare("UPDATE candidates SET stage='AI interview', stage_at=datetime('now') WHERE id=?").run(cand.id);
          const link = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/interview/${token}`;
          if (cand.phone || cand.email) await deliver(cand, cand.phone ? "whatsapp" : "email", fill(getTemplates()["AI interview"], cand, role, { link, deadline: expires.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }) }));
          logEvent(cand.id, "interview_link", `text ${token} (rule: ${rule.name})`);
        }
        else if (a.type === "add_note") { db.prepare("UPDATE candidates SET notes = notes || ? , needs_human=1 WHERE id=?").run(`\n[${new Date().toLocaleDateString("en-IN")}] ${a.text}`, cand.id); }
        done.push(`${rule.name}: ${a.type}`);
      } catch (e) { logEvent(cand.id, "rule_failed", `${rule.name}: ${e.message}`); }
    }
    db.prepare("UPDATE rules SET runs=runs+1, last_run=datetime('now') WHERE id=?").run(rule.id);
    logEvent(cand.id, "rule", rule.name);
  }
  return done;
}
