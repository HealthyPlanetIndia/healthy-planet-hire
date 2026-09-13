import React, { useEffect, useState } from "react";
import { api, STAGES } from "../api.js";
import { Field } from "../components/ui.jsx";
import { useToast } from "../components/Shell.jsx";
import CandidatePanel from "../components/CandidatePanel.jsx";

const TRIGGERS = { stage_change: "a candidate moves stage", screened: "a resume is screened", interview_report: "an AI interview report arrives", booked: "a candidate books an interview", reply: "a candidate replies on WhatsApp" };
const ACTIONS = { send_message: "send a message", send_interview: "send the AI interview link", move_stage: "move to a stage", add_note: "add a note and flag for review" };

export default function Automation() {
  const say = useToast(); const [rules, setRules] = useState([]); const [templates, setTemplates] = useState({}); const [roles, setRoles] = useState([]); const [faqs, setFaqs] = useState([]); const [inbox, setInbox] = useState([]); const [openId, setOpenId] = useState(null);
  const [nr, setNr] = useState({ name: "", trigger: "stage_change", conditions: {}, actions: [{ type: "send_message", channel: "whatsapp", template: "Shortlist" }] });
  const [fq, setFq] = useState({ question: "", answer: "" }); const [tester, setTester] = useState({ candidate_id: "", text: "" }); const [testOut, setTestOut] = useState("");
  const load = () => { api("/rules").then((r) => setRules(r.rules)); api("/faqs").then(setFaqs); api("/inbox").then(setInbox); };
  useEffect(() => { load(); api("/templates").then(setTemplates); api("/roles").then(setRoles); }, []);
  const describe = (r) => { const c = r.conditions, parts = []; if (c.stage) parts.push(`stage is ${c.stage}`); if (c.min_score != null) parts.push(`score ≥ ${c.min_score}`); if (c.max_score != null) parts.push(`score ≤ ${c.max_score}`); if (c.risk?.length) parts.push(`integrity is ${c.risk.join("/")}`); if (c.role_id) parts.push(`role is ${roles.find((x) => x.id == c.role_id)?.title || c.role_id}`); return `When ${TRIGGERS[r.trigger]}${parts.length ? " and " + parts.join(" and ") : ""}: ${r.actions.map((a) => ACTIONS[a.type] + (a.template ? ` "${a.template}" on ${a.channel}` : a.stage ? ` "${a.stage}"` : "")).join(", then ")}.`; };
  const act = nr.actions[0];
  return <div className="grid" style={{ maxWidth: 900 }}>
    {inbox.length > 0 && <div className="card" style={{ borderColor: "var(--coral)" }}>
      <b>Replies that need a person ({inbox.length})</b>
      <div className="muted" style={{ fontSize: 13, margin: "4px 0 8px" }}>The assistant answered what it could from the FAQ list. These it could not, or the candidate asked for someone.</div>
      {inbox.map((c) => <div key={c.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--line)" }}><span><b>{c.name}</b> · {c.role_title} · {c.stage}<div className="muted">"{c.last_in}"</div></span><div className="row"><button className="small" onClick={() => setOpenId(c.id)}>Reply</button><button className="small" onClick={() => api(`/candidates/${c.id}`, { method: "PUT", body: { needs_human: 0 } }).then(load)}>Done</button></div></div>)}
    </div>}
    <div className="card">
      <b>Automation rules</b>
      <div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>Repeatable actions that run on their own. Start with the suggested ones switched off; turn each on once the template wording is how you want it. Every run is recorded on the candidate's history.</div>
      {rules.map((r) => <div key={r.id} className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 13, flexWrap: "nowrap", alignItems: "flex-start" }}>
        <label className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 10, flex: 1 }}><input type="checkbox" style={{ width: "auto", marginTop: 3 }} checked={!!r.enabled} onChange={(e) => api(`/rules/${r.id}`, { method: "PUT", body: { enabled: e.target.checked ? 1 : 0 } }).then(load)} /><span><b>{r.name}</b><div className="muted">{describe(r)}{r.runs ? ` Ran ${r.runs} time${r.runs > 1 ? "s" : ""}.` : ""}</div></span></label>
        <button className="small danger" onClick={() => api(`/rules/${r.id}`, { method: "DELETE" }).then(load)}>Delete</button>
      </div>)}
      <div style={{ marginTop: 14, background: "var(--soft)", borderRadius: 10, padding: 12 }}>
        <b style={{ fontSize: 14 }}>New rule</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 10px", marginTop: 6 }}>
          <Field label="Name"><input value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} /></Field>
          <Field label="When"><select value={nr.trigger} onChange={(e) => setNr({ ...nr, trigger: e.target.value })}>{Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Only if stage is"><select value={nr.conditions.stage || ""} onChange={(e) => setNr({ ...nr, conditions: { ...nr.conditions, stage: e.target.value || undefined } })}><option value="">any</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Only if role is"><select value={nr.conditions.role_id || ""} onChange={(e) => setNr({ ...nr, conditions: { ...nr.conditions, role_id: e.target.value || undefined } })}><option value="">any</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></Field>
          <Field label="Score at least"><input type="number" value={nr.conditions.min_score ?? ""} onChange={(e) => setNr({ ...nr, conditions: { ...nr.conditions, min_score: e.target.value === "" ? undefined : +e.target.value } })} /></Field>
          <Field label="Score at most"><input type="number" value={nr.conditions.max_score ?? ""} onChange={(e) => setNr({ ...nr, conditions: { ...nr.conditions, max_score: e.target.value === "" ? undefined : +e.target.value } })} /></Field>
          <Field label="Then"><select value={act.type} onChange={(e) => setNr({ ...nr, actions: [{ type: e.target.value, channel: "whatsapp", template: "Shortlist", stage: "Shortlist", kind: "text", text: "" }] })}>{Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {act.type === "send_message" && <><Field label="Template"><select value={act.template} onChange={(e) => setNr({ ...nr, actions: [{ ...act, template: e.target.value }] })}>{Object.keys(templates).map((k) => <option key={k}>{k}</option>)}</select></Field><Field label="Channel"><select value={act.channel} onChange={(e) => setNr({ ...nr, actions: [{ ...act, channel: e.target.value }] })}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select></Field></>}
          {act.type === "move_stage" && <Field label="To stage"><select value={act.stage} onChange={(e) => setNr({ ...nr, actions: [{ ...act, stage: e.target.value }] })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>}
          {act.type === "add_note" && <Field label="Note"><input value={act.text} onChange={(e) => setNr({ ...nr, actions: [{ ...act, text: e.target.value }] })} /></Field>}
        </div>
        <button className="primary" disabled={!nr.name.trim()} onClick={() => api("/rules", { method: "POST", body: nr }).then(() => { say("Rule added"); setNr({ ...nr, name: "" }); load(); }).catch((e) => say(e.message))}>Add rule</button>
      </div>
    </div>
    <div className="card">
      <b>WhatsApp assistant: questions it may answer</b>
      <div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>When a candidate replies on WhatsApp, the assistant answers only from these facts and the candidate's own status. Anything else is handed to a person and appears above.</div>
      {faqs.map((f) => <div key={f.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--line)", alignItems: "flex-start" }}><span style={{ flex: 1 }}><b>{f.question}</b><div className="muted">{f.answer}</div></span><button className="small danger" onClick={() => api(`/faqs/${f.id}`, { method: "DELETE" }).then(load)}>Remove</button></div>)}
      <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: "0 10px", marginTop: 10 }}><Field label="Question"><input value={fq.question} onChange={(e) => setFq({ ...fq, question: e.target.value })} /></Field><Field label="Answer"><input value={fq.answer} onChange={(e) => setFq({ ...fq, answer: e.target.value })} /></Field></div>
      <div className="row"><button disabled={!fq.question || !fq.answer} onClick={() => api("/faqs", { method: "POST", body: fq }).then(() => { setFq({ question: "", answer: "" }); load(); })}>Add answer</button></div>
      <details style={{ marginTop: 10, fontSize: 13 }}><summary>Test the assistant</summary><div className="row" style={{ marginTop: 6 }}><input placeholder="Candidate ID" value={tester.candidate_id} onChange={(e) => setTester({ ...tester, candidate_id: e.target.value })} style={{ width: 110 }} /><input placeholder="A message a candidate might send" value={tester.text} onChange={(e) => setTester({ ...tester, text: e.target.value })} style={{ flex: 1 }} /><button onClick={() => api("/faqs/test", { method: "POST", body: tester }).then((r) => setTestOut(r.replied ? "Answered automatically (see the candidate's messages)." : "Handed to a person.")).catch((e) => setTestOut(e.message))}>Try</button></div>{testOut && <div className="muted" style={{ marginTop: 6 }}>{testOut}</div>}</details>
    </div>
    {openId && <CandidatePanel id={openId} roles={roles} onClose={() => { setOpenId(null); load(); }} />}
  </div>;
}
