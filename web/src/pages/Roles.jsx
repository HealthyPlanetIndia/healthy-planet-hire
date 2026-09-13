import React, { useEffect, useState } from "react";
import { api, isManager, fmtDT } from "../api.js";
import { Field } from "../components/ui.jsx";
import { useToast } from "../components/Shell.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
export default function Roles() {
  const say = useToast(); const [roles, setRoles] = useState([]); const [editing, setEditing] = useState(null); const [jd, setJd] = useState(""); const [slotsFor, setSlotsFor] = useState(null); const [managers, setManagers] = useState([]);
  useEffect(() => { api("/users/managers").then(setManagers).catch(() => {}); }, []);
  const load = () => api("/roles").then(setRoles);
  useEffect(() => { load(); }, []);
  const blank = { title: "", department: "Primary", campus: "Noida", openings: 1, salary_band: "", manager_id: "", criteria: [{ id: uid(), text: "", must: true }], questions: [""], rubric: [{ key: "planning", label: "Lesson planning and clarity of objectives" }, { key: "engagement", label: "Student engagement and questioning" }, { key: "management", label: "Classroom management and warmth" }, { key: "subject", label: "Subject knowledge and accuracy" }, { key: "reflection", label: "Reflection and openness in the debrief" }] };
  async function save(r) { try { const body = { ...r, criteria: r.criteria.filter((c) => c.text.trim()), questions: r.questions.filter((q) => q.trim()) }; await api(r.id ? `/roles/${r.id}` : "/roles", { method: r.id ? "PUT" : "POST", body }); setEditing(null); load(); say("Role saved"); } catch (e) { say(e.message); } }
  if (editing) return <RoleForm role={editing} managers={managers} onSave={save} onCancel={() => setEditing(null)} />;
  if (slotsFor) return <Slots role={slotsFor} onBack={() => { setSlotsFor(null); load(); }} say={say} />;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}><span className="muted">Define the role once. Every applicant is then screened and interviewed against the same criteria.</span>{!isManager() && <button className="primary" style={{ marginLeft: "auto" }} onClick={() => setEditing(blank)}>New role</button>}</div>
      {jd && <div className="card" style={{ marginBottom: 12, whiteSpace: "pre-wrap", fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}><b>Job posting draft</b><div className="row"><button className="small" onClick={() => { navigator.clipboard?.writeText(jd); say("Copied"); }}>Copy</button><button className="small" onClick={() => setJd("")}>Close</button></div></div>{jd}</div>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {roles.map((r) => <div key={r.id} className="card" style={{ opacity: r.status === "open" ? 1 : .6 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{r.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>{r.department} · {r.campus} · {r.openings} opening{r.openings > 1 ? "s" : ""} · {r.active} active{r.status !== "open" && " · closed"}{r.manager && ` · hiring manager: ${r.manager}`}</div>
          {r.salary_band && <div className="muted" style={{ fontSize: 12 }}>{r.salary_band}</div>}
          <ul style={{ paddingLeft: 18, margin: "10px 0", fontSize: 13 }}>{r.criteria.map((c) => <li key={c.id}>{c.text}{c.must && <span style={{ color: "var(--coral)" }}> *</span>}</li>)}</ul>
          <div className="muted" style={{ fontSize: 12 }}>{r.questions.length} interview questions{r.interview_mode === "interactive" ? " + role play" : ""} · {r.rubric.length}-item demo rubric · {r.open_slots} open interview slot{r.open_slots === 1 ? "" : "s"}</div>
          {isManager() && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>You see shortlisted candidates for this role under Pipeline.</div>}
          {!isManager() && <div className="row" style={{ marginTop: 10 }}>
            <button className="small" onClick={() => setSlotsFor(r)}>Slots</button>
            <button className="small" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/apply/${r.id}`); say("Apply link copied. Put it on the website or in a job ad."); }}>Apply link</button>
            <button className="small" onClick={() => setEditing(r)}>Edit</button>
            <button className="small" onClick={() => setEditing({ ...r, id: undefined, title: r.title + " (copy)" })}>Duplicate</button>
            <button className="small" onClick={async () => { say("Drafting..."); try { setJd((await api(`/roles/${r.id}/job-description`, { method: "POST" })).text); } catch (e) { say(e.message); } }}>Draft job post</button>
            <button className="small" onClick={() => api(`/roles/${r.id}`, { method: "PUT", body: { status: r.status === "open" ? "closed" : "open" } }).then(load)}>{r.status === "open" ? "Close" : "Reopen"}</button>
            <button className="small danger" onClick={async () => { if (confirm("Delete this role? Candidates stay but lose their role.")) { await api(`/roles/${r.id}`, { method: "DELETE" }); load(); } }}>Delete</button>
          </div>}
        </div>)}
      </div>
    </div>
  );
}

function RoleForm({ role, managers, onSave, onCancel }) {
  const [r, setR] = useState({ ...role, rubric: role.rubric || [] });
  const setRb = (i, v) => setR({ ...r, rubric: r.rubric.map((x, j) => (j === i ? { ...x, label: v } : x)) });
  const setC = (i, p) => setR({ ...r, criteria: r.criteria.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const setQ = (i, v) => setR({ ...r, questions: r.questions.map((q, j) => (j === i ? v : q)) });
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>{role.id ? "Edit role" : "New role"}</div>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0 10px" }}>
        <Field label="Title"><input value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></Field>
        <Field label="Department"><input value={r.department} onChange={(e) => setR({ ...r, department: e.target.value })} /></Field>
        <Field label="Campus"><input value={r.campus} onChange={(e) => setR({ ...r, campus: e.target.value })} /></Field>
        <Field label="Openings"><input type="number" min={1} value={r.openings} onChange={(e) => setR({ ...r, openings: +e.target.value })} /></Field>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="Salary band (shown in job feeds if filled)"><input value={r.salary_band || ""} onChange={(e) => setR({ ...r, salary_band: e.target.value })} placeholder="e.g. INR 45,000 to 60,000 per month" /></Field>
        <Field label="Hiring manager (sees shortlisted candidates and scores them)"><select value={r.manager_id || ""} onChange={(e) => setR({ ...r, manager_id: e.target.value })}><option value="">None</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
      </div>
      <div style={{ fontWeight: 500, margin: "8px 0 6px" }}>Screening criteria</div>
      {r.criteria.map((c, i) => <div key={c.id} className="row" style={{ marginBottom: 6, flexWrap: "nowrap" }}><input placeholder="e.g. B.Ed or equivalent" value={c.text} onChange={(e) => setC(i, { text: e.target.value })} /><label style={{ fontSize: 12, whiteSpace: "nowrap" }}><input type="checkbox" style={{ width: "auto" }} checked={c.must} onChange={(e) => setC(i, { must: e.target.checked })} /> must</label><button className="small" onClick={() => setR({ ...r, criteria: r.criteria.filter((_, j) => j !== i) })}>×</button></div>)}
      <button className="small" onClick={() => setR({ ...r, criteria: [...r.criteria, { id: uid(), text: "", must: false }] })}>Add criterion</button>
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>AI interview questions (asked in order)</div>
      {r.questions.map((q, i) => <div key={i} className="row" style={{ marginBottom: 6, flexWrap: "nowrap" }}><span className="muted">{i + 1}</span><input value={q} onChange={(e) => setQ(i, e.target.value)} /><button className="small" onClick={() => setR({ ...r, questions: r.questions.filter((_, j) => j !== i) })}>×</button></div>)}
      <button className="small" onClick={() => setR({ ...r, questions: [...r.questions, ""] })}>Add question</button>
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Interview style</div>
      <div className="row" style={{ marginBottom: 6 }}>{[["standard", "Standard: questions only (1 credit-equivalent, ~10 min)"], ["interactive", "Interactive: questions plus a role play Maya acts out (~15 min)"]].map(([k, l]) => <label key={k} style={{ fontSize: 13 }}><input type="radio" style={{ width: "auto" }} checked={(r.interview_mode || "standard") === k} onChange={() => setR({ ...r, interview_mode: k })} /> {l}</label>)}</div>
      {r.interview_mode === "interactive" && <Field label="Role-play scenario. Describe the other person and the situation; Maya plays them and reacts to what the candidate says."><textarea value={r.scenario || ""} onChange={(e) => setR({ ...r, scenario: e.target.value })} placeholder="e.g. A parent has come in upset that her son was called names during group work and says the teacher did nothing. She wants to know what you will do right now." /></Field>}
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Demo lesson and interview rubric (each scored 1 to 5 by the panel)</div>
      {r.rubric.map((x, i) => <div key={x.key} className="row" style={{ marginBottom: 6, flexWrap: "nowrap" }}><input value={x.label} onChange={(e) => setRb(i, e.target.value)} /><button className="small" onClick={() => setR({ ...r, rubric: r.rubric.filter((_, j) => j !== i) })}>×</button></div>)}
      <button className="small" onClick={() => setR({ ...r, rubric: [...r.rubric, { key: uid(), label: "" }] })}>Add rubric item</button>
      <div className="row" style={{ marginTop: 18 }}><button className="primary" disabled={!r.title.trim()} onClick={() => onSave({ ...r, rubric: r.rubric.filter((x) => x.label.trim()) })}>Save role</button><button onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

function Slots({ role, onBack, say }) {
  const [slots, setSlots] = useState([]); const [f, setF] = useState({ date: "", times: "10:00, 11:00, 12:00", minutes: 45, stage: "School interview", location: "Healthy Planet School, Noida" });
  const load = () => api(`/roles/${role.id}/slots`).then(setSlots);
  useEffect(() => { load(); }, []);
  return <div className="card" style={{ maxWidth: 720 }}>
    <div className="row" style={{ justifyContent: "space-between" }}><div><b style={{ fontSize: 16 }}>Interview slots · {role.title}</b><div className="muted" style={{ fontSize: 13 }}>Candidates pick one of these from the booking link. Each slot takes one candidate.</div></div><button className="small" onClick={onBack}>Back</button></div>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0 10px", marginTop: 12 }}>
      <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <Field label="Start times (comma separated)"><input value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} /></Field>
      <Field label="Minutes each"><input type="number" value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} /></Field>
      <Field label="For"><select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}><option>School interview</option><option>Demo lesson</option></select></Field>
      <Field label="Location"><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
    </div>
    <button className="primary" disabled={!f.date} onClick={async () => { try { await api(`/roles/${role.id}/slots`, { method: "POST", body: { ...f, times: f.times.split(",").map((x) => x.trim()).filter(Boolean) } }); say("Slots added"); load(); } catch (e) { say(e.message); } }}>Add slots</button>
    <div className="grid" style={{ gap: 6, marginTop: 14 }}>
      {slots.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No upcoming slots.</div>}
      {slots.map((s) => <div key={s.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--line)" }}><span>{fmtDT(s.starts_at)} · {s.stage} · {s.location}</span>{s.candidate_id ? <b style={{ color: "var(--green)" }}>{s.candidate_name}</b> : <button className="small" onClick={async () => { await api(`/roles/${role.id}/slots/${s.id}`, { method: "DELETE" }); load(); }}>Remove</button>}</div>)}
    </div>
  </div>;
}
