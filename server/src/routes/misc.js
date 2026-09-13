import { Router } from "express";
import { db, ACTIVE_STAGES, STAGES, audit } from "../db.js";
import { runRetention, backup } from "../services/retention.js";
import { videoEnabled } from "../services/video.js";
import { getTemplates, DEFAULT_TEMPLATES } from "../services/messaging.js";
import { requireAdmin, requireStaff, createUser, setPassword, ROLES } from "../auth.js";
import { aiEnabled } from "../ai.js";
import { waEnabled } from "../services/whatsapp.js";
import { mailEnabled } from "../services/email.js";
import { runFollowups } from "../services/followups.js";
import { DEFAULT_RULES } from "../services/rules.js";
import { smsEnabled } from "../services/sms.js";
import { rowRule, LANGUAGES } from "../db.js";
import { handleInbound } from "./webhooks.js";
import crypto from "crypto";
import { clipsDiskUsage } from "../services/clips.js";
import { transcribeEnabled } from "../services/transcribe.js";
import { createHash } from "crypto";

export const misc = Router();
misc.get("/status", (req, res) => res.json({ onboarding_email: process.env.ONBOARDING_NOTIFY_EMAIL || null, rounds: ["Leadership interview", "Subject assessment", "Demo lesson"], transcribe: transcribeEnabled(), video_storage_mb: Math.round(clipsDiskUsage() / 1048576), ai: aiEnabled(), whatsapp: waEnabled(), email: mailEnabled(), sms: smsEnabled(), video: videoEnabled(), languages: LANGUAGES, campuses: db.prepare("SELECT DISTINCT campus FROM roles WHERE campus <> '' ORDER BY campus").all().map((r) => r.campus), public_url: process.env.PUBLIC_URL || "http://localhost:5173", followup_days: +(process.env.FOLLOWUP_DAYS || 3), retention_months: +(process.env.RETENTION_MONTHS || 12), snapshot_days: +(process.env.SNAPSHOT_DAYS || 90), stages: STAGES }));
misc.get("/templates", (req, res) => res.json(getTemplates()));
misc.put("/templates", requireStaff, (req, res) => {
  const up = db.prepare("INSERT INTO templates (key, body) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET body = excluded.body");
  for (const [k, v] of Object.entries(req.body)) if (v?.trim()) up.run(k, v);
  res.json(getTemplates());
});
misc.delete("/templates", (req, res) => { db.prepare("DELETE FROM templates").run(); res.json(DEFAULT_TEMPLATES); });

misc.get("/followups", (req, res) => {
  const days = +(process.env.FOLLOWUP_DAYS || 3);
  res.json(db.prepare(`SELECT c.*, r.title AS role_title FROM candidates c LEFT JOIN roles r ON r.id=c.role_id
    WHERE c.stage IN (${ACTIVE_STAGES.map(() => "?").join(",")}) AND c.stage <> 'Joined'
    AND julianday('now') - julianday(COALESCE(c.last_reply_at, c.stage_at)) >= ? ORDER BY c.stage_at`).all(...ACTIVE_STAGES, days));
});
misc.post("/followups/run", async (req, res, next) => { try { res.json(await runFollowups()); } catch (e) { next(e); } });

misc.get("/analytics", (req, res) => {
  const funnel = db.prepare("SELECT r.id, r.title, c.stage, COUNT(*) n FROM candidates c JOIN roles r ON r.id=c.role_id WHERE c.anonymized=0 GROUP BY r.id, c.stage").all();
  const roles = {}; for (const f of funnel) { roles[f.id] ||= { title: f.title, stages: {} }; roles[f.id].stages[f.stage] = f.n; }
  const past = (st) => STAGES.slice(STAGES.indexOf(st)).filter((s) => !["Talent pool", "Not now"].includes(s));
  const sources = db.prepare(`SELECT source, COUNT(*) total, SUM(CASE WHEN stage IN (${past("Shortlist").map((s) => `'${s}'`).join(",")}) THEN 1 ELSE 0 END) shortlisted, SUM(CASE WHEN stage IN ('Offer','Joined') THEN 1 ELSE 0 END) hired FROM candidates WHERE anonymized=0 GROUP BY source ORDER BY total DESC`).all();
  const tth = db.prepare("SELECT r.title, ROUND(AVG(julianday(e.created_at) - julianday(c.created_at)),1) days, COUNT(*) n FROM events e JOIN candidates c ON c.id=e.candidate_id JOIN roles r ON r.id=c.role_id WHERE e.type='stage' AND e.detail LIKE '%→ Offer' GROUP BY r.id").all();
  const dropoff = db.prepare("SELECT substr(detail, 1, instr(detail,' →')-1) from_stage, COUNT(*) n FROM events WHERE type='stage' AND (detail LIKE '%→ Not now' OR detail LIKE '%→ Talent pool') GROUP BY from_stage").all();
  const monthly = db.prepare("SELECT strftime('%Y-%m', created_at) m, COUNT(*) n FROM candidates GROUP BY m ORDER BY m DESC LIMIT 12").all();
  const integrity = db.prepare("SELECT json_extract(integrity,'$.risk') risk, COUNT(*) n FROM interviews WHERE integrity IS NOT NULL GROUP BY risk").all();
  const evals = db.prepare("SELECT stage, ROUND(AVG((SELECT AVG(value) FROM json_each(scores))),2) avg, COUNT(*) n FROM evaluations WHERE submitted_at IS NOT NULL GROUP BY stage").all();
  res.json({ roles: Object.values(roles), sources, timeToOffer: tth, dropoff, monthly, integrity, evaluations: evals, stages: STAGES });
});

