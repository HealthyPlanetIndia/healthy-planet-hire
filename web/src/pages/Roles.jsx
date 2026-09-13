import React, { useEffect, useState } from "react";
import { api, isManager, isAdmin, fmtDT, ROUNDS } from "../api.js";
import { Field } from "../components/ui.jsx";
import { useToast } from "../components/Shell.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
export default function Roles() {
  const say = useToast(); const [roles, setRoles] = useState([]); const [editing, setEditing] = useState(null); const [jd, setJd] = useState(""); const [slotsFor, setSlotsFor] = useState(null); const [managers, setManagers] = useState([]);
  useEffect(() => { api("/users/managers").then(setManagers).catch(() => {}); }, []);
  const load = () => api("/roles").then(setRoles);
  useEffect(() => { load(); }, []);
  const blank = { title: "", department: "Primary", campus: "Noida", openings: 1, salary_band: "", manager_id: "", grade: "", subject: "", justification: "", reporting_manager: "", ijp_until: "", written_prompt: "", rubrics: null, criteria: [{ id: uid(), text: "", must: true }], questions: [""], rubric: [{ key: "planning", label: "Lesson planning and clarity of objectives" }, { key: "engagement", label: "Student engagement and questioning" }, { key: "management", label: "Classroom management and warmth" }, { key: "subject", label: "Subject knowledge and accuracy" }, { key: "reflection", label: "Reflection and openness in the debrief" }] };
  async function save(r) { try { const body = { ...r, criteria: r.criteria.filter((c) => c.text.trim()), questions: r.questions.filter((q) => q.trim()) }; await api(r.id ? `/roles/${r.id}` : "/roles", { method: r.id ? "PUT" : "POST", body }); setEditing(null); load(); say("Role saved"); } catch (e) { say(e.message); } }
  if (editing) return <RoleForm role={editing} managers={managers} onSave={save} onCancel={() => setEditing(null)} />;
  if (slotsFor) return <Slots role={slotsFor} onBack={() => { setSlotsFor(null); load(); }} say={say} />;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}><span className="muted">{isManager() ? "Raise a manpower requisition here. The Director approves it before the role is posted." : "Define the role once. Every applicant is then screened and interviewed against the same criteria."}</span><button className="primary" style={{ marginLeft: "auto" }} onClick={() => setEditing(blank)}>{isManager() || !isAdmin() ? "Raise requisition" : "New role"}</button></div>
      {roles.some((r) => r.status === "requested") && <div className="card" style={{ marginBottom: 12, borderColor: "var(--yellow)", background: "#FFFBEF" }}><b>Manpower requisitions awaiting the Director</b>
        {roles.filter((r) => r.status === "requested").map((r) => <div key={r.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--line)" }}><span><b>{r.title}</b> · {r.department} · {r.campus} · {r.openings} opening{r.openings > 1 ? "s" : ""}{r.grade && ` · ${r.grade}`}{r.subject && ` · ${r.subject}`}<div className="muted">Raised by {r.requested_by_name || "staff"}: {r.justification || "no justification given"}</div></span>
          {isAdmin() && <div className="row"><button className="small primary" onClick={() => api(`/roles/${r.id}/approve`, { method: "POST", body: { decision: "approved" } }).then(() => { say("Approved and posted"); load(); })}>Approve</button><button className="small danger" onClick={() => { const note = prompt("Reason (optional)"); api(`/roles/${r.id}/approve`, { method: "POST", body: { decision: "rejected", note } }).then(load); }}>Reject</button></div>}</div>)}</div>}
      {jd && <div className="card" style={{ marginBottom: 12, whiteSpace: "pre-wrap", fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}><b>Job posting draft</b><div className="row"><button className="small" onClick={() => { navigator.clipboard?.writeText(jd); say("Copied"); }}>Copy</button><button className="small" onClick={() => setJd("")}>Close</button></div></div>{jd}</div>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {roles.filter((r) => r.status !== "requested").map((r) => <div key={r.id} className="card" style={{ opacity: r.status === "open" ? 1 : .6 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{r.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>{r.department} · {r.campus}{r.grade && ` · ${r.grade}`}{r.subject && ` · ${r.subject}`} · {r.openings} opening{r.openings > 1 ? "s" : ""} · {r.active} active{r.status === "requested" ? " · awaiting approval" : r.status === "rejected" ? " · requisition rejected" : r.status !== "open" ? " · closed" : ""}{r.manager && ` · hiring manager: ${r.manager}`}</div>
          {r.approved_by_name && <div className="muted" style={{ fontSize: 12 }}>Approved by {r.approved_by_name}{r.reporting_manager && ` · reports to ${r.reporting_manager}`}{r.ijp_until && new Date(r.ijp_until) >= new Date() && ` · internal posting until ${new Date(r.ijp_until).toLocaleDateString("en-IN")}`}</div>}
          {r.salary_band && <div className="muted" style={{ fontSize: 12 }}>{r.salary_band}</div>}
          <ul style={{ paddingLeft: 18, margin: "10px 0", fontSize: 13 }}>{r.criteria.map((c) => <li key={c.id}>{c.text}{c.must && <span style={{ color: "var(--coral)" }}> *</span>}</li>)}</ul>
          <div className="muted" style={{ fontSize: 12 }}>{r.questions.length} interview questions{r.interview_mode === "interactive" ? " + role play" : ""} · 3 panel rounds · {r.open_slots} open interview slot{r.open_slots === 1 ? "" : "s"}</div>
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
  const [r, setR] = useState({ ...role, rubric: role.rubric || [], rubrics: role.rubrics || { "Leadership interview": [{ key: "culture", label: "Fit with school culture and values" }, { key: "communication", label: "Communication and warmth" }, { key: "presence", label: "Classroom presence (teaching roles)" }, { key: "growth", label: "Openness to feedback and growth" }], "Subject assessment": [{ key: "knowledge", label: "Depth and accuracy of subject knowledge" }, { key: "pedagogy", label: "Ability to explain the subject to children" }, { key: "curriculum", label: "Familiarity with the curriculum and board" }, { key: "assessment", label: "Approach to checking understanding" }], "Demo lesson": role.rubric || [] } });
  const setRb = (i, v) => setR({ ...r, rubric: r.rubric.map((x, j) => (j === i ? { ...x, label: v } : x)) });
  const setC = (i, p) => setR({ ...r, criteria: r.criteria.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const setQ = (i, v) => setR({ ...r, questions: r.questions.map((q, j) => (j === i ? v : q)) });
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>{role.id ? "Edit role" : isAdmin() ? "New role" : "Manpower requisition"}</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Step 1 of the HR process. Role, grade, subject or department, number of openings and justification{isAdmin() ? "." : "; the Director approves before it is posted."}</div>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0 10px" }}>
        <Field label="Title"><input value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></Field>
        <Field label="Department"><input value={r.department} onChange={(e) => setR({ ...r, department: e.target.value })} /></Field>
        <Field label="Campus"><input value={r.campus} onChange={(e) => setR({ ...r, campus: e.target.value })} /></Field>
        <Field label="Openings"><input type="number" min={1} value={r.openings} onChange={(e) => setR({ ...r, openings: +e.target.value })} /></Field>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "0 10px" }}>
        <Field label="Grade(s)"><input value={r.grade || ""} onChange={(e) => setR({ ...r, grade: e.target.value })} placeholder="e.g. Grades 3 to 5" /></Field>
        <Field label="Subject"><input value={r.subject || ""} onChange={(e) => setR({ ...r, subject: e.target.value })} placeholder="e.g. Mathematics" /></Field>
        <Field label="Reporting manager (named in the offer letter)"><input value={r.reporting_manager || ""} onChange={(e) => setR({ ...r, reporting_manager: e.target.value })} placeholder="e.g. Primary Coordinator" /></Field>
      </div>
      <Field label="Justification (why this position, why now)"><textarea value={r.justification || ""} onChange={(e) => setR({ ...r, justification: e.target.value })} style={{ minHeight: 60 }} /></Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="Internal job posting first: hide from the public careers page and job feeds until"><input type="date" value={r.ijp_until || ""} onChange={(e) => setR({ ...r, ijp_until: e.target.value })} /></Field>
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
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Panel rounds and their rubrics (each item scored 1 to 5)</div>
      {ROUNDS.map((round) => <div key={round} style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{round}{round === "Leadership interview" ? " (Principal / leadership)" : round === "Subject assessment" ? " (Department Coordinator / subject expert)" : " (Department Coordinator / subject expert)"}</div>
        {(r.rubrics?.[round] || []).map((x, i) => <div key={x.key} className="row" style={{ marginBottom: 6, flexWrap: "nowrap" }}><input value={x.label} onChange={(e) => setR({ ...r, rubrics: { ...r.rubrics, [round]: r.rubrics[round].map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) } })} /><button className="small" onClick={() => setR({ ...r, rubrics: { ...r.rubrics, [round]: r.rubrics[round].filter((_, j) => j !== i) } })}>×</button></div>)}
        <button className="small" onClick={() => setR({ ...r, rubrics: { ...r.rubrics, [round]: [...(r.rubrics?.[round] || []), { key: uid(), label: "" }] } })}>Add item</button>
      </div>)}
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Written English assessment task (30 minutes)</div>
      <textarea value={r.written_prompt || ""} onChange={(e) => setR({ ...r, written_prompt: e.target.value })} placeholder="Leave blank to use the default parent-circular task" style={{ minHeight: 60 }} />
      <div className="row" style={{ marginTop: 18 }}><button className="primary" disabled={!r.title.trim()} onClick={() => onSave({ ...r, rubric: (r.rubrics["Demo lesson"] || []).filter((x) => x.label.trim()), rubrics: Object.fromEntries(Object.entries(r.rubrics).map(([k, v]) => [k, v.filter((x) => x.label.trim())])), written_prompt: r.written_prompt || null })}>{role.id ? "Save role" : isAdmin() ? "Create role" : "Submit requisition"}</button><button onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

function Slots({ role, onBack, say }) {
  const [slots, setSlots] = useState([]); const [f, setF] = useState({ date: "", times: "10:00, 11:00, 12:00", minutes: 45, stage: "Leadership interview", location: "Healthy Planet School, Noida" });
  const load = () => api(`/roles/${role.id}/slots`).then(setSlots);
  useEffect(() => { load(); }, []);
  return <div className="card" style={{ maxWidth: 720 }}>
    <div className="row" style={{ justifyContent: "space-between" }}><div><b style={{ fontSize: 16 }}>Interview slots · {role.title}</b><div className="muted" style={{ fontSize: 13 }}>Candidates pick one of these from the booking link. Each slot takes one candidate.</div></div><button className="small" onClick={onBack}>Back</button></div>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0 10px", marginTop: 12 }}>
      <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <Field label="Start times (comma separated)"><input value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} /></Field>
      <Field label="Minutes each"><input type="number" value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} /></Field>
      <Field label="For"><select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{ROUNDS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Location"><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
    </div>
    <button className="primary" disabled={!f.date} onClick={async () => { try { await api(`/roles/${role.id}/slots`, { method: "POST", body: { ...f, times: f.times.split(",").map((x) => x.trim()).filter(Boolean) } }); say("Slots added"); load(); } catch (e) { say(e.message); } }}>Add slots</button>
    <div className="grid" style={{ gap: 6, marginTop: 14 }}>
      {slots.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No upcoming slots.</div>}
      {slots.map((s) => <div key={s.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--line)" }}><span>{fmtDT(s.starts_at)} · {s.stage} · {s.location}</span>{s.candidate_id ? <b style={{ color: "var(--green)" }}>{s.candidate_name}</b> : <button className="small" onClick={async () => { await api(`/roles/${role.id}/slots/${s.id}`, { method: "DELETE" }); load(); }}>Remove</button>}</div>)}
    </div>
  </div>;
}
