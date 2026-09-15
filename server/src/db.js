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
  id INTEGER PRIMARY KEY, role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE, stage TEXT DEFAULT 'Leadership interview',
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
CREATE TABLE IF NOT EXISTS letters (
  id INTEGER PRIMARY KEY, candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL, type TEXT NOT NULL, ref_no TEXT UNIQUE NOT NULL,
  body TEXT NOT NULL, status TEXT DEFAULT 'draft', created_by INTEGER, approved_by INTEGER, approved_at TEXT, issued_at TEXT, issued_via TEXT,
  created_at TEXT DEFAULT (datetime('now')));
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
  "ALTER TABLE roles ADD COLUMN grade TEXT DEFAULT ''",
  "ALTER TABLE roles ADD COLUMN subject TEXT DEFAULT ''",
  "ALTER TABLE roles ADD COLUMN justification TEXT DEFAULT ''",
  "ALTER TABLE roles ADD COLUMN requested_by INTEGER",
  "ALTER TABLE roles ADD COLUMN approved_by INTEGER",
  "ALTER TABLE roles ADD COLUMN approved_at TEXT",
  "ALTER TABLE roles ADD COLUMN reporting_manager TEXT DEFAULT ''",
  "ALTER TABLE roles ADD COLUMN ijp_until TEXT",
  "ALTER TABLE roles ADD COLUMN rubrics TEXT",
  "ALTER TABLE roles ADD COLUMN written_prompt TEXT",
  "ALTER TABLE candidates ADD COLUMN referrer TEXT DEFAULT ''",
  "ALTER TABLE candidates ADD COLUMN location TEXT DEFAULT ''",
  "ALTER TABLE candidates ADD COLUMN current_employer TEXT DEFAULT ''",
  "ALTER TABLE candidates ADD COLUMN expected_salary TEXT DEFAULT ''",
  "ALTER TABLE candidates ADD COLUMN notice_period TEXT DEFAULT ''",
  "ALTER TABLE candidates ADD COLUMN screening_call TEXT",
  "ALTER TABLE candidates ADD COLUMN final_review TEXT",
  "ALTER TABLE candidates ADD COLUMN hr_discussion TEXT",
  "ALTER TABLE checks ADD COLUMN owner TEXT DEFAULT 'HR'",
  "ALTER TABLE checks ADD COLUMN phase TEXT",
  "ALTER TABLE roles ADD COLUMN languages TEXT",
  "ALTER TABLE roles ADD COLUMN brief TEXT DEFAULT ''",
  "ALTER TABLE interviews ADD COLUMN retakes TEXT DEFAULT '[]'",
  "ALTER TABLE interviews ADD COLUMN recording_id TEXT",
  "ALTER TABLE interviews ADD COLUMN transcript_id TEXT",
  "ALTER TABLE interviews ADD COLUMN clips TEXT DEFAULT '[]'",
  "ALTER TABLE interviews ADD COLUMN mode TEXT DEFAULT 'video'",
]) { try { db.exec(sql); } catch {} }

export const STAGES = ["Applied", "Screened", "AI interview", "Screening call", "Shortlist", "Leadership interview", "Subject assessment", "Demo lesson", "Written assessment", "Final review", "HR discussion", "Offer", "Joined", "Talent pool", "Not now"];
export const ACTIVE_STAGES = STAGES.slice(0, 12);
export const MANAGER_STAGES = STAGES.slice(4, 13);
export const ROUNDS = ["Leadership interview", "Subject assessment", "Demo lesson"];
// One rubric per panel round, each item scored 1 to 5
export const DEFAULT_RUBRICS = {
  "Leadership interview": [
    { key: "culture", label: "Fit with school culture and values" },
    { key: "communication", label: "Communication and warmth" },
    { key: "presence", label: "Classroom presence (teaching roles)" },
    { key: "growth", label: "Openness to feedback and growth" },
  ],
  "Subject assessment": [
    { key: "knowledge", label: "Depth and accuracy of subject knowledge" },
    { key: "pedagogy", label: "Ability to explain the subject to children" },
    { key: "curriculum", label: "Familiarity with the curriculum and board" },
    { key: "assessment", label: "Approach to checking understanding" },
  ],
  "Demo lesson": [
    { key: "planning", label: "Lesson planning and clarity of objectives" },
    { key: "engagement", label: "Student engagement and questioning" },
    { key: "management", label: "Classroom management and warmth" },
    { key: "subject", label: "Subject knowledge and accuracy" },
    { key: "reflection", label: "Reflection and openness in the debrief" },
  ],
};
export const DEFAULT_WRITTEN_PROMPT = "Write to the parents of your class (150 to 250 words) explaining a change you would like to make to homework this term and why. Write as you would in a real circular from the school.";

