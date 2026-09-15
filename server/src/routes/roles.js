import { Router } from "express";
import { db, rowRole, ACTIVE_STAGES, audit, DEFAULT_RUBRIC, userCampuses, normQuestions, DEFAULT_SCENARIOS } from "../db.js";
import { draftJobDescription } from "../ai.js";
import { requireStaff, requireAdmin } from "../auth.js";

export const roles = Router();
const get = (id) => db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
const nameOf = (id) => (id ? db.prepare("SELECT name FROM users WHERE id=?").get(id)?.name : null);
const withCounts = (r) => ({ ...rowRole(r), manager: nameOf(r.manager_id), requested_by_name: nameOf(r.requested_by), approved_by_name: nameOf(r.approved_by),
  active: db.prepare(`SELECT COUNT(*) n FROM candidates WHERE role_id = ? AND anonymized=0 AND stage IN (${ACTIVE_STAGES.map(() => "?").join(",")})`).get(r.id, ...ACTIVE_STAGES).n,
  open_slots: db.prepare("SELECT COUNT(*) n FROM slots WHERE role_id=? AND candidate_id IS NULL AND starts_at > datetime('now')").get(r.id).n });

roles.get("/", (req, res) => {
  const where = [], p = [];
  if (req.user.role === "manager") { where.push("manager_id = ?"); p.push(req.user.id); }
  const camp = userCampuses(req.user); if (camp) { where.push(`campus IN (${camp.map(() => "?").join(",")})`); p.push(...camp); }
  res.json(db.prepare(`SELECT * FROM roles${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY status = 'open' DESC, created_at DESC`).all(...p).map(withCounts));
});
// Step 1 Manpower Requisition: anyone on staff (including Principals as hiring managers) raises it; the Director approves before it is posted.
roles.post("/", (req, res) => {
  const { title, department = "", campus = "Noida", openings = 1, criteria = [], questions = [], rubric = DEFAULT_RUBRIC, rubrics = null, manager_id = null, salary_band = "", description = "", interview_mode = "standard", scenario = "", grade = "", subject = "", justification = "", reporting_manager = "", ijp_until = null, written_prompt = null, languages = ["en"], brief = "", scenarios = [], max_questions = 4, answer_seconds = 90 } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
  if (!justification?.trim() && req.user.role !== "admin") return res.status(400).json({ error: "A justification is required on the manpower requisition" });
  const status = req.user.role === "admin" ? "open" : "requested";
  const r = db.prepare("INSERT INTO roles (title, department, campus, openings, criteria, questions, rubric, rubrics, manager_id, salary_band, description, interview_mode, scenario, grade, subject, justification, requested_by, approved_by, approved_at, reporting_manager, ijp_until, written_prompt, status, languages, brief, scenarios, max_questions, answer_seconds) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(title.trim(), department, campus, openings, JSON.stringify(criteria), JSON.stringify(normQuestions(questions)), JSON.stringify(rubric), rubrics ? JSON.stringify(rubrics) : null, manager_id || (req.user.role === "manager" ? req.user.id : null), salary_band, description, interview_mode, scenario, grade, subject, justification, req.user.id, status === "open" ? req.user.id : null, status === "open" ? new Date().toISOString() : null, reporting_manager, ijp_until, written_prompt, status, JSON.stringify(languages.length ? languages : ["en"]), brief, JSON.stringify(scenarios), +max_questions || 4, +answer_seconds || 90);
  audit(req, `${status === "open" ? "created" : "requested"} role ${title}`); res.status(201).json(withCounts(get(r.lastInsertRowid)));
});
roles.post("/:id/approve", requireAdmin, (req, res) => {
  const cur = get(req.params.id); if (!cur) return res.status(404).json({ error: "Role not found" });
  const ok = req.body.decision !== "rejected";
  db.prepare("UPDATE roles SET status=?, approved_by=?, approved_at=datetime('now') WHERE id=?").run(ok ? "open" : "rejected", req.user.id, cur.id);
  audit(req, `${ok ? "approved" : "rejected"} requisition ${cur.title}${req.body.note ? `: ${req.body.note}` : ""}`);
  res.json(withCounts(get(cur.id)));
});
roles.put("/:id", (req, res) => {
  const cur = get(req.params.id); if (!cur) return res.status(404).json({ error: "Role not found" });
  if (req.user.role === "manager" && (cur.requested_by !== req.user.id || cur.status !== "requested")) return res.status(403).json({ error: "Hiring managers can edit only their own pending requisitions" });
  const b = { ...rowRole(cur), ...req.body };
  if (req.body.status === "open" && cur.status !== "open" && req.user.role !== "admin") return res.status(403).json({ error: "Only the Director can approve a requisition" });
  db.prepare("UPDATE roles SET title=?, department=?, campus=?, openings=?, status=?, criteria=?, questions=?, rubric=?, rubrics=?, manager_id=?, salary_band=?, description=?, interview_mode=?, scenario=?, grade=?, subject=?, justification=?, reporting_manager=?, ijp_until=?, written_prompt=?, languages=?, brief=?, scenarios=?, max_questions=?, answer_seconds=? WHERE id=?")
    .run(b.title, b.department, b.campus, b.openings, b.status, JSON.stringify(b.criteria), JSON.stringify(normQuestions(b.questions)), JSON.stringify(b.rubrics?.["Demo lesson"] || b.rubric), JSON.stringify(b.rubrics || {}), b.manager_id || null, b.salary_band || "", b.description || "", b.interview_mode || "standard", b.scenario || "", b.grade || "", b.subject || "", b.justification || "", b.reporting_manager || "", b.ijp_until || null, req.body.written_prompt ?? cur.written_prompt, JSON.stringify(b.languages?.length ? b.languages : ["en"]), b.brief || "", JSON.stringify(b.scenarios || []), +b.max_questions || 4, +b.answer_seconds || 90, req.params.id);
  audit(req, `updated role ${req.params.id}`); res.json(withCounts(get(req.params.id)));
});
roles.get("/defaults/scenarios", (req, res) => res.json(DEFAULT_SCENARIOS));
roles.delete("/:id", requireStaff, (req, res) => { db.prepare("DELETE FROM roles WHERE id = ?").run(req.params.id); audit(req, `deleted role ${req.params.id}`); res.json({ ok: true }); });
roles.post("/:id/job-description", requireStaff, async (req, res, next) => {
  try { const r = rowRole(get(req.params.id)); const text = await draftJobDescription(r); db.prepare("UPDATE roles SET description=? WHERE id=?").run(text, r.id); res.json({ text }); } catch (e) { next(e); }
});

// Interview slots the candidate can self-book
roles.get("/:id/slots", (req, res) => res.json(db.prepare("SELECT s.*, c.name candidate_name FROM slots s LEFT JOIN candidates c ON c.id=s.candidate_id WHERE s.role_id=? AND s.ends_at > datetime('now','-1 day') ORDER BY s.starts_at").all(req.params.id)));
roles.post("/:id/slots", requireStaff, (req, res) => {
  // body: { slots: [{starts_at, ends_at}], stage, location } or { date, times: ["10:00","11:00"], minutes, stage, location }
  const ins = db.prepare("INSERT INTO slots (role_id, stage, starts_at, ends_at, location) VALUES (?,?,?,?,?)");
  const stage = req.body.stage || "Leadership interview", loc = req.body.location || "Healthy Planet School, Noida";
  let list = req.body.slots || [];
  if (req.body.date && req.body.times) list = req.body.times.map((t) => { const s = new Date(`${req.body.date}T${t}:00+05:30`); return { starts_at: s.toISOString(), ends_at: new Date(s.getTime() + (req.body.minutes || 45) * 60000).toISOString() }; });
  for (const s of list) ins.run(req.params.id, stage, s.starts_at, s.ends_at, loc);
  audit(req, `added ${list.length} slots to role ${req.params.id}`);
  res.json(db.prepare("SELECT * FROM slots WHERE role_id=? AND ends_at > datetime('now') ORDER BY starts_at").all(req.params.id));
});
roles.delete("/:id/slots/:slotId", requireStaff, (req, res) => { db.prepare("DELETE FROM slots WHERE id=? AND candidate_id IS NULL").run(req.params.slotId); res.json({ ok: true }); });