// Automation rules
misc.get("/rules", requireStaff, (req, res) => res.json({ rules: db.prepare("SELECT * FROM rules ORDER BY id").all().map(rowRule), defaults: DEFAULT_RULES }));
misc.post("/rules", requireStaff, (req, res) => { const { name, trigger, conditions = {}, actions = [] } = req.body; if (!name || !trigger || !actions.length) return res.status(400).json({ error: "Name, trigger and at least one action are required" }); const r = db.prepare("INSERT INTO rules (name, trigger, conditions, actions, enabled) VALUES (?,?,?,?,1)").run(name, trigger, JSON.stringify(conditions), JSON.stringify(actions)); audit(req, `rule created ${name}`); res.status(201).json(rowRule(db.prepare("SELECT * FROM rules WHERE id=?").get(r.lastInsertRowid))); });
misc.put("/rules/:id", requireStaff, (req, res) => { const cur = rowRule(db.prepare("SELECT * FROM rules WHERE id=?").get(req.params.id)); if (!cur) return res.status(404).json({ error: "Not found" }); const b = { ...cur, ...req.body }; db.prepare("UPDATE rules SET name=?, trigger=?, conditions=?, actions=?, enabled=? WHERE id=?").run(b.name, b.trigger, JSON.stringify(b.conditions), JSON.stringify(b.actions), b.enabled ? 1 : 0, cur.id); audit(req, `rule ${cur.id} ${b.enabled ? "on" : "off"}`); res.json(rowRule(db.prepare("SELECT * FROM rules WHERE id=?").get(cur.id))); });
misc.delete("/rules/:id", requireStaff, (req, res) => { db.prepare("DELETE FROM rules WHERE id=?").run(req.params.id); res.json({ ok: true }); });

// FAQ answers for the WhatsApp assistant
misc.get("/faqs", requireStaff, (req, res) => res.json(db.prepare("SELECT * FROM faqs ORDER BY id").all()));
misc.post("/faqs", requireStaff, (req, res) => { const { question, answer } = req.body; if (!question || !answer) return res.status(400).json({ error: "Question and answer required" }); db.prepare("INSERT INTO faqs (question, answer) VALUES (?,?)").run(question, answer); res.json(db.prepare("SELECT * FROM faqs ORDER BY id").all()); });
misc.delete("/faqs/:id", requireStaff, (req, res) => { db.prepare("DELETE FROM faqs WHERE id=?").run(req.params.id); res.json({ ok: true }); });
misc.post("/faqs/test", requireStaff, async (req, res, next) => { try { const c = db.prepare("SELECT id FROM candidates WHERE id=?").get(req.body.candidate_id); if (!c) return res.status(404).json({ error: "Candidate not found" }); res.json(await handleInbound(c.id, req.body.text || "")); } catch (e) { next(e); } });
misc.get("/inbox", requireStaff, (req, res) => res.json(db.prepare("SELECT c.id, c.name, c.stage, r.title role_title, (SELECT body FROM messages m WHERE m.candidate_id=c.id AND m.direction='in' ORDER BY m.created_at DESC LIMIT 1) last_in, c.last_reply_at FROM candidates c LEFT JOIN roles r ON r.id=c.role_id WHERE c.needs_human=1 ORDER BY c.last_reply_at DESC").all()));

