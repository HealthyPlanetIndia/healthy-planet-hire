import React, { useEffect, useState } from "react";
import { api, daysSince, STAGES, isManager, isAdmin, fmtDT, t } from "../api.js";
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
    if (e.message.includes("child-safety")) { setBlockers({ stage: patch.stage }); setTab("checks"); say(e.message); } else say(e.message); } };
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
            <button className="small" disabled={!!busy} onClick={() => run("iv", async () => { const r = await api(`/candidates/${id}/interviews`, { method: "POST", body: { kind: "video", send: c.phone ? "whatsapp" : "email" } }); if (r.delivery?.link) window.open(r.delivery.link, "_blank"); say("Video interview link sent"); })}>Video interview</button>
          </>}
        </div>
        {c.duplicates?.length > 0 && <div style={{ background: "#FDF3D6", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 }}><b>Possible duplicate.</b> {c.duplicates.map((d) => `${d.name} (${d.reason}, ${d.role_title || "no role"}, ${d.stage})`).join("; ")}. Check before contacting twice.</div>}
        {c.interview_at && <div style={{ background: "#EAF1FB", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 }} className="row"><span style={{ flex: 1 }}><b>Booked:</b> {fmtDT(c.interview_at)}{c.slot?.location && ` · ${c.slot.location}`}</span><a className="small" style={{ fontSize: 12 }} href={`/api/candidates/${id}/calendar.ics`} onClick={async (e) => { e.preventDefault(); const r = await api(`/candidates/${id}/calendar-link`); window.open(r.google, "_blank"); }}>Add to Google Calendar</a></div>}
        <div className="tabs">{[["report", t("Report")], ["checks", t("Checks")], ...(["Offer", "Joined"].includes(c.stage) || blockers ? [["offer", t("Offer")]] : []), ...(isManager() ? [] : [["message", t("Message")]]), ["resume", t("Resume & notes")], ["history", t("History")]].map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>

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
            {iv.integrity && <Integrity iv={iv} />}
            {iv.report && <>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{iv.report.summary}</div>
              <div className="grid" style={{ marginTop: 10, gap: 6 }}>{iv.report.dimensions.map((d, i) => <div key={i} style={{ fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between" }}><span>{d.name}</span><Score v={d.score} /></div><div style={{ height: 4, background: "var(--soft)", borderRadius: 2 }}><div style={{ width: `${d.score}%`, height: 4, background: "var(--blue)", borderRadius: 2 }} /></div><div className="muted" style={{ fontSize: 12 }}>{d.note}</div></div>)}</div>
              <div style={{ fontSize: 13, marginTop: 10 }}><b>Strengths:</b> {iv.report.strengths}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}><b>Concerns:</b> {iv.report.concerns}</div>
              <div style={{ fontSize: 13, marginTop: 6, fontWeight: 500 }}>Recommendation: {iv.report.recommendation}</div>
              {iv.report.suggested_questions && <div style={{ fontSize: 13, marginTop: 6 }}><b>For the panel:</b> {iv.report.suggested_questions.join(" / ")}</div>}
              <details style={{ marginTop: 10, fontSize: 13 }}><summary>Transcript</summary>{iv.transcript.map((m, i) => <p key={i} style={{ margin: "6px 0" }}><b>{m.role === "assistant" ? "Maya" : c.name.split(" ")[0]}:</b> {m.content}{m.meta && <span className="muted"> · {m.meta.seconds}s, {Math.round(m.content.length / m.meta.seconds * 10) / 10} chars/s</span>}</p>)}</details>
              <button className="small" style={{ marginTop: 10 }} onClick={() => { navigator.clipboard?.writeText(`${c.name} · ${role?.title}\nAI interview ${iv.report.overall}/100. ${iv.report.summary}\n\n${iv.report.dimensions.map((d) => `${d.name}: ${d.score}. ${d.note}`).join("\n")}\n\nStrengths: ${iv.report.strengths}\nConcerns: ${iv.report.concerns}\nRecommendation: ${iv.report.recommendation}`); say("Report copied for the hiring manager"); }}>Copy report to share</button>
            </>}
          </div>}
          <Evaluations c={c} id={id} say={say} reload={load} />
        </div>}

        {tab === "checks" && <Checks c={c} id={id} say={say} reload={load} blockers={blockers} onOverride={() => save({ stage: blockers.stage, override: true })} />}
        {tab === "offer" && <Offer c={c} id={id} say={say} save={save} />}

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
  const groups = { document: "Documents to verify against originals", safety: "Child safety and references (required before any offer)", onboarding: "Onboarding (after the offer is accepted)" };
  const required = c.checks.filter((k) => k.required && k.category !== "onboarding"), doneReq = required.filter((k) => ["verified", "na"].includes(k.status)).length;
  return <div className="grid">
    {blockers && <div style={{ background: "#FBE5E2", borderRadius: 10, padding: 10, fontSize: 13 }}><b>Cannot move to {blockers.stage} yet.</b> {required.length - doneReq} required check{required.length - doneReq === 1 ? "" : "s"} still open. Verify them below{isAdmin() ? ", or override as an admin (this is recorded)" : ""}.{isAdmin() && <button className="small danger" style={{ marginLeft: 8 }} onClick={onOverride}>Override and move anyway</button>}</div>}
    <div className="muted" style={{ fontSize: 13 }}>{doneReq} of {required.length} required checks verified. Upload a scan or photo of each document; the file stays private to the recruiting team.</div>
    {Object.entries(groups).map(([cat, title]) => <div key={cat} className="card">
      <b style={{ fontSize: 14 }}>{title}</b>
      {c.checks.filter((k) => k.category === cat).map((k) => <div key={k.id} style={{ borderTop: "1px solid var(--line)", padding: "8px 0", fontSize: 13 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>{k.label}{k.required ? <span style={{ color: "var(--coral)" }}> *</span> : ""}</span>
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
  const rubric = c.role?.rubric || [];
  const colAvg = (key) => { const v = done.map((e) => +e.scores?.[key]).filter(Boolean); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–"; };
  if (!["Demo lesson", "School interview", "Offer", "Joined", "Shortlist"].includes(c.stage) && !c.evaluations.length) return null;
  return <div className="card">
    <div className="row" style={{ justifyContent: "space-between" }}><b>Panel scores</b>{done.length > 0 && <span>Overall <Score v={Math.round((done.reduce((a, e) => a + +avg(e), 0) / done.length) * 20)} /><span className="muted" style={{ fontSize: 12 }}> /100 from {done.length} panelist{done.length > 1 ? "s" : ""}</span></span>}</div>
    {done.length > 0 && <div style={{ marginTop: 8, fontSize: 13 }}>{rubric.map((r) => <div key={r.key} className="row" style={{ justifyContent: "space-between", marginTop: 3 }}><span className="muted">{r.label}</span><b>{colAvg(r.key)} / 5</b></div>)}</div>}
    {c.evaluations.map((e) => <div key={e.id} style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8, fontSize: 13 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><span><b>{e.panelist || "Panelist"}</b> · {e.stage}</span>{e.submitted_at ? <span>{avg(e)} / 5 · <b>{e.recommendation}</b></span> : <span className="muted">not yet scored · <button className="link" style={{ fontSize: 12 }} onClick={() => { navigator.clipboard?.writeText(e.link); say("Scoring link copied"); }}>copy link</button></span>}</div>
      {e.comment && <div className="muted" style={{ marginTop: 3 }}>{e.comment}</div>}
    </div>)}
    <div className="row" style={{ marginTop: 10 }}>
      <input placeholder="Panelist name (e.g. Principal, HOD Maths)" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
      <button disabled={!name.trim()} onClick={async () => { try { const r = await api(`/candidates/${id}/evaluations`, { method: "POST", body: { panelist: name, stage: c.stage === "Demo lesson" ? "Demo lesson" : "School interview" } }); await navigator.clipboard?.writeText(r.link); say("Scoring link copied; send it to the panelist"); setName(""); reload(); } catch (e) { say(e.message); } }}>Create scoring link</button>
    </div>
  </div>;
}
