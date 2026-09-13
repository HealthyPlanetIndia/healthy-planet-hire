import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db.js";

import fs from "fs";
import path from "path";
import { DATA_DIR } from "./db.js";
// If no JWT_SECRET is configured, generate one once and keep it in the data folder so sessions survive restarts.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const f = path.join(DATA_DIR, ".secret");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  const s = crypto.randomBytes(48).toString("base64url"); fs.writeFileSync(f, s, { mode: 0o600 }); return s;
}
const SECRET = loadSecret();

export function sign(user) { return jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: "30d" }); }
export function requireAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    const row = db.prepare("SELECT * FROM api_keys WHERE key_hash = ?").get(crypto.createHash("sha256").update(String(apiKey)).digest("hex"));
    if (!row) return res.status(401).json({ error: "Invalid API key" });
    db.prepare("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?").run(row.id);
    req.user = { id: null, name: `API: ${row.name}`, role: "recruiter" }; return next();
  }
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please sign in" });
  try { const u = jwt.verify(token, SECRET); const fresh = db.prepare("SELECT role, campuses FROM users WHERE id = ?").get(u.id); if (!fresh) throw new Error(); req.user = { ...u, role: fresh.role, campuses: fresh.campuses }; next(); } catch { res.status(401).json({ error: "Session expired, please sign in again" }); }
}
export const ROLES = ["admin", "recruiter", "manager"];
export function requireStaff(req, res, next) { if (req.user?.role === "manager") return res.status(403).json({ error: "Hiring managers can view shortlisted candidates and score them, but not change the pipeline" }); next(); }
export function requireAdmin(req, res, next) { if (req.user?.role !== "admin") return res.status(403).json({ error: "Admins only" }); next(); }

export async function login(email, password) {
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return null;
  return { token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } };
}
export async function createUser({ name, email, password, role = "recruiter" }) {
  const hash = await bcrypt.hash(password, 10);
  const r = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)").run(name, email.toLowerCase().trim(), hash, role);
  return r.lastInsertRowid;
}
export function createResetToken(email) {
  const u = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim()); if (!u) return null;
  const token = crypto.randomBytes(24).toString("base64url");
  db.prepare("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?,?,datetime('now','+1 hour'))").run(token, u.id);
  return token;
}
export async function useResetToken(token, password) {
  const r = db.prepare("SELECT * FROM password_resets WHERE token = ? AND expires_at > datetime('now')").get(token); if (!r) return false;
  await setPassword(r.user_id, password); db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(r.user_id); return true;
}
export async function setPassword(id, password) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await bcrypt.hash(password, 10), id);
}