// API keys for other systems (school website, ERP, ARISE tools). Send as header X-API-Key.
misc.get("/api-keys", requireAdmin, (req, res) => res.json(db.prepare("SELECT id, name, prefix, last_used, created_at FROM api_keys").all()));
misc.post("/api-keys", requireAdmin, (req, res) => { const key = "hph_" + crypto.randomBytes(24).toString("base64url"); db.prepare("INSERT INTO api_keys (name, key_hash, prefix, created_by) VALUES (?,?,?,?)").run(req.body.name || "Integration", createHash("sha256").update(key).digest("hex"), key.slice(0, 10), req.user.id); audit(req, `api key created ${req.body.name}`); res.status(201).json({ key, note: "Shown once. Store it safely." }); });
misc.delete("/api-keys/:id", requireAdmin, (req, res) => { db.prepare("DELETE FROM api_keys WHERE id=?").run(req.params.id); audit(req, `api key revoked ${req.params.id}`); res.json({ ok: true }); });
misc.get("/docs", (req, res) => res.json({ auth: "Authorization: Bearer <jwt> from POST /api/auth/login, or X-API-Key: <key> created in Settings → Integrations", endpoints: {
  "GET /api/roles": "open roles with criteria, questions, rubric", "POST /api/roles": "create a role", "GET /api/roles/:id/slots": "interview slots",
  "GET /api/candidates?role_id&stage&q": "list", "POST /api/candidates (multipart: name, phone, email, role_id, source, resume file or resume_text)": "create; returns duplicates[]", "POST /api/candidates/bulk (files[])": "bulk import", "GET /api/candidates/:id": "full profile with screening, interviews, checks, evaluations", "PUT /api/candidates/:id": "update; stage changes fire automation rules; Offer/Joined blocked by checks (409)",
  "POST /api/candidates/:id/screen": "AI screening now", "POST /api/candidates/screen-all": "queue all unscreened", "GET /api/candidates/queue": "queue progress", "POST /api/candidates/:id/interviews {kind: text|video, send: whatsapp|email|sms, language}": "create interview link",
  "PUT /api/candidates/:id/checks/:key {status, notes} + file": "documents and safety checks", "POST /api/candidates/:id/evaluations {panelist, stage}": "panel scoring link", "POST /api/candidates/:id/messages {channel, body}": "send", "GET /api/candidates/:id/export": "all data (JSON)", "DELETE /api/candidates/:id/purge": "erase",
  "GET /api/analytics": "funnel, sources, time to offer", "GET /api/followups": "waiting candidates", "GET /api/inbox": "replies needing a human", "GET|POST|PUT /api/rules": "automation", "GET /api/public/jobs.xml": "job feed (no auth)", "POST /api/public/apply": "careers form (no auth)",
}, webhooks: { whatsapp: "/api/webhooks/whatsapp", daily: "/api/public/webhooks/daily" } }));

misc.put("/users/:id/campuses", requireAdmin, (req, res) => { db.prepare("UPDATE users SET campuses=? WHERE id=?").run(req.body.campuses?.length ? JSON.stringify(req.body.campuses) : null, req.params.id); audit(req, `campuses for user ${req.params.id}`); res.json({ ok: true }); });

// Letter issuance tracker (all letters, for HR)
misc.get("/letters", requireStaff, (req, res) => res.json(db.prepare("SELECT l.id, l.type, l.ref_no, l.status, l.issued_at, l.issued_via, l.approved_at, l.created_at, c.name candidate, u.name approved_by_name FROM letters l LEFT JOIN candidates c ON c.id=l.candidate_id LEFT JOIN users u ON u.id=l.approved_by ORDER BY l.id DESC LIMIT 500").all()));
// Requisitions awaiting the Director
misc.get("/requisitions", requireAdmin, (req, res) => res.json(db.prepare("SELECT r.id, r.title, r.department, r.campus, r.grade, r.subject, r.openings, r.justification, r.created_at, u.name requested_by_name FROM roles r LEFT JOIN users u ON u.id=r.requested_by WHERE r.status='requested' ORDER BY r.created_at").all()));

misc.get("/audit", requireAdmin, (req, res) => res.json(db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 300").all()));
misc.post("/retention/run", requireAdmin, (req, res) => { audit(req, "ran retention"); res.json(runRetention()); });
misc.post("/backup", requireAdmin, (req, res) => { audit(req, "manual backup"); res.json({ file: backup() }); });

misc.get("/dashboard", (req, res) => {
  const byStage = db.prepare("SELECT stage, COUNT(*) n FROM candidates GROUP BY stage").all();
  const week = db.prepare("SELECT COUNT(*) n FROM candidates WHERE created_at >= datetime('now','-7 days')").get().n;
  const tth = db.prepare(`SELECT AVG(julianday(e.created_at) - julianday(c.created_at)) d FROM events e JOIN candidates c ON c.id=e.candidate_id WHERE e.type='stage' AND e.detail LIKE '%→ Offer'`).get().d;
  const interviews = db.prepare("SELECT status, COUNT(*) n FROM interviews GROUP BY status").all();
  res.json({ byStage, newThisWeek: week, avgDaysToOffer: tth ? Math.round(tth) : null, interviews });
});

misc.get("/users", requireAdmin, (req, res) => res.json(db.prepare("SELECT id, name, email, role, campuses, created_at FROM users").all().map((u) => ({ ...u, campuses: u.campuses ? JSON.parse(u.campuses) : [] }))));
misc.post("/users", requireAdmin, async (req, res, next) => { try { if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: "Role must be admin, recruiter or manager" }); const id = await createUser(req.body); audit(req, `added user ${req.body.email}`); res.status(201).json({ id }); } catch (e) { next(e); } });
misc.get("/users/managers", (req, res) => res.json(db.prepare("SELECT id, name FROM users WHERE role IN ('manager','admin','recruiter') ORDER BY name").all()));
misc.delete("/users/:id", requireAdmin, (req, res) => { db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id); res.json({ ok: true }); });
misc.post("/me/password", async (req, res, next) => { try { await setPassword(req.user.id, req.body.password); res.json({ ok: true }); } catch (e) { next(e); } });
