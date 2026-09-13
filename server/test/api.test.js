// Run with: npm test   (uses a throwaway database in a temp dir; no API keys needed)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 4321, BASE = `http://localhost:${PORT}/api`;
let proc, token, dir;
const req = async (p, { method = "GET", body, auth = true, raw } = {}) => {
  const h = {}; if (auth && token) h.Authorization = `Bearer ${token}`; if (body) h["Content-Type"] = "application/json";
  const r = await fetch(BASE + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: raw ? await r.text() : await r.json().catch(() => ({})) };
};

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "hph-"));
  const env = { ...process.env, PORT, DATA_DIR: dir, JWT_SECRET: "test", PUBLIC_URL: "http://test.local", ANTHROPIC_API_KEY: "" };
  await new Promise((res, rej) => { const s = spawn("node", ["src/seed.js"], { env }); s.on("exit", (c) => (c === 0 ? res() : rej(new Error("seed failed")))); });
  proc = spawn("node", ["src/index.js"], { env, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + "/status"); break; } catch { await new Promise((r) => setTimeout(r, 150)); } }
  const r = await req("/auth/login", { method: "POST", body: { email: "arunabh@healthyplanetschool.com", password: "changeme" }, auth: false });
  token = r.data.token;
});
after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("login works and protected routes need a token", async () => {
  assert.ok(token);
  assert.equal((await req("/roles", { auth: false })).status, 401);
  assert.equal((await req("/auth/login", { method: "POST", body: { email: "x@y.z", password: "no" }, auth: false })).status, 401);
});

test("roles, slots and the jobs feed", async () => {
  const roles = (await req("/roles")).data; assert.ok(roles.length >= 2);
  const s = await req(`/roles/${roles[0].id}/slots`, { method: "POST", body: { date: "2030-01-15", times: ["10:00", "11:00"], minutes: 45 } });
  assert.equal(s.data.length, 2);
  const xml = (await req("/public/jobs.xml", { auth: false, raw: true })).data; assert.match(xml, /<job>/);
});

