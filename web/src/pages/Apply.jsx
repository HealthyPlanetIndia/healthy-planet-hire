import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

// Public application page. Link it from the school website, or embed it: <iframe src="https://yourdomain/apply" />
export default function Apply() {
  const { roleId } = useParams(); const [roles, setRoles] = useState([]); const [f, setF] = useState({ role_id: roleId || "", name: "", phone: "", email: "", resume_text: "", location: "", current_employer: "", expected_salary: "", notice_period: "", referrer: "", internal: false }); const [done, setDone] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { api("/public/roles", { auth: false }).then((r) => { setRoles(r); if (!f.role_id && r[0]) setF((x) => ({ ...x, role_id: r[0].id })); }); }, []);
  const role = roles.find((r) => String(r.id) === String(f.role_id));
  if (done) return <Wrap><div className="card"><b>Thank you, {f.name.split(" ")[0]}.</b><p>Your application for {role?.title} has reached us. We review every application against the same criteria and will message you on WhatsApp or email about next steps.</p></div></Wrap>;
  return <Wrap>
    <div className="card">
      <div className="muted" style={{ fontSize: 12 }}>Healthy Planet School</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Work with us</div>
      <label className="field">Role<select value={f.role_id} onChange={(e) => setF({ ...f, role_id: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.title} · {r.campus}</option>)}</select></label>
      {role?.description && <details style={{ fontSize: 13, marginBottom: 10, whiteSpace: "pre-wrap" }}><summary>About this role</summary>{role.description}</details>}
      <label className="field">Full name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field">WhatsApp number<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label className="field">Email<input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label className="field">Where do you live (area and city)? Travel time matters for a school day.<input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Indirapuram, Ghaziabad" /></label>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "0 10px" }}>
        <label className="field">Current school / employer<input value={f.current_employer} onChange={(e) => setF({ ...f, current_employer: e.target.value })} /></label>
        <label className="field">Expected salary<input value={f.expected_salary} onChange={(e) => setF({ ...f, expected_salary: e.target.value })} placeholder="per month" /></label>
        <label className="field">Notice period<input value={f.notice_period} onChange={(e) => setF({ ...f, notice_period: e.target.value })} placeholder="e.g. 30 days" /></label>
      </div>
      <label className="field">Referred by a Healthy Planet or NWS staff member? Their name.<input value={f.referrer} onChange={(e) => setF({ ...f, referrer: e.target.value })} /></label>
      <label style={{ fontSize: 13, display: "block", marginBottom: 10 }}><input type="checkbox" style={{ width: "auto" }} checked={f.internal} onChange={(e) => setF({ ...f, internal: e.target.checked })} /> I currently work at Healthy Planet School or Nehru World School (internal application)</label>
      <label className="field">Paste your CV, or a summary of your qualifications and experience<textarea style={{ minHeight: 140 }} value={f.resume_text} onChange={(e) => setF({ ...f, resume_text: e.target.value })} /></label>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>By applying you agree that Healthy Planet School stores this information for recruitment, keeps it for up to 12 months, and deletes it on request. Write to hr@healthyplanetschool.com to access or delete your data.</div>
      {err && <div style={{ color: "#B0463C", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <button className="primary" style={{ width: "100%" }} disabled={!f.name || !f.role_id || (!f.phone && !f.email)} onClick={async () => { try { await api("/public/apply", { method: "POST", body: f, auth: false }); setDone(true); } catch (e) { setErr(e.message); } }}>Send application</button>
    </div>
  </Wrap>;
}
const Wrap = ({ children }) => <div style={{ minHeight: "100vh", padding: 16, maxWidth: 560, margin: "0 auto" }}>{children}</div>;
