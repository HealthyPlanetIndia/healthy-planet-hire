import { Router } from "express";
import { db, logEvent, rowCandidate, rowRole } from "../db.js";
import { parseInbound } from "../services/whatsapp.js";
import { aiEnabled, answerFaq } from "../ai.js";
import { getTemplates, fill, deliver } from "../services/messaging.js";
import { fire } from "../services/rules.js";

// Try to answer a candidate's question from the FAQ list; otherwise flag for a human.
export async function handleInbound(candidate_id, text) {
  const c = rowCandidate(db.prepare("SELECT * FROM candidates WHERE id=?").get(candidate_id)), role = rowRole(db.prepare("SELECT * FROM roles WHERE id=?").get(c.role_id));
  const faqs = db.prepare("SELECT question, answer FROM faqs").all();
  let reply = null;
  if (aiEnabled() && faqs.length && text.length > 3 && text.length < 600) { try { reply = await answerFaq(faqs, c, role, text); } catch {} }
  if (reply) { await deliver(c, "whatsapp", reply); logEvent(c.id, "faq_reply", reply.slice(0, 80)); return { replied: true }; }
  db.prepare("UPDATE candidates SET needs_human=1 WHERE id=?").run(c.id);
  logEvent(c.id, "needs_human", text.slice(0, 80));
  if (aiEnabled() && faqs.length) { try { await deliver(c, "whatsapp", fill(getTemplates().needs_human, c, role)); } catch {} }
  return { replied: false };
}

export const webhooks = Router();
webhooks.get("/whatsapp", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === (process.env.WA_VERIFY_TOKEN || "healthyplanet-verify")) return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});
webhooks.post("/whatsapp", async (req, res) => {
  res.sendStatus(200);
  for (const m of parseInbound(req.body)) {
    const c = db.prepare("SELECT id FROM candidates WHERE REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-','') LIKE ? ORDER BY stage_at DESC LIMIT 1").get(`%${m.from.slice(-10)}`);
    if (!c) continue;
    db.prepare("INSERT INTO messages (candidate_id, direction, channel, body, status, external_id) VALUES (?,?,?,?,?,?)").run(c.id, "in", "whatsapp", m.text, "received", m.id);
    db.prepare("UPDATE candidates SET last_reply_at = datetime('now') WHERE id = ?").run(c.id);
    logEvent(c.id, "message_in", m.text.slice(0, 80));
    try { await handleInbound(c.id, m.text); await fire("reply", c.id, {}); } catch (e) { console.error("inbound", e.message); }
  }
});
