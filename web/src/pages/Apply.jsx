import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { PhoneInput, phoneValid } from "../components/ui.jsx";

// Public application page. Link it from the school website, or embed it: <iframe src="https://yourdomain/apply" />
export default function Apply() {
  const { roleId } = useParams(); const nav = useNavigate(); const [roles, setRoles] = useState([]); const [campus, setCampus] = useState(""); const [f, setF] = useState({ role_id: roleId || "", name: "", phone: "", email: "", resume_text: "", location: "", current_employer: "", expected_salary: "", notice_period: "", referrer: "", internal: false }); const [done, setDone] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [file, setFile] = useState(null); const [fileKey, setFileKey] = useState(0); const [extra, setExtra] = useState([]);
  useEffect(() => { api("/public/roles", { auth: false }).then(setRoles); }, []);
  useEffect(() => { if (roleId) setF((x) => ({ ...x, role_id: roleId })); }, [roleId]);
  const general = roleId === "general";
  const role = general ? { title: "General application", campus: "any campus", description: "" } : roles.find((r) => String(r.id) === String(f.role_id));
  const campuses = [...new Set(roles.map((r) => r.campus).filter(Boolean))];
  const colour = (c) => /sun ?city|ghaziabad/i.test(c || "") ? "var(--blue)" : /wishtown|noida/i.test(c || "") ? "var(--green)" : "var(--yellow)";
  const light = (c) => /sun ?city|ghaziabad|wishtown|noida/i.test(c || "");

  // Listing: one tile per open role, campus shown clearly
  if (!roleId) return <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
    <div style={{ background: "var(--green)", color: "#fff", padding: "28px 16px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }} className="row">
        <span style={{ width: 44, height: 44, borderRadius: 12, background: "#fff", color: "var(--green)", fontFamily: "var(--font-brand)", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 17 }}>HP</span>
        <div><div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>Work with us</div><div style={{ opacity: .85, fontSize: 13 }}>Healthy Planet School · open positions across our campuses</div></div>
      </div>
    </div>
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <p className="muted" style={{ lineHeight: 1.5, marginTop: 4 }}>We believe classrooms, corridors and relationships teach as much as any curriculum. If that sounds like how you want to work, find your role below. Every application is read against the same criteria and everyone hears back from us.</p>
      {campuses.length > 1 && <div className="row" style={{ margin: "10px 0 16px" }}><button className={`small ${!campus ? "primary" : ""}`} onClick={() => setCampus("")}>All campuses</button>{campuses.map((c) => <button key={c} className={`small ${campus === c ? "primary" : ""}`} onClick={() => setCampus(c)}>{c}</button>)}</div>}
      {roles.length === 0 && <div className="card muted">No open positions right now. Check back soon, or write to hr@healthyplanetschool.com.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {roles.filter((r) => !campus || r.campus === campus).map((r) => <Link key={r.id} to={`/apply/${r.id}`} className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8, borderTop: `5px solid ${colour(r.campus)}`, transition: "transform .12s" }} onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
          <span className="pill" style={{ alignSelf: "flex-start", background: colour(r.campus), color: light(r.campus) ? "#fff" : "#000", fontWeight: 500 }}>{r.campus}</span>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{r.title}</div>
          <div className="muted" style={{ fontSize: 13 }}>{[r.department, r.grade, r.subject].filter(Boolean).join(" · ")}</div>
          {r.description && <div className="muted" style={{ fontSize: 13, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.description.replace(/^#+.*$/gm, "").trim()}</div>}
          {r.salary_band && <div style={{ fontSize: 13 }}>{r.salary_band}</div>}
          <div style={{ marginTop: "auto", color: "var(--green)", fontWeight: 500, fontSize: 13 }}>View and apply →</div>
        </Link>)}
        <Link to="/apply/general" className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8, borderTop: "5px solid var(--yellow)", background: "var(--yellow-tint, #FFF6D8)" }}>
          <span className="pill" style={{ alignSelf: "flex-start", background: "var(--yellow)", color: "#000", fontWeight: 500 }}>Any campus, any time</span>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>Don't see your role?</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>Send us your resume anyway. We keep it on file and reach out when a suitable opening comes up at either campus.</div>
          <div style={{ marginTop: "auto", color: "var(--green-ink, var(--green))", fontWeight: 500, fontSize: 13 }}>Send a general application →</div>
        </Link>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 24 }}>Applications are used for recruitment only, kept for up to 12 months, and deleted on request. hr@healthyplanetschool.com</div>
    </div>
  </div>;
  if (done) return <Wrap><div className="card"><b>Thank you, {f.name.split(" ")[0]}.</b>{done.general ? <p>Your resume is now in the school's talent pool. There is no matching opening today, but we look through the pool whenever a role opens at either campus, and we will message you on WhatsApp or email when one fits.</p> : <p>Your application for <b>{done.role || role?.title}</b> at <b>{done.campus || role?.campus}</b> has reached us{done.count > 1 ? `, and you will be considered separately for each of the ${done.count} roles` : ""}. We review every application against the same criteria and will message you on WhatsApp or email about next steps.</p>}
    <div className="row" style={{ marginTop: 12 }}><button className="primary" onClick={() => { setDone(false); setErr(""); setFile(null); setFileKey((k) => k + 1); setExtra([]); setF({ role_id: roleId && roleId !== "general" ? roleId : "", name: "", phone: "", email: "", resume_text: "", location: "", current_employer: "", expected_salary: "", notice_period: "", referrer: "", internal: false }); window.scrollTo(0, 0); }}>Send another application</button><Link to="/apply"><button>Back to all roles</button></Link></div><Link to="/apply" className="link" style={{ fontSize: 13 }}>Back to all positions</Link></div></Wrap>;
  if (roles.length && !role && !general) return <Wrap><div className="card">This position is no longer open. <Link to="/apply">See current openings</Link>.</div></Wrap>;
  return <Wrap>
    <Link to="/apply" className="link" style={{ fontSize: 13, display: "inline-block", marginBottom: 10 }}>← All positions</Link>
    <div className="card" style={{ borderTop: `5px solid ${colour(role?.campus)}` }}>
      <span className="pill" style={{ background: colour(role?.campus), color: light(role?.campus) ? "#fff" : "#000", fontWeight: 500 }}>{role?.campus}</span>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{role?.title}</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{[role?.department, role?.grade, role?.subject, role?.salary_band].filter(Boolean).join(" · ")}</div>
      {role?.description && <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", background: "var(--soft)", borderRadius: 10, padding: 12, marginBottom: 14 }}>{role.description}</div>}
      {general && <div style={{ fontSize: 14, lineHeight: 1.55, background: "var(--soft)", borderRadius: 10, padding: 12, marginBottom: 14 }}>Tell us who you are and what you do best. Your resume goes into the school's talent pool and we contact you when a role fits, at either campus. Nothing is shared outside the school.</div>}
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{general ? "Send a general application" : "Apply for this role"}</div>
      {!general && roles.filter((r) => String(r.id) !== String(f.role_id)).length > 0 && <div style={{ fontSize: 13, background: "var(--soft)", borderRadius: 10, padding: 12, marginBottom: 12 }}><div style={{ fontWeight: 500, marginBottom: 6 }}>Also consider me for</div>{roles.filter((r) => String(r.id) !== String(f.role_id)).map((r) => <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0" }}><input type="checkbox" style={{ width: "auto", marginTop: 3 }} checked={extra.includes(String(r.id))} onChange={(e) => setExtra(e.target.checked ? [...extra, String(r.id)] : extra.filter((x) => x !== String(r.id)))} /><span>{r.title} <span className="muted">· {r.campus}</span></span></label>)}<div className="muted" style={{ fontSize: 12, marginTop: 4 }}>One form, one resume; you will be considered separately for each.</div></div>}
      <label className="field">Full name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field">WhatsApp mobile number<PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></label>
      <label className="field">Email<input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label className="field">Where do you live (area and city)? Travel time matters for a school day.<input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Indirapuram, Ghaziabad" /></label>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "0 10px" }}>
        <label className="field">Current school / employer<input value={f.current_employer} onChange={(e) => setF({ ...f, current_employer: e.target.value })} /></label>
        <label className="field">Expected salary<input value={f.expected_salary} onChange={(e) => setF({ ...f, expected_salary: e.target.value })} placeholder="per month" /></label>
        <label className="field">Notice period<input value={f.notice_period} onChange={(e) => setF({ ...f, notice_period: e.target.value })} placeholder="e.g. 30 days" /></label>
      </div>
      <label className="field">Referred by a Healthy Planet or NWS staff member? Their name.<input value={f.referrer} onChange={(e) => setF({ ...f, referrer: e.target.value })} /></label>
      <label style={{ fontSize: 13, display: "block", marginBottom: 10 }}><input type="checkbox" style={{ width: "auto" }} checked={f.internal} onChange={(e) => setF({ ...f, internal: e.target.checked })} /> I currently work at Healthy Planet School or Nehru World School (internal application)</label>
      <div className="field" style={{ display: "block", fontSize: 12, color: "var(--mute)", marginBottom: 10 }}>Upload your resume (PDF or Word)
        {!file ? <input key={fileKey} type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files[0] || null)} style={{ marginTop: 4 }} />
          : <div className="row" style={{ marginTop: 6, background: "var(--soft)", borderRadius: 8, padding: "8px 10px", color: "var(--ink)", fontSize: 13 }}><span style={{ flex: 1 }}>{file.name} · {Math.round(file.size / 1024)} KB</span><button type="button" className="small" onClick={() => { setFile(null); setFileKey((k) => k + 1); }}>Remove</button><label className="small" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>Choose another<input type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }} /></label></div>}
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>By applying you consent to Healthy Planet School using this information for recruitment only, keeping it for up to 12 months, restricting access to authorised staff and taking reasonable measures to protect it. Write to hr@healthyplanetschool.com to access, correct or delete your data.</div>
      {err && <div style={{ color: "#B0463C", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <button className="primary" style={{ width: "100%" }} disabled={busy || !f.name || (!general && !f.role_id) || (!f.phone && !f.email) || !phoneValid(f.phone) || !file} onClick={async () => { setBusy(true); try { const fd = new FormData(); Object.entries(f).forEach(([k, v]) => { if (k !== "resume_text" && k !== "role_id") fd.append(k, v); }); if (!general) fd.append("role_id", f.role_id); fd.append("role_ids", JSON.stringify(extra)); fd.append("general", String(general)); fd.append("resume", file); const r = await api("/public/apply", { method: "POST", form: fd, auth: false }); setDone(r); } catch (e) { setErr(e.message); } setBusy(false); }}>{busy ? "Sending..." : general ? "Send my resume to the talent pool" : extra.length ? `Send application for ${1 + extra.length} roles` : `Send application for ${role?.title || "this role"}, ${role?.campus || ""}`}</button>
    </div>
  </Wrap>;
}
const Wrap = ({ children }) => <div style={{ minHeight: "100vh", padding: 16, maxWidth: 560, margin: "0 auto" }}>{children}</div>;
