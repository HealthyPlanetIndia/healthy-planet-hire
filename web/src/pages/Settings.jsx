import React, { useEffect, useState } from "react";
import { api, me, isManager } from "../api.js";
import { Field } from "../components/ui.jsx";
import { useToast } from "../components/Shell.jsx";

export default function Settings() {
  const say = useToast(); const [t, setT] = useState({}); const [users, setUsers] = useState([]); const [nu, setNu] = useState({ name: "", email: "", password: "", role: "recruiter" }); const [pw, setPw] = useState(""); const [status, setStatus] = useState(null);
  const admin = me()?.role === "admin"; const [auditLog, setAudit] = useState(null); const [ret, setRet] = useState(null); const [keys, setKeys] = useState([]); const [newKey, setNewKey] = useState(null); const [keyName, setKeyName] = useState("");
  useEffect(() => { if (admin) api("/api-keys").then(setKeys).catch(() => {}); }, []);
  useEffect(() => { if (!isManager()) api("/templates").then(setT); api("/status").then(setStatus); if (admin) api("/users").then(setUsers); }, []);
  if (isManager()) return <div className="card" style={{ maxWidth: 500 }}><b>Your password</b><div className="row" style={{ marginTop: 8 }}><input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ maxWidth: 260 }} /><button disabled={pw.length < 8} onClick={() => api("/me/password", { method: "POST", body: { password: pw } }).then(() => { setPw(""); say("Password changed"); })}>Change</button></div></div>;
  return (
    <div className="grid" style={{ maxWidth: 800 }}>
      <div className="card">
        <b>Message templates</b>
        <div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>Placeholders: {"{name}"}, {"{role}"}, {"{link}"}, {"{slots}"}, {"{deadline}"}, {"{join_date}"}. Filled in automatically when you message a candidate.</div>
        {Object.entries(t).map(([k, v]) => <Field key={k} label={{ followup: "Follow-up nudge", interview_reminder: "Interview reminder (automatic)", offer_letter: "Offer letter ({name}, {role}, {department}, {campus}, {salary}, {join_date}, {date})", demo_lesson: "Demo lesson invitation" }[k] || `When moved to ${k}`}><textarea style={{ minHeight: k === "offer_letter" ? 220 : 70 }} value={v} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></Field>)}
        <div className="row"><button className="primary" onClick={() => api("/templates", { method: "PUT", body: t }).then((r) => { setT(r); say("Templates saved"); })}>Save templates</button><button onClick={() => api("/templates", { method: "DELETE" }).then((r) => { setT(r); say("Reset"); })}>Reset to defaults</button></div>
      </div>
      <div className="card">
        <b>Your password</b>
        <div className="row" style={{ marginTop: 8 }}><input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ maxWidth: 260 }} /><button disabled={pw.length < 8} onClick={() => api("/me/password", { method: "POST", body: { password: pw } }).then(() => { setPw(""); say("Password changed"); })}>Change</button></div>
      </div>
      {admin && <div className="card">
        <b>Team</b>
        <div className="grid" style={{ gap: 6, margin: "8px 0" }}>{users.map((u) => <div key={u.id} className="row" style={{ justifyContent: "space-between", fontSize: 13 }}><span>{u.name} <span className="muted">· {u.email} · {u.role}</span>{status?.campuses?.length > 1 && u.role !== "admin" && <span className="muted"> · campus: <select value={u.campuses?.[0] || ""} onChange={(e) => api(`/users/${u.id}/campuses`, { method: "PUT", body: { campuses: e.target.value ? [e.target.value] : [] } }).then(() => api("/users").then(setUsers))} style={{ width: "auto", padding: "2px 6px", fontSize: 12 }}><option value="">all</option>{status.campuses.map((c) => <option key={c}>{c}</option>)}</select></span>}</span>{u.id !== me().id && <button className="small danger" onClick={() => api(`/users/${u.id}`, { method: "DELETE" }).then(() => setUsers(users.filter((x) => x.id !== u.id)))}>Remove</button>}</div>)}</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 8px" }}>
          <Field label="Name"><input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></Field>
          <Field label="Email"><input value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></Field>
          <Field label="Temporary password"><input value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></Field>
          <Field label="Role"><select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}><option value="recruiter">Recruiter (full pipeline)</option><option value="manager">Hiring manager (shortlist and scoring only)</option><option value="admin">Admin</option></select></Field>
        </div>
        <button disabled={!nu.name || !nu.email || nu.password.length < 8} onClick={() => api("/users", { method: "POST", body: nu }).then(() => { say("Added"); setNu({ name: "", email: "", password: "", role: "recruiter" }); api("/users").then(setUsers); }).catch((e) => say(e.message))}>Add team member</button>
      </div>}
      {admin && <div className="card" style={{ fontSize: 13 }}>
        <b>Integrations (API keys)</b>
        <div className="muted" style={{ margin: "4px 0 8px" }}>Let the school website, ERP or another system talk to this app. Send the key as an <code>X-API-Key</code> header. Endpoint list at <code>/api/docs</code>.</div>
        {keys.map((k) => <div key={k.id} className="row" style={{ justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid var(--line)" }}><span>{k.name} <span className="muted">· {k.prefix}… · {k.last_used ? `last used ${new Date(k.last_used + "Z").toLocaleDateString("en-IN")}` : "never used"}</span></span><button className="small danger" onClick={() => api(`/api-keys/${k.id}`, { method: "DELETE" }).then(() => api("/api-keys").then(setKeys))}>Revoke</button></div>)}
        <div className="row" style={{ marginTop: 8 }}><input placeholder="What is this key for? e.g. School website" value={keyName} onChange={(e) => setKeyName(e.target.value)} style={{ maxWidth: 300 }} /><button disabled={!keyName} onClick={() => api("/api-keys", { method: "POST", body: { name: keyName } }).then((r) => { setNewKey(r.key); setKeyName(""); api("/api-keys").then(setKeys); })}>Create key</button></div>
        {newKey && <div style={{ marginTop: 8, background: "#FDF3D6", padding: 8, borderRadius: 8, wordBreak: "break-all" }}>Copy this now, it is shown once: <code>{newKey}</code></div>}
      </div>}
      {admin && <div className="card" style={{ fontSize: 13 }}>
        <b>Data protection</b>
        <div className="muted" style={{ margin: "4px 0 8px" }}>Camera photos are deleted after {status?.snapshot_days} days. Candidates marked "Not now" are anonymised after {status?.retention_months} months. Both run nightly at 02:30 with a database backup (last 14 kept in server/data/backups). Every applicant sees the privacy notice on the apply and interview pages.</div>
        <div className="row"><button onClick={() => api("/retention/run", { method: "POST" }).then((r) => { setRet(r); say("Retention run complete"); })}>Run retention now</button><button onClick={() => api("/backup", { method: "POST" }).then((r) => say(`Backup saved: ${r.file}`))}>Back up now</button><button onClick={() => api("/audit").then(setAudit)}>Show audit log</button></div>
        {ret && <div className="muted" style={{ marginTop: 6 }}>Cleared photos from {ret.snapshotsCleared} interview{ret.snapshotsCleared === 1 ? "" : "s"}, anonymised {ret.anonymized} candidate{ret.anonymized === 1 ? "" : "s"}.</div>}
        {auditLog && <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto", fontSize: 12 }}>{auditLog.map((a) => <div key={a.id} className="row" style={{ justifyContent: "space-between", padding: "3px 0", borderTop: "1px solid var(--line)" }}><span>{a.user_name}: {a.summary}</span><span className="muted">{new Date(a.created_at + "Z").toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>)}</div>}
      </div>}
      {status && <div className="card" style={{ fontSize: 13 }}>
        <b>Connections</b>
        <div style={{ marginTop: 6 }}>AI: {status.ai ? "connected" : "not set"} · WhatsApp API: {status.whatsapp ? "connected" : "not set"} · Email: {status.email ? "connected" : "not set"} · SMS: {status.sms ? "connected" : "not set"} · Video (Daily.co): {status.video ? "connected" : "not set"}</div>
        <div className="muted" style={{ marginTop: 6 }}>Public pages you can share: <code>{status.public_url}/apply</code> for the careers page (embed it in an iframe or link to it), and <code>{status.public_url}/api/public/jobs.xml</code> is an Indeed-compatible job feed for open roles.</div>
        <div className="muted" style={{ marginTop: 6 }}>These are configured in <code>server/.env</code> by whoever hosts the app. Until WhatsApp and email are connected, sending opens the message in your own WhatsApp or mail app and logs it here.</div>
      </div>}
    </div>
  );
}
