import React, { useEffect, useState } from "react";
import { api, daysSince, STAGES, ROUNDS, isManager, isAdmin, fmtDT, t } from "../api.js";
import { Field, Score, Pill } from "./ui.jsx";
import { useToast } from "./Shell.jsx";

export default function CandidatePanel({ id, roles, onClose }) {
  const say = useToast();
  const [c, setC] = useState(null); const [tab, setTab] = useState("report"); const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(""); const [slots, setSlots] = useState(""); const [file, setFile] = useState(null);
  const load = () => api(`/candidates/${id}`).then(setC);
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (c) api(`/candidates/${id}/message-draft?slots=${encodeURIComponent(slots)}`).then((r) => setMsg(r.body)); }, [c?.stage, slots]);

  const [blockers, setBlockers] = useState(null);
  const save = async (patch) => { try { const r = await api(`/candidates/${id}`, { method: "PUT", body: patch }); setC((x) => ({ ...x, ...r })); if (patch.stage) { say(`Moved to ${patch.stage}`); load(); } } catch (e) {
    if (e.message.includes("verification checks")) { setBlockers({ stage: patch.stage }); setTab("checks"); say(e.message); } else if (e.message.includes("Director")) { setTab("process"); say(e.message); } else say(e.message); } };
  const run = async (label, fn) => { setBusy(label); try { await fn(); await load(); } catch (e) { say(e.message); } setBusy(""); };
  const send = (channel) => run("send", async () => { const r = await api(`/candidates/${id}/messages`, { method: "POST", body: { channel, body: msg } }); if (r.link) { window.open(r.link, "_blank"); say("Opened in your app; message logged"); } else say(`Sent on ${channel}`); });
  const interviewLink = (sendVia) => run("iv", async () => { const r = await api(`/candidates/${id}/interviews`, { method: "POST", body: { send: sendVia, language: "en" } }); if (r.delivery?.link) window.open(r.delivery.link, "_blank"); else if (!sendVia) { await navigator.clipboard?.writeText(r.link); say("Interview link copied"); } else say("Interview link sent"); });
  const uploadResume = () => run("up", async () => { const fd = new FormData(); fd.append("resume", file); await api(`/candidates/${id}`, { method: "PUT", form: fd }); setFile(null); say("Resume read"); });

  if (!c) return null;
  const s = c.screening, iv = c.interviews?.[0], role = c.role;
  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} onBlur={() => save({ name: c.name })} style={{ fontSize: 20, fontWeight: 700, border: "none", background: "transparent", padding: 0 }} />
            <select value={c.role_id || ""} onChange={(e) => save({ role_id: e.target.value })} style={{ width: "auto", marginTop: 4 }}>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
          </div>
          <button className="small" onClick={onClose}>Close</button>
        </div>
        <div className="row" style={{ margin: "12px 0" }}>
          {!isManager() && <select value={c.stage} onChange={(e) => save({ stage: e.target.value })} style={{ width: "auto", fontWeight: 500 }}>{STAGES.map((st) => <option key={st}>{st}</option>)}</select>}
          {isManager() && <span className="pill" style={{ background: "var(--soft)" }}>{c.stage}</span>}
          {!isManager() && <>
            <button className="primary" disabled={!!busy} onClick={() => run("screen", () => api(`/candidates/${id}/screen`, { method: "POST" }))}>{busy === "screen" ? "Screening..." : s ? t("Re-screen") : t("Screen resume")}</button>
            <button className="warm" disabled={!!busy} onClick={() => interviewLink(c.phone ? "whatsapp" : c.email ? "email" : null)}>{busy === "iv" ? "Creating..." : t("Send AI interview")}</button>
            <button className="small" disabled={!!busy} onClick={() => interviewLink(null)}>Copy link only</button>
            <button className="small" onClick={() => { navigator.clipboard?.writeText(c.share_link); say("Report link copied. Anyone with it can read the report; rotate it under History to revoke."); }}>Share report</button>
            <button className="small" disabled={!!busy} onClick={() => run("iv", async () => { const r = await api(`/candidates/${id}/interviews`, { method: "POST", body: { mode: "text", send: c.phone ? "whatsapp" : "email" } }); if (r.delivery?.link) window.open(r.delivery.link, "_blank"); say("Typed interview link sent (accessibility fallback)"); })}>Typed version</button>
          </>}
        </div>
        {c.duplicates?.length > 0 && <div style={{ background: "#FDF3D6", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 }}><b>Possible duplicate.</b> {c.duplicates.map((d) => `${d.name} (${d.reason}, ${d.role_title || "no role"}, ${d.stage})`).join("; ")}. Check before contacting twice.</div>}
        {c.interview_at && <div style={{ background: "#EAF1FB", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 }} className="row"><span style={{ flex: 1 }}><b>Booked:</b> {fmtDT(c.interview_at)}{c.slot?.location && ` · ${c.slot.location}`}</span><a className="small" style={{ fontSize: 12 }} href={`/api/candidates/${id}/calendar.ics`} onClick={async (e) => { e.preventDefault(); const r = await api(`/candidates/${id}/calendar-link`); window.open(r.google, "_blank"); }}>Add to Google Calendar</a></div>}
        <div className="tabs">{[["report", t("Report")], ["process", "Rounds & review"], ["checks", t("Checks")], ...(["HR discussion", "Offer", "Joined"].includes(c.stage) || blockers ? [["offer", "Offer & letters"]] : []), ...(isManager() ? [] : [["message", t("Message")]]), ["resume", t("Resume & notes")], ["history", t("History")]].map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>

        {tab === "report" && <div className="grid">
          {!s && <div className="card muted">No screening yet. Add a resume, then press Screen resume. Every applicant for this role is judged against the same {role?.criteria?.length || 0} criteria.</div>}
          {s && <div className="card">
            <div className="row" style={{ gap: 14 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", border: `5px solid ${s.overall >= 75 ? "var(--green)" : s.overall >= 55 ? "var(--yellow)" : "var(--coral)"}`, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20 }}>{s.overall}</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, textTransform: "capitalize" }}>{s.recommendation}</div><div className="muted" style={{ fontSize: 13 }}>{s.summary}</div></div>
            </div>
            <div className="grid" style={{ marginTop: 14, gap: 8 }}>
              {(s.criteria || []).map((cr) => { const def = role?.criteria?.find((x) => x.id === cr.id); return (
                <div key={cr.id} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}><span>{def?.text || cr.id}{def?.must && <span className="muted" style={{ fontSize: 11 }}> · must-have</span>}</span><Pill v={cr.verdict} /></div>
                  {cr.evidence && <div className="evidence">“{cr.evidence}”</div>}
                  {cr.note && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{cr.note}</div>}
                </div>); })}
            </div>
            {s.flags?.filter(Boolean).length > 0 && <div style={{ marginTop: 10, fontSize: 13, color: "#8A6A10" }}>Check: {s.flags.filter(Boolean).join("; ")}</div>}
            {s.questions_to_probe?.length > 0 && <div style={{ marginTop: 12, fontSize: 13 }}><div style={{ fontWeight: 500 }}>Worth probing at interview</div><ul className="muted" style={{ margin: "4px 0 0", paddingLeft: 18 }}>{s.questions_to_probe.map((q, i) => <li key={i}>{q}</li>)}</ul></div>}
          </div>}
          {iv && <div className="card" style={{ borderColor: "var(--blue)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}><b>AI interview</b><span className="muted" style={{ fontSize: 12 }}>{iv.status.replace("_", " ")}{iv.report && <> · <Score v={iv.report.overall} /></>}</span></div>
            {iv.kind === "video" && iv.recording_id && <div className="row" style={{ marginTop: 6 }}><button className="small" onClick={async () => { try { const r = await api(`/candidates/${id}/interviews/${iv.id}/recording`); window.open(r.url, "_blank"); say(`Viewing link valid for ${r.expires_in_minutes} minutes; this view is logged`); } catch (e) { say(e.message); } }}>Watch recording</button><span className="muted" style={{ fontSize: 12 }}>Stored encrypted at Daily.co, private. Deleted after 90 days or when the candidate is erased.</span></div>}
            {iv.kind === "video" && !iv.recording_id && iv.status === "completed" && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Recording is being processed.</div>}
            {!iv.report && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{iv.status === "pending" ? `Link sent, not yet opened. Expires ${new Date(iv.expires_at).toLocaleDateString("en-IN")}.` : iv.status === "in_progress" ? "Candidate is mid-interview." : "Report is being written, refresh in a moment."}<br /><span style={{ wordBreak: "break-all" }}>{iv.link}</span></div>}
            {iv.clips?.length > 0 && <Clips candId={id} iv={iv} say={say} />}
            {iv.kind !== "written" && iv.status === "completed" && !(iv.clips?.length) && <div style={{ marginTop: 8, fontSize: 13, background: "#FDF3D6", borderRadius: 8, padding: "8px 10px" }}><b>No video was recorded.</b> {iv.signals?.some((x) => x.type === "camera_denied") ? "The candidate declined the camera." : iv.signals?.some((x) => x.type === "clip_failed") ? "Uploads failed on the candidate's connection and they continued without video." : "The candidate's device could not record, or the interview was taken before video recording was added."} The transcript below is from the device's own speech recognition.</div>}
            {iv.integrity && <Integrity iv={iv} />}
            {iv.report && iv.report.version === 2 && <ReportV2 iv={iv} c={c} say={say} reload={load} />}
            {iv.report && iv.report.version !== 2 && <>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{iv.report.summary}</div>
              <div className="grid" style={{ marginTop: 10, gap: 6 }}>{(iv.report.dimensions || []).map((d, i) => <div key={i} style={{ fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between" }}><span>{d.name}</span><Score v={d.score} /></div><div className="muted" style={{ fontSize: 12 }}>{d.note}</div></div>)}</div>
              <div style={{ fontSize: 13, marginTop: 10 }}><b>Strengths:</b> {iv.report.strengths}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}><b>Concerns:</b> {iv.report.concerns}</div>
              <div style={{ fontSize: 13, marginTop: 6, fontWeight: 500 }}>Recommendation: {iv.report.recommendation}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Older report format. Press "Rewrite report" below to apply the current assessment rules.</div>
              <button className="small" style={{ marginTop: 6 }} onClick={async () => { try { await api(`/candidates/${id}/interviews/${iv.id}/rereport`, { method: "POST", body: {} }); say("Report rewritten"); load(); } catch (e) { say(e.message); } }}>Rewrite report</button>
            </>}
          </div>}
        </div>}

        {tab === "process" && <Process c={c} id={id} say={say} reload={load} save={save} />}
        {tab === "checks" && <Checks c={c} id={id} say={say} reload={load} blockers={blockers} onOverride={() => save({ stage: blockers.stage, override: true })} />}
        {tab === "offer" && <Letters c={c} id={id} say={say} save={save} reload={load} />}

        {tab === "message" && <div className="card">
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Template for the {c.stage} stage. Edit, then send.</div>
          {["Shortlist", "School interview"].includes(c.stage) && <Field label="Interview slots to offer"><input placeholder="e.g. Tue 16 Sep 10:00, Wed 17 Sep 14:30" value={slots} onChange={(e) => setSlots(e.target.value)} /></Field>}
          {c.stage === "Joined" && <Field label="Joining date"><input type="date" value={c.join_date || ""} onChange={(e) => save({ join_date: e.target.value })} /></Field>}
          <textarea style={{ minHeight: 150 }} value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" disabled={!c.phone || !!busy} onClick={() => send("whatsapp")}>Send on WhatsApp</button>
            <button disabled={!c.email || !!busy} onClick={() => send("email")}>Send by email</button>
            <button disabled={!c.phone || !!busy} onClick={() => send("sms")}>SMS</button>
            <button onClick={() => { navigator.clipboard?.writeText(msg); say("Copied"); }}>Copy</button>
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
            {c.messages.slice().reverse().map((m) => <div key={m.id} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: m.direction === "in" ? "#EAF1FB" : "var(--soft)" }}><span className="muted">{m.direction === "in" ? "Reply" : m.channel} · {new Date(m.created_at + "Z").toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{m.status === "manual" ? " · opened in your app" : ""}</span><div>{m.body}</div></div>)}
          </div>
        </div>}

        {tab === "resume" && <div className="grid">
          <div className="card">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Field label="WhatsApp number"><input value={c.phone || ""} onChange={(e) => setC({ ...c, phone: e.target.value })} onBlur={() => save({ phone: c.phone })} /></Field>
              <Field label="Email"><input value={c.email || ""} onChange={(e) => setC({ ...c, email: e.target.value })} onBlur={() => save({ email: c.email })} /></Field>
            </div>
            <Field label={`Upload a new resume${c.resume_file ? ` (current: ${c.resume_file})` : ""}`}><div className="row"><input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files[0])} /><button className="small" disabled={!file || !!busy} onClick={uploadResume}>Read file</button></div></Field>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Field label="Location (distance matters for a school day)"><input value={c.location || ""} onChange={(e) => setC({ ...c, location: e.target.value })} onBlur={() => save({ location: c.location })} /></Field>
              <Field label="Current school / employer"><input value={c.current_employer || ""} onChange={(e) => setC({ ...c, current_employer: e.target.value })} onBlur={() => save({ current_employer: c.current_employer })} /></Field>
              <Field label="Expected salary"><input value={c.expected_salary || ""} onChange={(e) => setC({ ...c, expected_salary: e.target.value })} onBlur={() => save({ expected_salary: c.expected_salary })} /></Field>
              <Field label="Notice period"><input value={c.notice_period || ""} onChange={(e) => setC({ ...c, notice_period: e.target.value })} onBlur={() => save({ notice_period: c.notice_period })} /></Field>
              <Field label="Source"><select value={c.source} onChange={(e) => save({ source: e.target.value })}>{["Job portal", "Careers page", "Referral", "Internal (IJP)", "Walk-in", "LinkedIn", "ARISE network", "Sourced", "Bulk upload", "CSV import"].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Referred by (required for referrals)"><input value={c.referrer || ""} onChange={(e) => setC({ ...c, referrer: e.target.value })} onBlur={() => save({ referrer: c.referrer })} /></Field>
            </div>
            <Field label="Resume text"><textarea style={{ minHeight: 180 }} value={c.resume_text || ""} onChange={(e) => setC({ ...c, resume_text: e.target.value })} onBlur={() => save({ resume_text: c.resume_text })} /></Field>
            <Field label="Internal notes (references, salary expectations, panel feedback)"><textarea value={c.notes || ""} onChange={(e) => setC({ ...c, notes: e.target.value })} onBlur={() => save({ notes: c.notes })} /></Field>
            <div className="muted" style={{ fontSize: 12 }}>Added {daysSince(c.created_at)} days ago via {c.source}</div>
          </div>
          {!isManager() && <div className="row">
            <button className="danger" onClick={async () => { if (confirm(`Remove ${c.name}? Use "Erase everything" if the candidate asked for their data to be deleted.`)) { await api(`/candidates/${id}`, { method: "DELETE" }); onClose(); } }}>Remove candidate</button>
            <button className="danger" onClick={async () => { if (confirm(`Erase everything held about ${c.name}: resume, messages, interview transcripts, photos and documents. This cannot be undone.`)) { await api(`/candidates/${id}/purge`, { method: "DELETE" }); say("Erased"); onClose(); } }}>Erase everything (data request)</button>
            <a className="small" style={{ fontSize: 12, alignSelf: "center" }} href={`/api/candidates/${id}/export`} onClick={async (e) => { e.preventDefault(); const r = await fetch(`/api/candidates/${id}/export`, { headers: { Authorization: `Bearer ${localStorage.getItem("hph_token")}` } }); const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${c.name}.json`; a.click(); }}>Export data</a>
          </div>}
        </div>}

        {tab === "history" && <div className="card" style={{ fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}><span className="muted">Report link: <span style={{ wordBreak: "break-all" }}>{c.share_link}</span></span>{!isManager() && <button className="small" onClick={async () => { await api(`/candidates/${id}/share/rotate`, { method: "POST" }); load(); say("Old report links no longer work"); }}>Rotate</button>}</div>{c.events.map((e) => <div key={e.id} className="row" style={{ justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--line)" }}><span>{e.type.replace(/_/g, " ")} {e.detail && <span className="muted">· {e.detail}</span>}</span><span className="muted" style={{ fontSize: 11 }}>{new Date(e.created_at + "Z").toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>)}</div>}
      </aside>
    </div>
  );
}

const RISK = { clear: ["#E6F1EA", "var(--green)", "No concerns"], low: ["#E6F1EA", "var(--green)", "Low risk"], medium: ["#FDF3D6", "#8A6A10", "Medium risk"], "medium-high": ["#FBE5E2", "#B0463C", "Medium-high risk"], high: ["#FBE5E2", "#B0463C", "High risk of outside help"] };
function Integrity({ iv }) {
  const [bg, fg, label] = RISK[iv.integrity.risk] || RISK.medium;
  return (
    <div style={{ marginTop: 10, borderRadius: 10, background: bg, padding: 10, fontSize: 13 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><b style={{ color: fg }}>Integrity check: {label}</b><span className="muted" style={{ fontSize: 11 }}>{iv.proctor ? "candidate was informed" : "monitoring was off"}</span></div>
      <div style={{ marginTop: 4 }}>{iv.integrity.summary}</div>
      {iv.integrity.reasons.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{iv.integrity.reasons.map((r, i) => <li key={i}><span className="pill" style={{ background: "#fff", color: r.level === "high" ? "#B0463C" : r.level === "medium" ? "#8A6A10" : "var(--mute)", marginRight: 6 }}>{r.level}</span>{r.text}{r.source === "answers" && <span className="muted"> (from the answers)</span>}</li>)}</ul>}
      {iv.snapshots?.length > 0 && <details style={{ marginTop: 8 }}><summary>{iv.snapshots.length} camera photos</summary><div className="row" style={{ marginTop: 6 }}>{iv.snapshots.map((s, i) => <img key={i} src={s.image} alt="" style={{ width: 96, borderRadius: 6 }} title={new Date(s.at).toLocaleTimeString("en-IN")} />)}</div></details>}
      {iv.integrity.risk !== "clear" && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>These are signals, not proof. A dropped call or a notification can look like leaving the screen. If the score is otherwise strong, raise it directly at the school interview.</div>}
    </div>
  );
}

const STATUS = ["pending", "received", "verified", "failed", "na"];
const STATUS_LABEL = { pending: "Pending", received: "Received", verified: "Verified", failed: "Failed", na: "Not needed" };
const STATUS_COLOR = { pending: "var(--mute)", received: "#8A6A10", verified: "var(--green)", failed: "#B0463C", na: "var(--mute)" };
function Checks({ c, id, say, reload, blockers, onOverride }) {
  const [custom, setCustom] = useState("");
  const upd = async (key, patch, file) => { try { const fd = new FormData(); Object.entries(patch).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append("file", file); await api(`/candidates/${id}/checks/${key}`, { method: "PUT", form: fd }); reload(); } catch (e) { say(e.message); } };
  const groups = { document: "Step 5: Background verification (identity, credentials, employment history)", safety: "Step 5: Police verification and references (at least two)", onboarding: "Onboarding: pre-boarding, Day 1 induction, Week 1 role orientation" };
  const phaseOf = (k) => k.phase ? ` · ${k.phase}` : "";
  const required = c.checks.filter((k) => k.required && k.category !== "onboarding"), doneReq = required.filter((k) => ["verified", "na"].includes(k.status)).length;
  return <div className="grid">
    {blockers && <div style={{ background: "#FBE5E2", borderRadius: 10, padding: 10, fontSize: 13 }}><b>Cannot move to {blockers.stage} yet.</b> {required.length - doneReq} required check{required.length - doneReq === 1 ? "" : "s"} still open. Verify them below{isAdmin() ? ", or override as an admin (this is recorded)" : ""}.{isAdmin() && <button className="small danger" style={{ marginLeft: 8 }} onClick={onOverride}>Override and move anyway</button>}</div>}
    <div className="muted" style={{ fontSize: 13 }}>{doneReq} of {required.length} required verification checks complete. Upload a scan or photo of each document; files stay private to HR. An offer can be made conditional on pending verification from the Offer tab; onboarding items list who owns them (HR, IT/Admin, Reporting Manager) and when.</div>
    {Object.entries(groups).map(([cat, title]) => <div key={cat} className="card">
      <b style={{ fontSize: 14 }}>{title}</b>
      {c.checks.filter((k) => k.category === cat).map((k) => <div key={k.id} style={{ borderTop: "1px solid var(--line)", padding: "8px 0", fontSize: 13 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>{k.label}{k.required ? <span style={{ color: "var(--coral)" }}> *</span> : ""}<span className="muted" style={{ fontSize: 11 }}> · {k.owner || "HR"}{phaseOf(k)}</span></span>
          <select disabled={isManager()} value={k.status} onChange={(e) => upd(k.key, { status: e.target.value })} style={{ width: "auto", color: STATUS_COLOR[k.status], fontWeight: 500 }}>{STATUS.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}</select>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <input disabled={isManager()} placeholder="Notes: who verified, reference's name and date, anything unusual" defaultValue={k.notes} onBlur={(e) => e.target.value !== k.notes && upd(k.key, { notes: e.target.value })} style={{ flex: 1, fontSize: 12 }} />
          {!isManager() && <label className="small" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>{k.file ? "Replace file" : "Upload"}<input type="file" style={{ display: "none" }} onChange={(e) => e.target.files[0] && upd(k.key, {}, e.target.files[0])} /></label>}
          {k.file && <a className="small" style={{ fontSize: 12 }} href="#" onClick={async (e) => { e.preventDefault(); const r = await fetch(`/api/candidates/${id}/checks/${k.key}/file`, { headers: { Authorization: `Bearer ${localStorage.getItem("hph_token")}` } }); window.open(URL.createObjectURL(await r.blob()), "_blank"); }}>View file</a>}
        </div>
      </div>)}
    </div>)}
    {!isManager() && <div className="row"><input placeholder="Add a check specific to this hire, e.g. sports coaching licence" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ flex: 1 }} /><button disabled={!custom.trim()} onClick={async () => { await api(`/candidates/${id}/checks`, { method: "POST", body: { label: custom, category: "document", required: 1 } }); setCustom(""); reload(); }}>Add</button></div>}
  </div>;
}

function Offer({ c, id, say, save }) {
  const [body, setBody] = useState(""); const [salary, setSalary] = useState(c.salary || ""); const [jd, setJd] = useState(c.join_date || "");
  const gen = () => api(`/candidates/${id}/offer-letter`).then((r) => setBody(r.body)).catch((e) => say(e.message));
  useEffect(() => { gen(); }, [c.salary, c.join_date]);
  return <div className="grid">
    <div className="card">
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Remuneration (as it should read in the letter)"><input value={salary} onChange={(e) => setSalary(e.target.value)} onBlur={() => salary !== c.salary && save({ salary })} placeholder="e.g. INR 55,000 per month (CTC INR 6.6 lakh)" /></Field>
        <Field label="Joining date"><input type="date" value={jd} onChange={(e) => { setJd(e.target.value); save({ join_date: e.target.value }); }} /></Field>
      </div>
      <Field label="Offer letter (edit freely; generated from the template in Settings)"><textarea style={{ minHeight: 300, fontFamily: "inherit" }} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <div className="row">
        <button className="primary" disabled={!c.email} onClick={async () => { try { const r = await api(`/candidates/${id}/offer-letter/send`, { method: "POST", body: { body } }); if (r.link) window.open(r.link, "_blank"); say("Offer sent"); } catch (e) { say(e.message); } }}>Send offer by email</button>
        <button onClick={() => { const w = window.open("", "_blank"); w.document.write(`<pre style="font-family:Ubuntu,Arial;white-space:pre-wrap;padding:40px;max-width:700px;line-height:1.6">${body.replace(/</g, "&lt;")}</pre>`); w.document.close(); w.print(); }}>Print / save as PDF</button>
        <button onClick={() => { navigator.clipboard?.writeText(body); say("Copied"); }}>Copy</button>
      </div>
      {c.offer_sent_at && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Offer sent {daysSince(c.offer_sent_at)} days ago. Once they accept, move to Joined and work through the onboarding checklist under Checks.</div>}
    </div>
  </div>;
}

function Evaluations({ c, id, say, reload }) {
  const [name, setName] = useState("");
  const done = c.evaluations.filter((e) => e.submitted_at);
  const avg = (e) => (Object.values(e.scores || {}).reduce((a, b) => a + +b, 0) / Math.max(1, Object.keys(e.scores || {}).length)).toFixed(1);
  const [round, setRound] = useState(ROUNDS.includes(c.stage) ? c.stage : "Leadership interview");
  const rubric = c.role?.rubrics?.[round] || c.role?.rubric || [];
  const colAvg = (key) => { const v = done.filter((e) => e.stage === round).map((e) => +e.scores?.[key]).filter(Boolean); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–"; };
  return <div style={{ marginTop: 10 }}>
    <div className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 14 }}>Scoring links</b>{done.length > 0 && <span>Overall <Score v={Math.round((done.reduce((a, e) => a + +avg(e), 0) / done.length) * 20)} /><span className="muted" style={{ fontSize: 12 }}> /100 from {done.length} panelist{done.length > 1 ? "s" : ""}</span></span>}</div>
    {done.some((e) => e.stage === round) && <div style={{ marginTop: 8, fontSize: 13 }}><div className="muted" style={{ fontSize: 12 }}>{round}, per item</div>{rubric.map((r) => <div key={r.key} className="row" style={{ justifyContent: "space-between", marginTop: 3 }}><span className="muted">{r.label}</span><b>{colAvg(r.key)} / 5</b></div>)}</div>}
    {c.evaluations.map((e) => <div key={e.id} style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8, fontSize: 13 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><span><b>{e.panelist || "Panelist"}</b> · {e.stage}</span>{e.submitted_at ? <span>{avg(e)} / 5 · <b>{e.recommendation}</b></span> : <span className="muted">not yet scored · <button className="link" style={{ fontSize: 12 }} onClick={() => { navigator.clipboard?.writeText(e.link); say("Scoring link copied"); }}>copy link</button></span>}</div>
      {e.comment && <div className="muted" style={{ marginTop: 3 }}>{e.comment}</div>}
    </div>)}
    <div className="row" style={{ marginTop: 10 }}>
      <select value={round} onChange={(e) => setRound(e.target.value)} style={{ width: "auto" }}>{ROUNDS.map((r) => <option key={r}>{r}</option>)}</select>
      <input placeholder="Panelist name (e.g. Principal, HOD Maths)" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
      <button disabled={!name.trim()} onClick={async () => { try { const r = await api(`/candidates/${id}/evaluations`, { method: "POST", body: { panelist: name, stage: round } }); await navigator.clipboard?.writeText(r.link); say("Scoring link copied; send it to the panelist"); setName(""); reload(); } catch (e) { say(e.message); } }}>Create scoring link</button>
    </div>
  </div>;
}

function Clips({ candId, iv, say }) {
  const [clips, setClips] = useState(null); const [open, setOpen] = useState(false); const [canTx, setCanTx] = useState(false); const [busy, setBusy] = useState(false);
  const load = () => api(`/candidates/${candId}/interviews/${iv.id}/clips`).then((r) => { setClips(r.clips); setCanTx(r.transcribe); }).catch((e) => say(e.message));
  return <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
    <div className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 14 }}>Video answers ({iv.clips.length})</b><button className="small" onClick={() => { setOpen(!open); if (!clips) load(); }}>{open ? "Hide" : "Watch"}</button></div>
    {open && !clips && <div className="muted" style={{ fontSize: 13 }}>Loading...</div>}
    {open && clips && <div className="grid" style={{ gap: 12, marginTop: 8 }}>
      {clips.map((k) => <div key={k.index} style={{ fontSize: 13 }}>
        <div className="muted" style={{ marginBottom: 4 }}><b>Q{(k.index % 1000) + 1}.</b> {k.question}{k.superseded && <span className="pill" style={{ background: "var(--soft)", marginLeft: 6 }}>first attempt, replaced</span>}{k.retake && <span className="pill" style={{ background: "#FDF3D6", color: "#8A6A10", marginLeft: 6 }}>re-take</span>}</div>
        <video controls preload="metadata" src={k.url} style={{ width: "100%", maxHeight: 280, background: "#000", borderRadius: 8 }} />
        <div style={{ marginTop: 4 }}><span className="muted">{k.browser_text ? "Transcript:" : "Heard by the phone:"}</span> {k.answer}{k.seconds ? <span className="muted"> · {Math.floor(k.seconds / 60)}:{String(k.seconds % 60).padStart(2, "0")}</span> : null}{k.confidence != null && <span className="muted"> · confidence {Math.round(k.confidence * 100)}%</span>}</div>
        {k.browser_text && k.browser_text !== k.answer && <details style={{ fontSize: 12 }}><summary className="muted">What the phone heard</summary>{k.browser_text}</details>}
        {k.candidate_note && <div style={{ fontSize: 12, background: "#FDF3D6", borderRadius: 6, padding: "6px 8px", marginTop: 4 }}><b>Candidate's note on the transcription:</b> {k.candidate_note}</div>}
      </div>)}
      {canTx && <button className="small" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/candidates/${candId}/interviews/${iv.id}/retranscribe`, { method: "POST" }); say("Re-transcribed and report refreshed"); await load(); } catch (e) { say(e.message); } setBusy(false); }}>{busy ? "Transcribing..." : "Re-transcribe all and refresh report"}</button>}
      <div className="muted" style={{ fontSize: 12 }}>Stored encrypted on the school's server. Links expire after 30 minutes; each opening is logged. Deleted after 90 days or when the candidate is erased.</div>
    </div>}
  </div>;
}

function Process({ c, id, say, reload, save }) {
  const [cons, setCons] = useState(null); const [sc, setSc] = useState(c.screening_call || { outcome: "", notes: "" }); const [fr, setFr] = useState({ decision: c.final_review?.decision || "approved", note: c.final_review?.note || "" }); const [hd, setHd] = useState(c.hr_discussion || { agreed_salary: c.salary || "", join_date: c.join_date || "", policy_notes: "" }); const [busy, setBusy] = useState("");
  const load = (withSummary) => api(`/candidates/${id}/consolidated${withSummary ? "?summary=1" : ""}`).then(setCons).catch((e) => say(e.message));
  useEffect(() => { load(false); }, [id]);
  const stageIdx = STAGES.indexOf(c.stage);
  const rounds = cons?.rounds || [];
  return <div className="grid">
    {/* Screening call */}
    <div className="card">
      <b>Screening call</b> <span className="muted" style={{ fontSize: 12 }}>HR, 10 to 15 minutes, after the AI interview</span>
      {c.screening_call?.at && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Last recorded by {c.screening_call.by} on {new Date(c.screening_call.at).toLocaleDateString("en-IN")}</div>}
      {!isManager() && <>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 10px", marginTop: 8 }}>
          <Field label="Location / travel"><input value={sc.location ?? c.location ?? ""} onChange={(e) => setSc({ ...sc, location: e.target.value })} /></Field>
          <Field label="Current employer"><input value={sc.current_employer ?? c.current_employer ?? ""} onChange={(e) => setSc({ ...sc, current_employer: e.target.value })} /></Field>
          <Field label="Expected salary"><input value={sc.expected_salary ?? c.expected_salary ?? ""} onChange={(e) => setSc({ ...sc, expected_salary: e.target.value })} /></Field>
          <Field label="Notice period"><input value={sc.notice_period ?? c.notice_period ?? ""} onChange={(e) => setSc({ ...sc, notice_period: e.target.value })} /></Field>
        </div>
        <Field label="Fit and interest: what you heard"><textarea value={sc.notes || ""} onChange={(e) => setSc({ ...sc, notes: e.target.value })} style={{ minHeight: 60 }} /></Field>
        <div className="row">{[["proceed", "Proceed to interviews"], ["hold", "Hold"], ["decline", "Not a fit"]].map(([k, l]) => <button key={k} className={sc.outcome === k ? (k === "decline" ? "danger" : "primary") : ""} onClick={() => setSc({ ...sc, outcome: k })}>{l}</button>)}<button className="warm" disabled={!sc.outcome} onClick={async () => { try { await api(`/candidates/${id}/screening-call`, { method: "PUT", body: sc }); say("Screening call recorded"); reload(); } catch (e) { say(e.message); } }}>Save call</button></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>"Proceed" moves the candidate to Shortlist and asks them to complete the application form details above; then invite them to the panel rounds from the Message tab.</div>
      </>}
    </div>

    {/* Panel rounds */}
    <div className="card">
      <b>Panel rounds</b> <span className="muted" style={{ fontSize: 12 }}>Round 1 Principal, Round 2 Department Coordinator or subject expert, Round 3 Lesson demonstration</span>
      {rounds.map((r) => <div key={r.round} style={{ borderTop: "1px solid var(--line)", padding: "8px 0", fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between" }}><span><b>{r.round}</b>{c.stage === r.round && <span className="pill" style={{ background: "#EAF1FB", color: "var(--blue)", marginLeft: 6 }}>current</span>}</span><span>{r.avg ? <><b>{r.avg}</b> / 5 <span className="muted">from {r.panelists}</span></> : <span className="muted">not scored</span>}</span></div>{r.recommendations.length > 0 && <div className="muted">{r.recommendations.join(" · ")}</div>}</div>)}
      <Evaluations c={c} id={id} say={say} reload={() => { reload(); load(false); }} />
    </div>

    {/* Written assessment */}
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}><span><b>Written English assessment</b> <span className="muted" style={{ fontSize: 12 }}>Round 4, 30 minutes on the candidate's device</span></span>{!isManager() && <button className="small" disabled={busy === "w"} onClick={async () => { setBusy("w"); try { const r = await api(`/candidates/${id}/interviews`, { method: "POST", body: { kind: "written", send: c.phone ? "whatsapp" : c.email ? "email" : null } }); if (r.delivery?.link) window.open(r.delivery.link, "_blank"); else { await navigator.clipboard?.writeText(r.link); say("Link copied"); } reload(); } catch (e) { say(e.message); } setBusy(""); }}>{busy === "w" ? "..." : "Send written task"}</button>}</div>
      {cons?.written ? (cons.written.report ? <div style={{ fontSize: 13, marginTop: 6 }}><div className="row" style={{ justifyContent: "space-between" }}><span>{cons.written.report.recommendation}</span><Score v={cons.written.report.overall} /></div><div className="muted">{cons.written.report.summary}</div>{cons.written.report.dimensions?.map((d, i) => <div key={i} className="row" style={{ justifyContent: "space-between", marginTop: 2 }}><span className="muted">{d.name}</span><Score v={d.score} /></div>)}</div> : <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{cons.written.status === "completed" ? "Submitted; grading in progress." : "Link sent, not yet submitted."}</div>) : <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Not sent yet.</div>}
    </div>

    {/* Final review */}
    <div className="card" style={{ borderColor: c.final_review ? "var(--green)" : "var(--yellow)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}><span><b>Final review</b> <span className="muted" style={{ fontSize: 12 }}>Round 5: consolidated for the Director</span></span><button className="small" disabled={busy === "s"} onClick={async () => { setBusy("s"); await load(true); setBusy(""); }}>{busy === "s" ? "Writing..." : "Consolidate with AI"}</button></div>
      {cons && <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, background: "var(--soft)", borderRadius: 8, padding: 10, marginTop: 8 }}>{cons.summary || cons.material}</pre>}
      {c.final_review ? <div style={{ fontSize: 13, marginTop: 6 }}><b style={{ color: c.final_review.decision === "approved" ? "var(--green)" : c.final_review.decision === "rejected" ? "#B0463C" : "#8A6A10", textTransform: "capitalize" }}>{c.final_review.decision}</b> by {c.final_review.by} on {new Date(c.final_review.at).toLocaleDateString("en-IN")}{c.final_review.note && <div className="muted">{c.final_review.note}</div>}</div> : <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Not yet reviewed by the Director. Required before the HR discussion and any offer.</div>}
      {isAdmin() && <div style={{ marginTop: 8 }}><Field label="Director's note"><input value={fr.note} onChange={(e) => setFr({ ...fr, note: e.target.value })} /></Field><div className="row">{[["approved", "Approve"], ["hold", "Hold"], ["rejected", "Reject"]].map(([k, l]) => <button key={k} className={k === "approved" ? "primary" : k === "rejected" ? "danger" : ""} onClick={async () => { try { await api(`/candidates/${id}/final-review`, { method: "POST", body: { decision: k, note: fr.note } }); say(`Final review: ${l}`); reload(); } catch (e) { say(e.message); } }}>{l}</button>)}</div></div>}
    </div>

    {/* HR discussion */}
    {stageIdx >= STAGES.indexOf("HR discussion") && !isManager() && <div className="card">
      <b>HR discussion</b> <span className="muted" style={{ fontSize: 12 }}>Round 6: compensation, joining timeline, policy clarifications</span>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 10px", marginTop: 8 }}>
        <Field label="Agreed remuneration (as it will read in the letter)"><input value={hd.agreed_salary || ""} onChange={(e) => setHd({ ...hd, agreed_salary: e.target.value })} placeholder="e.g. INR 55,000 per month (CTC INR 6.6 lakh)" /></Field>
        <Field label="Joining date"><input type="date" value={hd.join_date || ""} onChange={(e) => setHd({ ...hd, join_date: e.target.value })} /></Field>
      </div>
      <Field label="Policy clarifications given, questions raised"><textarea value={hd.policy_notes || ""} onChange={(e) => setHd({ ...hd, policy_notes: e.target.value })} style={{ minHeight: 60 }} /></Field>
      <button className="primary" onClick={async () => { try { await api(`/candidates/${id}/hr-discussion`, { method: "PUT", body: hd }); say("HR discussion saved; the offer letter will use these figures"); reload(); } catch (e) { say(e.message); } }}>Save discussion</button>
      {c.hr_discussion?.at && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Recorded by {c.hr_discussion.by} on {new Date(c.hr_discussion.at).toLocaleDateString("en-IN")}</div>}
    </div>}
  </div>;
}

function Letters({ c, id, say, save, reload }) {
  const [letters, setLetters] = useState([]); const [editing, setEditing] = useState(null); const [conditional, setConditional] = useState(false);
  const load = () => api(`/candidates/${id}/letters`).then(setLetters).catch(() => {});
  useEffect(() => { load(); }, [id]);
  const S = { draft: "#8A6A10", approved: "var(--blue)", issued: "var(--green)" };
  return <div className="grid">
    <div className="card" style={{ fontSize: 13 }}>
      <b>Step 6: Offer and documentation</b>
      <div className="muted" style={{ marginTop: 4 }}>Remuneration and joining date come from the HR discussion. Letters get a reference number when drafted, are approved by the Executive Head, then issued and logged in the tracker. An offer can go out conditional on pending verification.</div>
      <div className="row" style={{ marginTop: 8 }}><span>Remuneration: <b>{c.salary || "not set"}</b></span><span>Joining: <b>{c.join_date ? new Date(c.join_date).toLocaleDateString("en-IN") : "not set"}</b></span>{c.offer_sent_at && <span className="muted">Offer issued {daysSince(c.offer_sent_at)}d ago</span>}</div>
      {c.stage !== "Offer" && c.stage !== "Joined" && !isManager() && <div className="row" style={{ marginTop: 8 }}><label style={{ fontSize: 13 }}><input type="checkbox" style={{ width: "auto" }} checked={conditional} onChange={(e) => setConditional(e.target.checked)} /> Offer is conditional on pending verification</label><button className="primary small" onClick={() => save({ stage: "Offer", conditional })}>Move to Offer</button></div>}
    </div>
    {!isManager() && <div className="row"><button className="primary" onClick={async () => { try { await api(`/candidates/${id}/letters`, { method: "POST", body: { type: "offer" } }); say("Offer letter drafted"); load(); } catch (e) { say(e.message); } }}>Draft offer letter</button><button onClick={async () => { try { await api(`/candidates/${id}/letters`, { method: "POST", body: { type: "appointment" } }); say("Appointment letter drafted"); load(); } catch (e) { say(e.message); } }}>Draft appointment letter</button></div>}
    {letters.map((l) => <div key={l.id} className="card" style={{ fontSize: 13 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><span><b style={{ textTransform: "capitalize" }}>{l.type} letter</b> · <code>{l.ref_no}</code></span><span style={{ color: S[l.status], fontWeight: 500, textTransform: "capitalize" }}>{l.status}{l.issued_via ? ` · ${l.issued_via}` : ""}</span></div>
      <div className="muted" style={{ fontSize: 12 }}>Drafted by {l.created_by_name} {new Date(l.created_at + "Z").toLocaleDateString("en-IN")}{l.approved_by_name && ` · approved by ${l.approved_by_name}`}{l.issued_at && ` · issued ${new Date(l.issued_at + "Z").toLocaleDateString("en-IN")}`}</div>
      {editing === l.id ? <><textarea defaultValue={l.body} id={`lb${l.id}`} style={{ minHeight: 280, marginTop: 8 }} /><div className="row" style={{ marginTop: 6 }}><button className="primary small" onClick={async () => { await api(`/candidates/${id}/letters/${l.id}`, { method: "PUT", body: { body: document.getElementById(`lb${l.id}`).value } }); setEditing(null); load(); }}>Save</button><button className="small" onClick={() => setEditing(null)}>Cancel</button></div></>
        : <details style={{ marginTop: 6 }}><summary>Read letter</summary><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{l.body}</pre></details>}
      <div className="row" style={{ marginTop: 8 }}>
        {l.status === "draft" && !isManager() && <button className="small" onClick={() => setEditing(l.id)}>Edit</button>}
        {l.status === "draft" && isAdmin() && <button className="small primary" onClick={async () => { await api(`/candidates/${id}/letters/${l.id}/approve`, { method: "POST", body: {} }); say("Approved"); load(); }}>Approve (Executive Head)</button>}
        {l.status === "approved" && !isManager() && <><button className="small primary" disabled={!c.email} onClick={async () => { try { const r = await api(`/candidates/${id}/letters/${l.id}/issue`, { method: "POST", body: { via: "email" } }); if (r.delivery?.link) window.open(r.delivery.link, "_blank"); say("Issued and logged"); load(); reload(); } catch (e) { say(e.message); } }}>Issue by email</button><button className="small" onClick={async () => { const w = window.open("", "_blank"); w.document.write(`<pre style="font-family:Ubuntu,Arial;white-space:pre-wrap;padding:40px;max-width:700px;line-height:1.6">${l.body.replace(/</g, "&lt;")}</pre>`); w.document.close(); w.print(); await api(`/candidates/${id}/letters/${l.id}/issue`, { method: "POST", body: { via: "printed" } }); say("Marked as issued (printed)"); load(); reload(); }}>Print, sign and stamp</button></>}
        <button className="small" onClick={() => { navigator.clipboard?.writeText(l.body); say("Copied"); }}>Copy</button>
      </div>
    </div>)}
  </div>;
}

const V = { demonstrated: ["#E6F1EA", "var(--green)", "Demonstrated"], weakness: ["#FBE5E2", "#B0463C", "Weakness shown"], not_assessed: ["var(--soft)", "var(--mute)", "Not assessed"], unreliable: ["#FDF3D6", "#8A6A10", "Transcription unreliable"] };
const Verdict = ({ v }) => { const [bg, fg, l] = V[v] || V.not_assessed; return <span className="pill" style={{ background: bg, color: fg }}>{l}</span>; };
function ReportV2({ iv, c, say, reload }) {
  const r = iv.report; const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const bandColor = { Strong: "var(--green)", Promising: "var(--green)", Borderline: "#8A6A10", "Not now": "#B0463C" }[r.band] || "var(--mute)";
  return <div style={{ marginTop: 6, fontSize: 13 }}>
    <div className="row" style={{ justifyContent: "space-between" }}><b style={{ color: bandColor, fontSize: 15 }}>{r.band}</b><span className="muted">{r.overall}/100 across assessed competencies only · {r.recommendation}</span></div>
    <div style={{ marginTop: 4, lineHeight: 1.5 }}>{r.summary}</div>
    <div style={{ marginTop: 10, fontWeight: 500 }}>By competency</div>
    {(r.competencies || []).map((k, i) => <div key={i} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}><div className="row" style={{ justifyContent: "space-between" }}><span>{k.name}</span><Verdict v={k.verdict} /></div><div className="muted" style={{ fontSize: 12 }}>{k.note}</div></div>)}
    {r.role_play && r.role_play.verdict !== "not_assessed" && <div style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}><div className="row" style={{ justifyContent: "space-between" }}><span>Role play</span><Verdict v={r.role_play.verdict} /></div><div className="muted" style={{ fontSize: 12 }}>{r.role_play.note}</div></div>}
    <details style={{ marginTop: 8 }}><summary>Answer by answer</summary>{(r.per_question || []).map((q, i) => <div key={i} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}><div className="row" style={{ justifyContent: "space-between" }}><span><b>Q{(q.index ?? i) + 1}</b> · {q.assesses}</span><Verdict v={q.verdict} /></div>{q.evidence && <div className="evidence">“{q.evidence}”</div>}<div className="muted" style={{ fontSize: 12 }}>{q.note}</div></div>)}</details>
    {r.transcription_issues && r.transcription_issues !== "none" && <div style={{ marginTop: 8, background: "#FDF3D6", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}><b>Transcription:</b> {r.transcription_issues}. Watch the recording before relying on those answers.</div>}
    <div style={{ marginTop: 8 }}><b>Strengths:</b> {r.strengths}</div>
    <div style={{ marginTop: 4 }}><b>Concerns:</b> {r.concerns}</div>
    {r.verify_next_stage?.length > 0 && <div style={{ marginTop: 8 }}><b>Verify at the demo lesson and panel:</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{r.verify_next_stage.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    {iv.retakes?.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>The candidate re-recorded answer {iv.retakes[0].index + 1}; both recordings are kept under Video answers.</div>}
    <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Spoken English is not scored from the transcript; it is assessed in person at the panel rounds. This report shortlists for humans and does not decide.</div>
    {!isManager() && <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Watched the recording and disagree with something? Add what you heard or saw and the report is rewritten with your note.</div><div className="row"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. In Q3 she clearly said 'rapport', not 'rapper'; the example was for Grade 4" style={{ flex: 1 }} /><button className="small" disabled={busy || !note.trim()} onClick={async () => { setBusy(true); try { await api(`/candidates/${c.id}/interviews/${iv.id}/rereport`, { method: "POST", body: { note } }); say("Report rewritten with your note"); setNote(""); reload(); } catch (e) { say(e.message); } setBusy(false); }}>{busy ? "Rewriting..." : "Rewrite report"}</button></div></div>}
    <button className="small" style={{ marginTop: 10 }} onClick={() => { navigator.clipboard?.writeText(`${c.name} · ${c.role?.title}\n${r.band} (${r.overall}/100 on assessed competencies). ${r.recommendation}\n${r.summary}\n\n${(r.competencies || []).map((k) => `${k.name}: ${k.verdict.replace("_", " ")}. ${k.note}`).join("\n")}\n\nStrengths: ${r.strengths}\nConcerns: ${r.concerns}\nVerify next: ${(r.verify_next_stage || []).join("; ")}`); say("Copied"); }}>Copy report</button>
  </div>;
}