test("candidate lifecycle: duplicate warning, checks gate blocks offer, admin override works", async () => {
  const c1 = (await req("/candidates", { method: "POST", body: { name: "Asha Verma", phone: "+91 99999 11111", role_id: 1, resume_text: "B.Ed. 5 years teaching." } })).data;
  assert.equal(c1.duplicates.length, 0);
  const c2 = (await req("/candidates", { method: "POST", body: { name: "A. Verma", phone: "9999911111", role_id: 1 } })).data;
  assert.equal(c2.duplicates[0].reason, "same phone");

  let r = await req(`/candidates/${c1.id}`, { method: "PUT", body: { stage: "Offer" } });
  assert.equal(r.status, 409); assert.match(r.data.error, /Director/);
  await req(`/candidates/${c1.id}/final-review`, { method: "POST", body: { decision: "approved", note: "Strong across rounds" } });
  r = await req(`/candidates/${c1.id}`, { method: "PUT", body: { stage: "Offer" } });
  assert.equal(r.status, 409); assert.ok(r.data.blockers.length > 3);
  // a conditional offer is allowed with verification pending, and recorded as such
  r = await req(`/candidates/${c1.id}`, { method: "PUT", body: { stage: "Offer", conditional: true } }); assert.equal(r.status, 200);
  assert.ok((await req(`/candidates/${c1.id}`)).data.events.some((e) => e.type === "conditional_offer"));
  await req(`/candidates/${c1.id}`, { method: "PUT", body: { stage: "Final review" } });

  const checks = (await req(`/candidates/${c1.id}/checks`)).data;
  for (const ch of checks.filter((k) => k.required && k.category !== "onboarding")) {
    const u = await fetch(`${BASE}/candidates/${c1.id}/checks/${ch.key}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "verified", notes: "seen" }) });
    assert.equal(u.status, 200);
  }
  r = await req(`/candidates/${c1.id}`, { method: "PUT", body: { stage: "Offer", salary: "INR 55,000 per month", join_date: "2030-04-01" } });
  assert.equal(r.status, 200); assert.equal(r.data.stage, "Offer");
  const letter = (await req(`/candidates/${c1.id}/offer-letter`)).data.body;
  assert.match(letter, /Asha/); assert.match(letter, /55,000/); assert.match(letter, /1 April 2030/);

  r = await req(`/candidates/${c2.id}`, { method: "PUT", body: { stage: "Joined", override: true } });
  assert.equal(r.status, 200);
  const events = (await req(`/candidates/${c2.id}`)).data.events.map((e) => e.type);
  assert.ok(events.includes("override"));
});

test("candidate self-booking takes a slot, confirms, and blocks double booking", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Rohit Nair", phone: "+91 98888 22222", role_id: 1 } })).data;
  await req(`/candidates/${c.id}`, { method: "PUT", body: { stage: "Shortlist" } });
  const full = (await req(`/candidates/${c.id}`)).data;
  const tok = full.booking_link.split("/").pop();
  const page = (await req(`/public/book/${tok}`, { auth: false })).data;
  assert.ok(page.open.length >= 2);
  const b = await req(`/public/book/${tok}`, { method: "POST", body: { slot_id: page.open[0].id }, auth: false });
  assert.equal(b.status, 200);
  const again = await req(`/public/book/${tok}`, { method: "POST", body: { slot_id: page.open[0].id }, auth: false });
  assert.equal(again.status, 409);
  const after = (await req(`/candidates/${c.id}`)).data;
  assert.equal(after.stage, "Leadership interview"); assert.ok(after.interview_at);
  const ics = (await req(`/candidates/${c.id}/calendar.ics`, { raw: true })).data; assert.match(ics, /BEGIN:VEVENT/);
});

test("panel scoring link works without login and lands on the candidate", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Meera Iyer", role_id: 1 } })).data;
  await req(`/candidates/${c.id}`, { method: "PUT", body: { stage: "Demo lesson" } });
  const ev = (await req(`/candidates/${c.id}/evaluations`, { method: "POST", body: { panelist: "Principal" } })).data;
  const form = (await req(`/public/score/${ev.token}`, { auth: false })).data;
  assert.equal(form.rubric.length, 5);
  const sub = await req(`/public/score/${ev.token}`, { method: "POST", body: { scores: { planning: 4, engagement: 5, management: 4, subject: 5, reflection: 3 }, recommendation: "Hire", comment: "Warm with the class" }, auth: false });
  assert.equal(sub.status, 200);
  const full = (await req(`/candidates/${c.id}`)).data;
  assert.equal(full.evaluations[0].recommendation, "Hire");
});

test("hiring manager sees only shortlisted candidates for assigned roles and cannot change stage", async () => {
  await req("/users", { method: "POST", body: { name: "Principal P", email: "p@hps.test", password: "password123", role: "manager" } });
  const roles = (await req("/roles")).data;
  const me = (await req("/users")).data.find((u) => u.email === "p@hps.test");
  await req(`/roles/${roles[0].id}`, { method: "PUT", body: { manager_id: me.id } });
  const mgr = (await req("/auth/login", { method: "POST", body: { email: "p@hps.test", password: "password123" }, auth: false })).data.token;
  const saved = token; token = mgr;
  const list = (await req("/candidates")).data;
  assert.ok(list.length > 0); assert.ok(list.every((c) => !["Applied", "Screened", "AI interview", "Screening call"].includes(c.stage)));
  const r = await req(`/candidates/${list[0].id}`, { method: "PUT", body: { stage: "Not now" } });
  assert.equal(r.status, 403);
  assert.equal((await req("/candidates", { method: "POST", body: { name: "X" } })).status, 403);
  token = saved;
});

test("export and purge (data protection), analytics and audit respond", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Temp Person", email: "temp@x.in", role_id: 2 } })).data;
  const ex = (await req(`/candidates/${c.id}/export`)).data; assert.equal(ex.candidate.name, "Temp Person");
  assert.equal((await req(`/candidates/${c.id}/purge`, { method: "DELETE" })).data.ok, true);
  assert.equal((await req(`/candidates/${c.id}`)).status, 404);
  const a = (await req("/analytics")).data; assert.ok(a.sources.length > 0); assert.ok(a.roles.length > 0);
  const audit = (await req("/audit")).data; assert.ok(audit.some((x) => x.summary.includes("purged")));
  assert.equal((await req("/retention/run", { method: "POST" })).status, 200);
});

test("public endpoints are rate limited and reject junk", async () => {
  assert.equal((await req("/public/interview/nope", { auth: false })).status, 404);
  assert.equal((await req("/public/score/nope", { auth: false })).status, 404);
  assert.equal((await req("/public/book/nope", { auth: false })).status, 404);
  const r = await fetch(BASE + "/public/roles"); assert.ok(r.headers.get("ratelimit-limit"));
});

test("automation rules fire on stage change and screening score", async () => {
  const rules = (await req("/rules")).data.rules; assert.ok(rules.length >= 6);
  const notNow = rules.find((r) => r.name.startsWith("Moved to Not now"));
  await req(`/rules/${notNow.id}`, { method: "PUT", body: { enabled: 1 } });
  const c = (await req("/candidates", { method: "POST", body: { name: "Rule Test", phone: "+91 97777 33333", role_id: 2 } })).data;
  const r = await req(`/candidates/${c.id}`, { method: "PUT", body: { stage: "Not now" } });
  assert.ok(r.data.automation.some((a) => a.includes("send_message")));
  const full = (await req(`/candidates/${c.id}`)).data;
  assert.equal(full.messages.length, 1); assert.match(full.messages[0].body, /thank you for taking the time/i);
  assert.ok(full.events.some((e) => e.type === "rule"));
  const made = await req("/rules", { method: "POST", body: { name: "Custom", trigger: "stage_change", conditions: { stage: "Shortlist" }, actions: [{ type: "add_note", text: "Shortlisted by rule" }] } });
  assert.equal(made.status, 201);
  await req(`/candidates/${c.id}`, { method: "PUT", body: { stage: "Shortlist" } });
  assert.match((await req(`/candidates/${c.id}`)).data.notes, /Shortlisted by rule/);
});

test("share link, report page, and rotation revokes the old link", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Share Me", role_id: 1, resume_text: "B.Ed, 4 years" } })).data;
  const full = (await req(`/candidates/${c.id}`)).data; const tok = full.share_link.split("/").pop();
  const rep = (await req(`/public/report/${tok}`, { auth: false })).data; assert.equal(rep.name, "Share Me"); assert.ok(rep.criteria.length);
  await req(`/candidates/${c.id}/share/rotate`, { method: "POST" });
  assert.equal((await req(`/public/report/${tok}`, { auth: false })).status, 404);
});

test("API keys authenticate and are revocable", async () => {
  const k = (await req("/api-keys", { method: "POST", body: { name: "Website" } })).data; assert.match(k.key, /^hph_/);
  const r = await fetch(BASE + "/roles", { headers: { "X-API-Key": k.key } }); assert.equal(r.status, 200);
  const list = (await req("/api-keys")).data; assert.ok(list[0].last_used);
  await req(`/api-keys/${list[0].id}`, { method: "DELETE" });
  assert.equal((await fetch(BASE + "/roles", { headers: { "X-API-Key": k.key } })).status, 401);
  assert.ok((await req("/docs")).data.endpoints);
});

test("FAQ bot without AI flags the candidate for a human; inbox lists them", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Asker", phone: "+91 96666 44444", role_id: 1 } })).data;
  const faqs = (await req("/faqs")).data; assert.ok(faqs.length >= 5);
  const r = (await req("/faqs/test", { method: "POST", body: { candidate_id: c.id, text: "Where is the school?" } })).data;
  assert.equal(r.replied, false);
  const inbox = (await req("/inbox")).data; assert.ok(inbox.some((x) => x.id === c.id));
  await req(`/candidates/${c.id}`, { method: "PUT", body: { needs_human: 0 } });
  assert.ok(!(await req("/inbox")).data.some((x) => x.id === c.id));
});

test("campus scoping limits a recruiter to their campus but keeps the talent pool shared", async () => {
  const sc = (await req("/roles", { method: "POST", body: { title: "Suncity Librarian", campus: "Suncity", criteria: [], questions: ["Why libraries?"] } })).data;
  await req("/candidates", { method: "POST", body: { name: "Suncity Person", role_id: sc.id } });
  const pooled = (await req("/candidates", { method: "POST", body: { name: "Pooled Noida", role_id: 1 } })).data;
  await req(`/candidates/${pooled.id}`, { method: "PUT", body: { stage: "Talent pool" } });
  await req("/users", { method: "POST", body: { name: "Suncity Recruiter", email: "s@hps.test", password: "password123", role: "recruiter" } });
  const u = (await req("/users")).data.find((x) => x.email === "s@hps.test");
  await req(`/users/${u.id}/campuses`, { method: "PUT", body: { campuses: ["Suncity"] } });
  const tok = (await req("/auth/login", { method: "POST", body: { email: "s@hps.test", password: "password123" }, auth: false })).data.token;
  const saved = token; token = tok;
  const roles = (await req("/roles")).data; assert.ok(roles.every((r) => r.campus === "Suncity"));
  const cands = (await req("/candidates")).data;
  assert.ok(cands.some((c) => c.name === "Suncity Person")); assert.ok(cands.some((c) => c.name === "Pooled Noida")); assert.ok(!cands.some((c) => c.name === "Share Me"));
  token = saved;
});

test("screening queue accepts work and reports progress", async () => {
  const q = (await req("/candidates/screen-all", { method: "POST", body: {} })).data;
  assert.ok("queued" in q); const st = (await req("/candidates/queue")).data; assert.ok("pending" in st && "active" in st);
});

test("SMS channel is accepted and falls back to a link when no gateway is configured", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Sms Person", phone: "9955511111", role_id: 1 } })).data;
  const r = (await req(`/candidates/${c.id}/messages`, { method: "POST", body: { channel: "sms", body: "Hello" } })).data;
  assert.equal(r.status, "manual"); assert.match(r.link, /^sms:/);
});

test("setup wizard reports status and runs safe tests", async () => {
  const s = (await req("/setup")).data; assert.ok(s.items.length > 8); assert.ok(s.items.find((i) => i.key === "admin") && !s.items.find((i) => i.key === "admin").ok);
  const ai = (await req("/setup/test/ai", { method: "POST", body: {} })).data; assert.equal(ai.ok, false); assert.match(ai.message, /ANTHROPIC_API_KEY/);
  const reg = (await req("/setup/whatsapp/register", { method: "POST", body: {} })).data; assert.equal(reg.ok, false);
});

test("video answers are stored encrypted, streamed by signed link, and erased with the candidate", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Video Person", role_id: 1 } })).data;
  const iv = (await req(`/candidates/${c.id}/interviews`, { method: "POST", body: {} })).data;
  const fake = Buffer.alloc(5000, 7);
  const up = await fetch(`${BASE}/public/interview/${iv.token}/clip/0?seconds=12`, { method: "POST", headers: { "Content-Type": "video/webm" }, body: fake });
  assert.equal(up.status, 200);
  const full = (await req(`/candidates/${c.id}`)).data; const ivId = full.interviews[0].id;
  assert.equal(full.interviews[0].clips.length, 1);
  const links = (await req(`/candidates/${c.id}/interviews/${ivId}/clips`)).data.clips; assert.equal(links.length, 1); assert.equal(links[0].seconds, 12);
  const play = await fetch(links[0].url.replace("http://test.local/api", BASE)); assert.equal(play.status, 200); const body = Buffer.from(await play.arrayBuffer()); assert.equal(body.length, 5000); assert.equal(body[0], 7);
  assert.equal((await fetch(BASE + "/public/clip/1.0.1.bad")).status, 403);
  const stored = fs.readdirSync(path.join(dir, "files", "clips")); assert.equal(stored.length, 1);
  assert.notEqual(fs.readFileSync(path.join(dir, "files", "clips", stored[0]))[40], 7); // ciphertext, not the plain bytes
  await req(`/candidates/${c.id}/purge`, { method: "DELETE" });
  assert.equal(fs.readdirSync(path.join(dir, "files", "clips")).length, 0);
});

test("candidate can see their transcription and add a correction note", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Note Person", role_id: 1 } })).data;
  const iv = (await req(`/candidates/${c.id}/interviews`, { method: "POST", body: {} })).data;
  const tr0 = (await req(`/public/interview/${iv.token}/transcript/0`, { auth: false })).data; assert.equal(tr0.ready, true);
  const n = await req(`/public/interview/${iv.token}/transcript/0/note`, { method: "POST", body: { note: "I said inquiry, not enquiry" }, auth: false });
  assert.equal(n.status, 200);
  const events = (await req(`/candidates/${c.id}`)).data.events; assert.ok(events.some((e) => e.type === "transcript_note"));
});


test("HR process: requisition needs Director approval before it is public", async () => {
  const mgr = (await req("/auth/login", { method: "POST", body: { email: "p@hps.test", password: "password123" }, auth: false })).data.token;
  const saved = token; token = mgr;
  const bad = await req("/roles", { method: "POST", body: { title: "Maths Teacher", justification: "" } }); assert.equal(bad.status, 400);
  const rq = (await req("/roles", { method: "POST", body: { title: "Maths Teacher Grade 6", department: "Middle", grade: "6", subject: "Maths", justification: "Retirement of Mr Sharma", criteria: [], questions: ["Why maths?"] } })).data;
  assert.equal(rq.status, "requested");
  token = saved;
  const pub = (await req("/public/roles", { auth: false })).data; assert.ok(!pub.some((r) => r.id === rq.id));
  const pending = (await req("/requisitions")).data; assert.ok(pending.some((r) => r.id === rq.id && r.requested_by_name === "Principal P"));
  const ok = (await req(`/roles/${rq.id}/approve`, { method: "POST", body: { decision: "approved" } })).data; assert.equal(ok.status, "open"); assert.ok(ok.approved_by_name);
  assert.ok((await req("/public/roles", { auth: false })).data.some((r) => r.id === rq.id));
});

test("HR process: referrals need a referrer; screening call moves the candidate; written assessment records", async () => {
  const bad = await req("/candidates", { method: "POST", body: { name: "Ref Person", role_id: 1, source: "Referral" } }); assert.equal(bad.status, 500);
  const c = (await req("/candidates", { method: "POST", body: { name: "Ref Person", role_id: 1, source: "Referral", referrer: "Ms Gupta", location: "Indirapuram, 6 km" } })).data; assert.equal(c.referrer, "Ms Gupta");
  await req(`/candidates/${c.id}`, { method: "PUT", body: { stage: "Screening call" } });
  const sc = (await req(`/candidates/${c.id}/screening-call`, { method: "PUT", body: { outcome: "proceed", notes: "Interested, 30 days notice", notice_period: "30 days", expected_salary: "60k" } })).data;
  assert.equal(sc.stage, "Shortlist"); assert.equal(sc.notice_period, "30 days"); assert.equal(sc.screening_call.by, "Arunabh Singh");
  const w = (await req(`/candidates/${c.id}/interviews`, { method: "POST", body: { kind: "written" } })).data; assert.equal(w.kind, "written");
  const page = (await req(`/public/written/${w.token}`, { auth: false })).data; assert.match(page.prompt, /homework/);
  await req(`/public/written/${w.token}/start`, { method: "POST", body: {}, auth: false });
  const sub = await req(`/public/written/${w.token}/submit`, { method: "POST", body: { text: "Dear parents, from this term we would like to change how homework works. ".repeat(3) }, auth: false }); assert.equal(sub.status, 200);
  const full = (await req(`/candidates/${c.id}`)).data; assert.equal(full.interviews[0].kind, "written"); assert.equal(full.interviews[0].status, "completed");
  const cons = (await req(`/candidates/${c.id}/consolidated`)).data; assert.equal(cons.rounds.length, 3); assert.match(cons.material, /Written assessment: submitted/);
});

test("HR process: letters get reference numbers, need Executive Head approval before issue, and are tracked", async () => {
  const c = (await req("/candidates", { method: "POST", body: { name: "Letter Person", role_id: 1, email: "lp@x.in" } })).data;
  await req(`/candidates/${c.id}`, { method: "PUT", body: { salary: "INR 50,000 per month", join_date: "2030-06-01" } });
  const l = (await req(`/candidates/${c.id}/letters`, { method: "POST", body: { type: "offer" } })).data;
  assert.match(l.ref_no, /^HPS\/HR\/OFR\/\d{4}\/0001$/); assert.match(l.body, /50,000/); assert.match(l.body, /Primary Coordinator/); assert.match(l.body, new RegExp(l.ref_no.replace(/\//g, "\\/")));
  const notYet = await req(`/candidates/${c.id}/letters/${l.id}/issue`, { method: "POST", body: { via: "print" } }); assert.equal(notYet.status, 400);
  await req(`/candidates/${c.id}/letters/${l.id}/approve`, { method: "POST", body: {} });
  const issued = (await req(`/candidates/${c.id}/letters/${l.id}/issue`, { method: "POST", body: { via: "print" } })).data; assert.equal(issued.status, "issued");
  const l2 = (await req(`/candidates/${c.id}/letters`, { method: "POST", body: { type: "appointment" } })).data; assert.match(l2.ref_no, /APT\/\d{4}\/0001$/);
  const tracker = (await req("/letters")).data; assert.ok(tracker.length >= 2); assert.ok(tracker.some((x) => x.ref_no === l.ref_no && x.status === "issued"));
  const checks = (await req(`/candidates/${c.id}/checks`)).data; assert.ok(checks.some((k) => k.key === "it_notified" && k.owner === "IT/Admin" && k.phase === "Pre-boarding")); assert.ok(checks.some((k) => k.key === "employment"));
});
