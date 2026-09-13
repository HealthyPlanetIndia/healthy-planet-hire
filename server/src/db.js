import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
export const FILES_DIR = path.join(DATA_DIR, "files");
fs.mkdirSync(FILES_DIR, { recursive: true });
export const db = new Database(path.join(DATA_DIR, "hph.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT DEFAULT 'recruiter', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, department TEXT, campus TEXT DEFAULT 'Noida',
  openings INTEGER DEFAULT 1, status TEXT DEFAULT 'open',
  criteria TEXT NOT NULL DEFAULT '[]', questions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY, role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  name TEXT NOT NULL, phone TEXT, email TEXT, source TEXT DEFAULT 'Job portal',
  resume_text TEXT, resume_file TEXT, notes TEXT DEFAULT '',
  stage TEXT DEFAULT 'Applied', stage_at TEXT DEFAULT (datetime('now')),
  screening TEXT, owner_id INTEGER REFERENCES users(id),
  last_contact_at TEXT, last_reply_at TEXT, join_date TEXT,
  created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'pending', language TEXT DEFAULT 'en',
  transcript TEXT DEFAULT '[]', report TEXT, expires_at TEXT,
  started_at TEXT, completed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, channel TEXT NOT NULL, body TEXT NOT NULL, status TEXT DEFAULT 'sent',
  external_id TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS templates (
  key TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL, detail TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  key TEXT NOT NULL, label TEXT NOT NULL, category TEXT NOT NULL, required INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', notes TEXT DEFAULT '', file TEXT, updated_by INTEGER, updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(candidate_id, key));
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL, panelist TEXT DEFAULT '', stage TEXT NOT NULL, scores TEXT, comment TEXT DEFAULT '',
  recommendation TEXT, submitted_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY, role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE, stage TEXT DEFAULT 'School interview',
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, location TEXT DEFAULT 'Healthy Planet School, Noida',
  candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL, booked_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, user_id INTEGER, user_name TEXT, method TEXT, path TEXT, summary TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, trigger TEXT NOT NULL, conditions TEXT DEFAULT '{}', actions TEXT DEFAULT '[]',
  enabled INTEGER DEFAULT 1, runs INTEGER DEFAULT 0, last_run TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS api_keys (id INTEGER PRIMARY KEY, name TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL, prefix TEXT NOT NULL,
  created_by INTEGER, last_used TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS password_resets (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cand_stage ON candidates(stage);
CREATE INDEX IF NOT EXISTS idx_cand_phone ON candidates(phone);
CREATE INDEX IF NOT EXISTS idx_cand_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_msg_cand ON messages(candidate_id);
`);

// Additive migrations for existing databases
for (const sql of [
  "ALTER TABLE interviews ADD COLUMN proctor INTEGER DEFAULT 1",
  "ALTER TABLE interviews ADD COLUMN signals TEXT DEFAULT '[]'",
  "ALTER TABLE interviews ADD COLUMN snapshots TEXT DEFAULT '[]'",
  "ALTER TABLE interviews ADD COLUMN integrity TEXT",
  "ALTER TABLE interviews ADD COLUMN sessions TEXT DEFAULT '[]'",
  "ALTER TABLE interviews ADD COLUMN kind TEXT DEFAULT 'text'",
  "ALTER TABLE interviews ADD COLUMN room_url TEXT",
  "ALTER TABLE interviews ADD COLUMN room_name TEXT",
  "ALTER TABLE interviews ADD COLUMN recording_url TEXT",
  "ALTER TABLE roles ADD COLUMN manager_id INTEGER",
  "ALTER TABLE roles ADD COLUMN rubric TEXT",
  "ALTER TABLE roles ADD COLUMN salary_band TEXT DEFAULT ''",
  "ALTER TABLE roles ADD COLUMN description TEXT DEFAULT ''",
  "ALTER TABLE candidates ADD COLUMN salary TEXT DEFAULT ''",
  "ALTER TABLE candidates ADD COLUMN booking_token TEXT",
  "ALTER TABLE candidates ADD COLUMN interview_at TEXT",
  "ALTER TABLE candidates ADD COLUMN anonymized INTEGER DEFAULT 0",
  "ALTER TABLE candidates ADD COLUMN offer_sent_at TEXT",
  "ALTER TABLE candidates ADD COLUMN share_token TEXT",
  "ALTER TABLE candidates ADD COLUMN needs_human INTEGER DEFAULT 0",
  "ALTER TABLE roles ADD COLUMN interview_mode TEXT DEFAULT 'standard'",
  "ALTER TABLE roles ADD COLUMN scenario TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN campuses TEXT",
  "ALTER TABLE interviews ADD COLUMN recording_id TEXT",
  "ALTER TABLE interviews ADD COLUMN transcript_id TEXT",
]) { try { db.exec(sql); } catch {} }

export const STAGES = ["Applied", "Screened", "AI interview", "Shortlist", "Demo lesson", "School interview", "Offer", "Joined", "Talent pool", "Not now"];
export const ACTIVE_STAGES = STAGES.slice(0, 7);
export const MANAGER_STAGES = STAGES.slice(3, 8);

export const DEFAULT_RUBRIC = [
  { key: "planning", label: "Lesson planning and clarity of objectives" },
  { key: "engagement", label: "Student engagement and questioning" },
  { key: "management", label: "Classroom management and warmth" },
  { key: "subject", label: "Subject knowledge and accuracy" },
  { key: "reflection", label: "Reflection and openness in the debrief" },
];
export const DEFAULT_CHECKS = [
  { key: "degree", label: "Degree certificate and marksheets", category: "document", required: 1 },
  { key: "bed", label: "B.Ed / professional qualification", category: "document", required: 1 },
  { key: "tet", label: "CTET / state TET (where applicable)", category: "document", required: 0 },
  { key: "id", label: "Aadhaar or passport", category: "document", required: 1 },
  { key: "relieving", label: "Relieving letter from last school", category: "document", required: 0 },
  { key: "police", label: "Police verification", category: "safety", required: 1 },
  { key: "pocso", label: "POCSO and child-safeguarding declaration signed", category: "safety", required: 1 },
  { key: "ref1", label: "Reference 1 spoken to (name, role, date)", category: "safety", required: 1 },
  { key: "ref2", label: "Reference 2 spoken to (name, role, date)", category: "safety", required: 0 },
  { key: "letter", label: "Signed offer letter received", category: "onboarding", required: 1 },
  { key: "bank", label: "Bank details and PAN", category: "onboarding", required: 1 },
  { key: "medical", label: "Medical fitness certificate", category: "onboarding", required: 0 },
  { key: "induction", label: "Induction and safeguarding training scheduled", category: "onboarding", required: 1 },
  { key: "systems", label: "Email, ERP and biometric access created", category: "onboarding", required: 1 },
];

export const j = (s, fb = null) => { try { return s == null ? fb : JSON.parse(s); } catch { return fb; } };
export const rowCandidate = (r) => r && { ...r, screening: j(r.screening) };
export const rowRole = (r) => r && { ...r, criteria: j(r.criteria, []), questions: j(r.questions, []), rubric: j(r.rubric) || DEFAULT_RUBRIC };
export const rowRule = (r) => r && { ...r, conditions: j(r.conditions, {}), actions: j(r.actions, []) };
export const LANGUAGES = { en: "English", hi: "हिन्दी", pa: "ਪੰਜਾਬੀ", bn: "বাংলা", mr: "मराठी", gu: "ગુજરાતી", ta: "தமிழ்", te: "తెలుగు", kn: "ಕನ್ನಡ", ml: "മലയാളം", ur: "اردو" };
export const userCampuses = (u) => { const c = j(u?.campuses); return Array.isArray(c) && c.length ? c : null; }; // null = all campuses
export const rowEvaluation = (r) => r && { ...r, scores: j(r.scores) };
export const norm = { phone: (p) => (p || "").replace(/\D/g, "").slice(-10), email: (e) => (e || "").trim().toLowerCase() };
export const rowInterview = (r) => r && { ...r, transcript: j(r.transcript, []), report: j(r.report), signals: j(r.signals, []), snapshots: j(r.snapshots, []), integrity: j(r.integrity), sessions: j(r.sessions, []) };

export function audit(req, summary) {
  db.prepare("INSERT INTO audit (user_id, user_name, method, path, summary) VALUES (?,?,?,?,?)").run(req.user?.id || null, req.user?.name || "public", req.method, req.originalUrl.slice(0, 200), (summary || "").slice(0, 300));
}
export function ensureChecks(candidate_id) {
  const ins = db.prepare("INSERT OR IGNORE INTO checks (candidate_id, key, label, category, required) VALUES (?,?,?,?,?)");
  for (const c of DEFAULT_CHECKS) ins.run(candidate_id, c.key, c.label, c.category, c.required);
}
// Returns the required document/safety checks not yet verified. Empty = clear to offer.
export function offerBlockers(candidate_id) {
  ensureChecks(candidate_id);
  return db.prepare("SELECT label FROM checks WHERE candidate_id=? AND required=1 AND category IN ('document','safety') AND status NOT IN ('verified','na')").all(candidate_id).map((r) => r.label);
}
export function findDuplicates(c, excludeId = null) {
  const ph = norm.phone(c.phone), em = norm.email(c.email);
  const rows = db.prepare("SELECT c.id, c.name, c.phone, c.email, c.stage, c.created_at, r.title role_title FROM candidates c LEFT JOIN roles r ON r.id=c.role_id WHERE c.anonymized=0 AND c.id IS NOT ?").all(excludeId);
  const last = (c.name || "").trim().toLowerCase().split(/\s+/).pop();
  return rows.filter((r) => (ph && norm.phone(r.phone) === ph) || (em && norm.email(r.email) === em) || (last && last.length > 3 && r.name.toLowerCase().split(/\s+/).pop() === last && r.name.toLowerCase()[0] === (c.name || "").toLowerCase()[0]))
    .map((r) => ({ ...r, reason: ph && norm.phone(r.phone) === ph ? "same phone" : em && norm.email(r.email) === em ? "same email" : "similar name" }));
}

export function logEvent(candidate_id, type, detail = "") {
  db.prepare("INSERT INTO events (candidate_id, type, detail) VALUES (?,?,?)").run(candidate_id, type, detail);
}
