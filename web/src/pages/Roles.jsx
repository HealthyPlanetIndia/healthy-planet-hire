import React, { useEffect, useState } from "react";
import { api, isManager, isAdmin, fmtDT, ROUNDS } from "../api.js";
import { Field } from "../components/ui.jsx";
import { useToast } from "../components/Shell.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
export default function Roles() {
  const say = useToast(); const [roles, setRoles] = useState([]); const [editing, setEditing] = useState(null); const [jd, setJd] = useState(""); const [slotsFor, setSlotsFor] = useState(null); const [managers, setManagers] = useState([]); const [templates, setTemplates] = useState([]); const [picking, setPicking] = useState(false);
  useEffect(() => { api("/roles/defaults/templates").then(setTemplates).catch(() => {}); }, []);
  async function fromTemplate(id) { try { const t = await api(`/roles/defaults/templates/${id}`); const { id: _id, ...rest } = t; setEditing({ ...rest, campus: "Wishtown, Sec 131, Noida", justification: "", ijp_until: "", manager_id: "" }); setPicking(false); } catch (e) { say(e.message); } }
  useEffect(() => { api("/users/managers").then(setManagers).catch(() => {}); }, []);
  const load = () => api("/roles").then(setRoles);
  useEffect(() => { load(); }, []);
  const blank = { title: "", department: "Primary", campus: "Wishtown, Sec 131, Noida", openings: 1, salary_band: "", manager_id: "", grade: "", subject: "", justification: "", reporting_manager: "", ijp_until: "", written_prompt: "", rubrics: null, criteria: [{ id: uid(), text: "", must: true }], questions: [""], rubric: [{ key: "planning", label: "Lesson planning and clarity of objectives" }, { key: "engagement", label: "Student engagement and questioning" }, { key: "management", label: "Classroom management and warmth" }, { key: "subject", label: "Subject knowledge and accuracy" }, { key: "reflection", label: "Reflection and openness in the debrief" }] };
  async function save(r) { try { const body = { ...r, criteria: (r.criteria || []).filter((c) => (c.text || "").trim()), questions: (r.questions || []).map((q) => (typeof q === "string" ? { text: q, assesses: "Classroom thinking" } : q)).filter((q) => (q.text || "").trim()) }; await api(r.id ? `/roles/${r.id}` : "/roles", { method: r.id ? "PUT" : "POST", body }); setEditing(null); load(); say("Role saved"); } catch (e) { say(e.message); } }
  if (editing) return <RoleForm role={editing} managers={managers} onSave={save} onCancel={() => setEditing(null)} />;
  if (slotsFor) return <Slots role={slotsFor} onBack={() => { setSlotsFor(null); load(); }} say={say} />;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}><span className="muted">{isManager() ? "Raise a manpower requisition here. The Director approves it before the role is posted." : "Define the role once. Every applicant is then screened and interviewed against the same criteria."}</span><div className="row" style={{ marginLeft: "auto" }}><button onClick={() => setPicking(!picking)}>Start from a template</button><button className="primary" onClick={() => setEditing(blank)}>{isManager() || !isAdmin() ? "Raise requisition (blank)" : "New role (blank)"}</button></div></div>
      {picking && <div className="card" style={{ marginBottom: 12, borderColor: "var(--green)" }}><b>Templates</b><div className="muted" style={{ fontSize: 13, margin: "4px 0 8px" }}>A complete starting point: criteria, a question bank with three variants per competency, scenarios with hidden issues, rubrics, Maya's brief and the timing. Everything is editable before you submit.</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>{templates.map((t) => <button key={t.id} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => fromTemplate(t.id)}><b>{t.title}</b><div className="muted" style={{ fontSize: 12 }}>{t.department} · {t.grade}<br />{t.questions} questions in the bank · {t.scenarios} scenarios</div></button>)}</div></div>}
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
  const qs = (r.questions || []).map((q) => (typeof q === "string" ? { text: q, assesses: "Classroom thinking" } : q));
  const setQ = (i, patch) => setR({ ...r, questions: qs.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const [status, setStatus] = useState(null); useEffect(() => { api("/status").then(setStatus).catch(() => {}); }, []);
  const comps = status?.competencies || ["Classroom thinking", "Child-centred practice", "Handling parents", "School values", "Subject knowledge", "Inquiry or project-based learning", "Digital tools", "Classroom management", "Reflection and growth", "Other"];
  const covered = new Set(qs.map((q) => q.assesses));
  const uncovered = (r.criteria || []).filter((c) => c.text.trim() && ![...covered].some((k) => c.text.toLowerCase().includes(k.toLowerCase().split(" ")[0])));
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>{role.id ? "Edit role" : isAdmin() ? "New role" : "Manpower requisition"}</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Step 1 of the HR process. Role, grade, subject or department, number of openings and justification{isAdmin() ? "." : "; the Director approves before it is posted."}</div>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0 10px" }}>
        <Field label="Title"><input value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></Field>
        <Field label="Department"><input value={r.department} onChange={(e) => setR({ ...r, department: e.target.value })} /></Field>
        <Field label="Campus"><select value={r.campus} onChange={(e) => setR({ ...r, campus: e.target.value })}>{(status?.campuses || ["Sun City, NH24, Ghaziabad", "Wishtown, Sec 131, Noida"]).map((c) => <option key={c}>{c}</option>)}</select></Field>
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
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Group questions by what they assess. Each candidate is asked <b>one question per competency, drawn at random</b>, so no two interviews are identical but everyone is assessed on the same things. Add two or three variants per competency; anchor each to the grade band ("with your Grade 3 to 5 class"). Anything not asked about is reported as "not assessed".</div>
      {comps.filter((k) => qs.some((q) => q.assesses === k)).map((k) => <div key={k} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", marginBottom: 6 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 13 }}>{k}</b><span className="muted" style={{ fontSize: 11 }}>{qs.filter((q) => q.assesses === k).length} variant{qs.filter((q) => q.assesses === k).length === 1 ? "" : "s"}, one asked per interview</span></div>
        {qs.map((q, i) => q.assesses === k && <div key={i} className="row" style={{ marginTop: 6, flexWrap: "nowrap" }}><input value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} style={{ flex: 1 }} /><select value={q.assesses} onChange={(e) => setQ(i, { assesses: e.target.value })} style={{ width: "auto", maxWidth: 160 }}>{comps.map((c) => <option key={c}>{c}</option>)}</select><button className="small" onClick={() => setR({ ...r, questions: qs.filter((_, j) => j !== i) })}>×</button></div>)}
        <button className="small" style={{ marginTop: 6 }} onClick={() => setR({ ...r, questions: [...qs, { text: "", assesses: k }] })}>Add a variant</button>
      </div>)}
      <div className="row"><select id="newcomp" style={{ width: "auto" }} defaultValue="">{["", ...comps.filter((k) => !qs.some((q) => q.assesses === k))].map((k) => <option key={k} value={k}>{k || "Add a competency..."}</option>)}</select><button className="small" onClick={() => { const k = document.getElementById("newcomp").value; if (k) setR({ ...r, questions: [...qs, { text: "", assesses: k }] }); }}>Add</button></div>
      {uncovered.length > 0 && <div style={{ fontSize: 12, background: "#FDF3D6", borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>No question is designed to test: {uncovered.map((c) => c.text).join("; ")}. These will show as "not assessed" in interview reports unless you add a question for them.</div>}
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Brief for Maya (what a panel member would know)</div>
      <textarea value={r.brief || ""} onChange={(e) => setR({ ...r, brief: e.target.value })} placeholder="e.g. Children aged 8 to 11 in Grades 3 to 5; class teacher for all subjects except Hindi; CBSE-aligned; classes of about 28; project work and outdoor learning are timetabled" style={{ minHeight: 60 }} />
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Interview languages offered to candidates</div>
      <div className="row">{Object.entries(status?.languages || { en: "English", hi: "हिन्दी" }).map(([k, l]) => <label key={k} style={{ fontSize: 13 }}><input type="checkbox" style={{ width: "auto" }} checked={(r.languages || ["en"]).includes(k)} disabled={k === "en"} onChange={(e) => setR({ ...r, languages: e.target.checked ? [...(r.languages || ["en"]), k] : (r.languages || ["en"]).filter((x) => x !== k) })} /> {l}</label>)}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>English is always on. Add others only when the role needs them, for example a Hindi teacher.</div>
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Interview length</div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Field label="Questions per interview (drawn from the bank, one per competency)"><select value={r.max_questions || 4} onChange={(e) => setR({ ...r, max_questions: +e.target.value })}>{[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 4 ? "(recommended, about 12 to 15 minutes with a scenario)" : ""}</option>)}</select></Field>
        <Field label="Maximum seconds per answer (recording stops automatically)"><select value={r.answer_seconds || 90} onChange={(e) => setR({ ...r, answer_seconds: +e.target.value })}>{[60, 75, 90, 120, 150].map((n) => <option key={n} value={n}>{n} seconds</option>)}</select></Field>
      </div>
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Interview style</div>
      <div className="row" style={{ marginBottom: 6 }}>{[["standard", "Standard: questions only (~10 min)"], ["interactive", "Interactive: questions plus one scenario drawn from the bank below (~15 min)"]].map(([k, l]) => <label key={k} style={{ fontSize: 13 }}><input type="radio" style={{ width: "auto" }} checked={(r.interview_mode || "standard") === k} onChange={() => setR({ ...r, interview_mode: k })} /> {l}</label>)}</div>
      {r.interview_mode === "interactive" && <Scenarios r={r} setR={setR} comps={comps} />}
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Panel rounds and their rubrics (each item scored 1 to 5)</div>
      {ROUNDS.map((round) => <div key={round} style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{round}{round === "Leadership interview" ? " (Principal / leadership)" : round === "Subject assessment" ? " (Department Coordinator / subject expert)" : " (Department Coordinator / subject expert)"}</div>
        {(r.rubrics?.[round] || []).map((x, i) => <div key={x.key} className="row" style={{ marginBottom: 6, flexWrap: "nowrap" }}><input value={x.label} onChange={(e) => setR({ ...r, rubrics: { ...r.rubrics, [round]: r.rubrics[round].map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) } })} /><button className="small" onClick={() => setR({ ...r, rubrics: { ...r.rubrics, [round]: r.rubrics[round].filter((_, j) => j !== i) } })}>×</button></div>)}
        <button className="small" onClick={() => setR({ ...r, rubrics: { ...r.rubrics, [round]: [...(r.rubrics?.[round] || []), { key: uid(), label: "" }] } })}>Add item</button>
      </div>)}
      <div style={{ fontWeight: 500, margin: "16px 0 6px" }}>Written English assessment task (30 minutes)</div>
      <textarea value={r.written_prompt || ""} onChange={(e) => setR({ ...r, written_prompt: e.target.value })} placeholder="Leave blank to use the default parent-circular task" style={{ minHeight: 60 }} />
      <div className="row" style={{ marginTop: 18 }}><button className="primary" disabled={!r.title.trim()} onClick={() => onSave({ ...r, questions: qs.filter((q) => q.text.trim()), rubric: (r.rubrics["Demo lesson"] || []).filter((x) => x.label.trim()), rubrics: Object.fromEntries(Object.entries(r.rubrics).map(([k, v]) => [k, v.filter((x) => x.label.trim())])), written_prompt: r.written_prompt || null })}>{role.id ? "Save role" : isAdmin() ? "Create role" : "Submit requisition"}</button><button onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

function Slots({ role, onBack, say }) {
  const [slots, setSlots] = useState([]); const [f, setF] = useState({ date: "", times: "10:00, 11:00, 12:00", minutes: 45, stage: "Leadership interview", location: `Healthy Planet School, ${role.campus}` });
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

// Scenario bank editor. Two kinds: a role play (Maya plays a parent whose stated concern hides the real one) and a
// classroom situation (Maya describes a moment, asks what the candidate does, then adds a twist).
function Scenarios({ r, setR, comps }) {
  const list = r.scenarios || [];
  const set = (i, patch) => setR({ ...r, scenarios: list.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const [open, setOpen] = useState(null);
  return <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
    <div className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 13 }}>Scenario bank ({list.length})</b><div className="row"><button className="small" onClick={async () => { const d = await api("/roles/defaults/scenarios"); const have = new Set(list.map((x) => x.id)); setR({ ...r, scenarios: [...list, ...d.filter((x) => !have.has(x.id))] }); }}>Add the suggested scenarios</button><button className="small" onClick={() => { setR({ ...r, scenarios: [...list, { id: "c" + uid(), type: "roleplay", title: "", assesses: "Handling parents", persona: "", surface: "", underlying: "", setup: "", twist: "", observe: "" }] }); setOpen(list.length); }}>New scenario</button></div></div>
    <div className="muted" style={{ fontSize: 12, margin: "4px 0 8px" }}>Each interview draws one at random. In a role play the parent says only the surface concern; the real issue comes out only if the candidate listens and probes. In a situation Maya describes the moment, asks what they would do, then adds the twist.</div>
    {list.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No scenarios yet. Add the suggested ones to start.</div>}
    {list.map((sc, i) => <div key={sc.id || i} style={{ borderTop: "1px solid var(--line)", padding: "6px 0" }}>
      <div className="row" style={{ justifyContent: "space-between" }}><span style={{ fontSize: 13 }}><span className="pill" style={{ background: sc.type === "roleplay" ? "#EAF1FB" : "#E6F1EA", marginRight: 6 }}>{sc.type === "roleplay" ? "Role play" : "Situation"}</span><b>{sc.title || "(untitled)"}</b> <span className="muted">· {sc.assesses}</span></span><div className="row"><button className="small" onClick={() => setOpen(open === i ? null : i)}>{open === i ? "Close" : "Edit"}</button><button className="small danger" onClick={() => setR({ ...r, scenarios: list.filter((_, j) => j !== i) })}>×</button></div></div>
      {open === i && <div style={{ marginTop: 6 }}>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: "0 8px" }}>
          <Field label="Title (for you, not the candidate)"><input value={sc.title} onChange={(e) => set(i, { title: e.target.value })} /></Field>
          <Field label="Kind"><select value={sc.type} onChange={(e) => set(i, { type: e.target.value })}><option value="roleplay">Role play (Maya plays a person)</option><option value="situation">Classroom situation</option></select></Field>
          <Field label="Assesses"><select value={sc.assesses} onChange={(e) => set(i, { assesses: e.target.value })}>{comps.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        {sc.type === "roleplay" ? <>
          <Field label="Who Maya plays, and the setting"><input value={sc.persona || ""} onChange={(e) => set(i, { persona: e.target.value })} placeholder="e.g. Mrs Mehra, mother of Riya in Grade 4, polite but tense, at pick-up time" /></Field>
          <Field label="What the parent says at first (the surface concern)"><textarea value={sc.surface || ""} onChange={(e) => set(i, { surface: e.target.value })} style={{ minHeight: 50 }} /></Field>
          <Field label="What is really going on, revealed only if the candidate listens and probes"><textarea value={sc.underlying || ""} onChange={(e) => set(i, { underlying: e.target.value })} style={{ minHeight: 50 }} /></Field>
        </> : <>
          <Field label="The classroom moment Maya describes"><textarea value={sc.setup || ""} onChange={(e) => set(i, { setup: e.target.value })} style={{ minHeight: 50 }} /></Field>
          <Field label="The twist Maya adds after their first answer"><textarea value={sc.twist || ""} onChange={(e) => set(i, { twist: e.target.value })} style={{ minHeight: 40 }} /></Field>
        </>}
        <Field label="What the panel wants to see (guides the report; the candidate never sees this)"><textarea value={sc.observe || ""} onChange={(e) => set(i, { observe: e.target.value })} style={{ minHeight: 50 }} /></Field>
      </div>}
    </div>)}
  </div>;
}