export const DEFAULT_RUBRIC = DEFAULT_RUBRICS["Demo lesson"];
export const DEFAULT_CHECKS_ = [
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
export const DEFAULT_CHECKS = [
  // Step 5 Background verification (roles with student contact)
  { key: "id", label: "Identity verified (Aadhaar or passport)", category: "document", required: 1, owner: "HR" },
  { key: "address", label: "Address proof", category: "document", required: 1, owner: "HR" },
  { key: "degree", label: "Degree certificates and marksheets verified against originals", category: "document", required: 1, owner: "HR" },
  { key: "bed", label: "B.Ed / professional qualification verified", category: "document", required: 1, owner: "HR" },
  { key: "tet", label: "CTET / state TET (where applicable)", category: "document", required: 0, owner: "HR" },
  { key: "employment", label: "Employment history verified (previous employment documents)", category: "document", required: 1, owner: "HR" },
  { key: "relieving", label: "Relieving letter from last employer", category: "document", required: 0, owner: "HR" },
  { key: "photos", label: "Passport-size photographs received", category: "document", required: 0, owner: "HR" },
  { key: "police", label: "Police verification", category: "safety", required: 1, owner: "HR" },
  { key: "pocso", label: "POCSO and child-safeguarding declaration signed", category: "safety", required: 1, owner: "HR" },
  { key: "ref1", label: "Reference 1: previous employer or academic (name, role, date, notes)", category: "safety", required: 1, owner: "HR" },
  { key: "ref2", label: "Reference 2: previous employer or academic (name, role, date, notes)", category: "safety", required: 1, owner: "HR" },
  // Step 6 Offer and documentation
  { key: "letter", label: "Signed offer acceptance received", category: "onboarding", required: 1, owner: "HR", phase: "Pre-boarding" },
  { key: "bank", label: "Bank details and PAN", category: "onboarding", required: 1, owner: "HR", phase: "Pre-boarding" },
  // Onboarding Phase 1: pre-boarding
  { key: "welcome", label: "Welcome email sent: date, time, reporting location, documents to carry", category: "onboarding", required: 1, owner: "HR", phase: "Pre-boarding" },
  { key: "it_notified", label: "IT/Admin notified: workstation, email ID, biometric access, ID card", category: "onboarding", required: 1, owner: "IT/Admin", phase: "Pre-boarding" },
  // Phase 2: Day 1 induction
  { key: "biometric", label: "Biometric enrolment, ID card issued, email and system access working", category: "onboarding", required: 1, owner: "IT/Admin", phase: "Day 1" },
  { key: "orientation", label: "HR orientation: org structure, code of conduct, child safety and safeguarding, leave and attendance, grievance redressal", category: "onboarding", required: 1, owner: "HR", phase: "Day 1" },
  { key: "manual", label: "HR Manual and policies link shared", category: "onboarding", required: 1, owner: "HR", phase: "Day 1" },
  { key: "tour", label: "Campus tour and introductions: Admin, Accounts, IT, Facilities", category: "onboarding", required: 1, owner: "HR", phase: "Day 1" },
  { key: "file", label: "Personal file opened with all statutory documents", category: "onboarding", required: 1, owner: "HR", phase: "Day 1" },
  { key: "medical", label: "Medical fitness certificate", category: "onboarding", required: 0, owner: "HR", phase: "Day 1" },
  // Phase 3: Week 1 role orientation
  { key: "role_brief", label: "Reporting Manager briefing: responsibilities, reporting lines, immediate priorities", category: "onboarding", required: 1, owner: "Reporting Manager", phase: "Week 1" },
  { key: "teaching_brief", label: "Teaching staff: curriculum, lesson planning formats, classroom protocols, academic calendar", category: "onboarding", required: 0, owner: "Reporting Manager", phase: "Week 1" },
];

export const j = (s, fb = null) => { try { return s == null ? fb : JSON.parse(s); } catch { return fb; } };
export const rowCandidate = (r) => r && { ...r, screening: j(r.screening) };
export const rowInterview = (r) => r && { ...r, transcript: j(r.transcript, []), report: j(r.report), signals: j(r.signals, []), snapshots: j(r.snapshots, []), integrity: j(r.integrity), sessions: j(r.sessions, []), clips: j(r.clips, []), retakes: j(r.retakes, []) };
// What an interview question is designed to assess. The report scores each answer only against its own label.
export const COMPETENCIES = ["Classroom thinking", "Child-centred practice", "Handling parents", "School values", "Subject knowledge", "Inquiry or project-based learning", "Digital tools", "Classroom management", "Reflection and growth", "Other"];
// Questions may be stored as strings (older roles) or as { text, assesses }
export const normQuestions = (qs) => (qs || []).map((q) => (typeof q === "string" ? { text: q, assesses: "Classroom thinking" } : { text: q.text || "", assesses: q.assesses || "Classroom thinking" })).filter((q) => q.text.trim());
export const rowRole = (r) => r && { ...r, criteria: j(r.criteria, []), questions: normQuestions(j(r.questions, [])), languages: j(r.languages) || ["en"], rubric: j(r.rubric) || DEFAULT_RUBRIC, rubrics: { ...DEFAULT_RUBRICS, ...(j(r.rubric) ? { "Demo lesson": j(r.rubric) } : {}), ...(j(r.rubrics) || {}) }, written_prompt: r.written_prompt || DEFAULT_WRITTEN_PROMPT };
export const rowCandidateFull = (r) => r && { ...rowCandidate(r), screening_call: j(r.screening_call), final_review: j(r.final_review), hr_discussion: j(r.hr_discussion) };
export const rowRule = (r) => r && { ...r, conditions: j(r.conditions, {}), actions: j(r.actions, []) };
export const LANGUAGES = { en: "English", hi: "हिन्दी", pa: "ਪੰਜਾਬੀ", bn: "বাংলা", mr: "मराठी", gu: "ગુજરાતી", ta: "தமிழ்", te: "తెలుగు", kn: "ಕನ್ನಡ", ml: "മലയാളം", ur: "اردو" };
export const userCampuses = (u) => { const c = j(u?.campuses); return Array.isArray(c) && c.length ? c : null; }; // null = all campuses
export const rowEvaluation = (r) => r && { ...r, scores: j(r.scores) };
export const norm = { phone: (p) => (p || "").replace(/\D/g, "").slice(-10), email: (e) => (e || "").trim().toLowerCase() };
// "+91 9810012345" for anything a candidate or recruiter might type: 9810012345, 09810012345, 919810012345, +91-98100-12345
const DIAL_CODES = ["371", "966", "973", "251", "678", "381", "378", "506", "297", "211", "230", "357", "965", "960", "380", "387", "231", "597", "239", "248", "592", "220", "258", "977", "354", "238", "240", "269", "356", "265", "244", "386", "850", "212", "504", "503", "599", "229", "253", "379", "268", "688", "679", "250", "852", "223", "350", "590", "389", "970", "880", "260", "886", "261", "254", "370", "674", "972", "421", "233", "213", "264", "598", "853", "241", "232", "249", "218", "263", "266", "420", "352", "355", "502", "376", "505", "974", "221", "262", "964", "385", "382", "377", "961", "383", "216", "692", "855", "593", "962", "685", "971", "501", "245", "358", "993", "359", "595", "994", "225", "992", "298", "507", "252", "670", "976", "591", "237", "255", "228", "998", "257", "673", "291", "975", "682", "224", "996", "968", "675", "423", "686", "267", "967", "353", "235", "680", "676", "689", "687", "236", "373", "226", "677", "351", "995", "374", "234", "256", "372", "242", "691", "856", "963", "375", "222", "299", "227", "243", "509", "56", "27", "49", "93", "92", "54", "62", "91", "60", "51", "20", "44", "52", "30", "65", "32", "57", "61", "53", "45", "47", "66", "82", "64", "33", "39", "90", "86", "40", "46", "48", "63", "58", "94", "55", "95", "43", "41", "34", "36", "98", "81", "31", "84", "7", "1"]; // every UN member state, longest first so +1 never swallows +1x (none exist) and +9 never swallows +91
export function canonPhone(p) { const s = String(p || "").trim(); if (!s) return ""; if (s.startsWith("+")) { const d = s.replace(/\D/g, ""); for (const code of DIAL_CODES) if (d.startsWith(code) && d.length > code.length) return `+${code} ${d.slice(code.length)}`; return `+${d}`; } const d = s.replace(/\D/g, "").replace(/^0+/, ""); if (d.length === 10) return `+91 ${d}`; if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2)}`; return d ? `+${d}` : ""; }

export function audit(req, summary) {
  db.prepare("INSERT INTO audit (user_id, user_name, method, path, summary) VALUES (?,?,?,?,?)").run(req.user?.id || null, req.user?.name || "public", req.method, req.originalUrl.slice(0, 200), (summary || "").slice(0, 300));
}
export function ensureChecks(candidate_id) {
  const ins = db.prepare("INSERT OR IGNORE INTO checks (candidate_id, key, label, category, required, owner, phase) VALUES (?,?,?,?,?,?,?)");
  for (const c of DEFAULT_CHECKS) ins.run(candidate_id, c.key, c.label, c.category, c.required, c.owner || "HR", c.phase || null);
}
// Final Review: the Director's approval, recorded on the candidate. Required before Offer.
export function finalApproved(candidate_id) { const r = db.prepare("SELECT final_review FROM candidates WHERE id=?").get(candidate_id); const f = j(r?.final_review); return f?.decision === "approved"; }
export function nextLetterRef(type) {
  const year = new Date().getFullYear(), prefix = `HPS/HR/${type === "appointment" ? "APT" : "OFR"}/${year}/`;
  const last = db.prepare("SELECT ref_no FROM letters WHERE ref_no LIKE ? ORDER BY id DESC LIMIT 1").get(prefix + "%");
  const n = last ? +last.ref_no.split("/").pop() + 1 : 1; return prefix + String(n).padStart(4, "0");
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
