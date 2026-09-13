import { Router } from "express";
import { db, rowRole, ACTIVE_STAGES, audit, DEFAULT_RUBRIC, userCampuses } from "../db.js";
import { draftJobDescription } from "../ai.js";
import { requireStaff } from "../auth.js";

export const roles = Router();
const get = (id) => db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
const withCounts = (r) => ({ ...rowRole(r), manager: r.manager_id ? db.prepare("SELECT name FROM users WHERE id=?").get(r.manager_id)?.name : null,
  active: db.prepare(`SELECT COUNT(*) n FROM candidates WHERE role_id = ? AND anonymized=0 AND stage IN (${ACTIVE_STAGES.map(() => "?").join(",")})`).get(r.id, ...ACTIVE_STAGES).n,
  open_slots: db.prepare("SELECT COUNT(*) n FROM slots WHERE role_id=? AND candidate_id IS NULL AND starts_at > datetime('now')").get(r.id).n });

roles.get("/", (req, res) => {
  const where = [], p = [];
  if (req.user.role === "manager") { where.push("manager_id = ?"); p.push(req.user.id); }
  const camp = userCampuses(req.user); if (camp) { where.push(`campus IN (${camp.map(() => "?").join(",")})`); p.push(...camp); }
  res.json(db.prepare(`SELECT * FROM roles${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY status = 'open' DESC, created_at DESC`).all(...p).map(withCounts));
});
roles.post("/", requireStaff, (req, res) => {
  const { title, department = "", campus = "Noida", openings = 1, criteria = [], questions = [], rubric = DEFAULT_RUBRIC, manager_id = null, salary_band = "", description = "", interview_mode = "standard", scenario = "" } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
  const r = db.prepare("INSERT INTO roles (title, department, campus, openings, criteria, questions, rubric, manager_id, salary_band, description, interview_mode, scenario) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(title.trim(), department, campus, openings, JSON.stringify(criteria), JSON.stringify(questions), JSON.stringify(rubric), manager_id || null, salary_band, description, interview_mode, scenario);
  audit(req, `created role ${title}`); res.status(201).json(withCounts(get(r.lastInsertRowid)));
});
roles.put("/:id", requireStaff, (req, res) => {
  const cur = get(req.params.id); if (!cur) return res.status(404).json({ error: "Role not found" });
  const b = { ...rowRole(cur), ...req.body };
  db.prepare("UPDATE roles SET title=?, department=?, campus=?, openings=?, status=?, criteria=?, questions=?, rubric=?, manager_id=?, salary_band=?, description=?, interview_mode=?, scenario=? WHERE id=?").run(b.title, b.department, b.campus, b.openings, b.status, JSON.stringify(b.criteria), JSON.stringify(b.questions), JSON.stringify(b.rubric), b.manager_id || null, b.salary_band || "", b.description || "", b.interview_mode || "standard", b.scenario || "", req.params.id);
  audit(req, `updated role ${req.params.id}`); res.json(withCounts(get(req.params.id)));
});
roles.delete("/:id", requireStaff, (req, res) => { db.prepare("DELETE FROM roles WHERE id = ?").run(req.params.id); audit(req, `deleted role ${req.params.id}`); res.json({ ok: true }); });
roles.post("/:id/job-description", requireStaff, async (req, res, next) => {
  try { const r = rowRole(get(req.params.id)); const text = await draftJobDescription(r); db.prepare("UPDATE roles SET description=? WHERE id=?").run(text, r.id); res.json({ text }); } catch (e) { next(e); }
});

// Interview slots the candidate can self-book
roles.get("/:id/slots", (req, res) => res.json(db.prepare("SELECT s.*, c.name candidate_name FROM slots s LEFT JOIN candidates c ON c.id=s.candidate_id WHERE s.role_id=? AND s.ends_at > datetime('now','-1 day') ORDER BY s.starts_at").all(req.params.id)));
roles.post("/:id/slots", requireStaff, (req, res) => {
  // body: { slots: [{starts_at, ends_at}], stage, location } or { date, times: ["10:00","11:00"], minutes, stage, location }
  const ins = db.prepare("INSERT INTO slots (role_id, stage, starts_at, ends_at, location) VALUES (?,?,?,?,?)");
  const stage = req.body.stage || "School interview", loc = req.body.location || "Healthy Planet School, Noida";
  let list = req.body.slots || [];
  if (req.body.date && req.body.times) list = req.body.times.map((t) => { const s = new Date(`${req.body.date}T${t}:00+05:30`); return { starts_at: s.toISOString(), ends_at: new Date(s.getTime() + (req.body.minutes || 45) * 60000).toISOString() }; });
  for (const s of list) ins.run(req.params.id, stage, s.starts_at, s.ends_at, loc);
  audit(req, `added ${list.length} slots to role ${req.params.id}`);
  res.json(db.prepare("SELECT * FROM slots WHERE role_id=? AND ends_at > datetime('now') ORDER BY starts_at").all(req.params.id));
});
roles.delete("/:id/slots/:slotId", requireStaff, (req, res) => { db.prepare("DELETE FROM slots WHERE id=? AND candidate_id IS NULL").run(req.params.slotId); res.json({ ok: true }); });
