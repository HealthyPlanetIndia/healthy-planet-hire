import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { Score, Pill } from "../components/ui.jsx";

// Read-only candidate report for anyone with the link (hiring manager, board member, external panelist).
export default function SharedReport() {
  const { token } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState("");
  useEffect(() => { api(`/public/report/${token}`, { auth: false }).then(setD).catch((e) => setErr(e.message)); }, [token]);
  if (err) return <Wrap><div className="card">{err}</div></Wrap>;
  if (!d) return <Wrap><span className="muted">Loading...</span></Wrap>;
  const s = d.screening, iv = d.interview?.report, evals = d.evaluations;
  const avg = (e) => Object.values(e.scores || {}).reduce((a, b) => a + +b, 0) / Math.max(1, Object.keys(e.scores || {}).length);
  return <Wrap>
    <div className="card">
      <div className="muted" style={{ fontSize: 12 }}>Healthy Planet School · Candidate report · {d.campus}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{d.name}</div>
      <div className="muted">{d.role} · currently at {d.stage}</div>
      <div className="row" style={{ marginTop: 12, gap: 16 }}>
        {s && <div><div className="muted" style={{ fontSize: 12 }}>Resume screening</div><Score v={s.overall} /><span className="muted"> /100 · {s.recommendation}</span></div>}
        {iv && <div><div className="muted" style={{ fontSize: 12 }}>AI interview</div><Score v={iv.overall} /><span className="muted"> /100 · {iv.recommendation}</span></div>}
        {evals.length > 0 && <div><div className="muted" style={{ fontSize: 12 }}>Panel ({evals.length})</div><b>{(evals.reduce((a, e) => a + avg(e), 0) / evals.length).toFixed(1)}</b><span className="muted"> /5</span></div>}
      </div>
    </div>
    {s && <div className="card"><b>Screening against the role criteria</b><div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>{s.summary}</div>
      {s.criteria.map((cr) => { const def = d.criteria.find((x) => x.id === cr.id); return <div key={cr.id} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 10, marginBottom: 8, fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between" }}><span>{def?.text || cr.id}</span><Pill v={cr.verdict} /></div>{cr.evidence && <div className="evidence">“{cr.evidence}”</div>}</div>; })}</div>}
    {iv && <div className="card"><b>AI interview</b><div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>{iv.summary}</div>
      {iv.dimensions.map((x, i) => <div key={i} style={{ fontSize: 13, marginBottom: 6 }}><div className="row" style={{ justifyContent: "space-between" }}><span>{x.name}</span><Score v={x.score} /></div><div className="muted" style={{ fontSize: 12 }}>{x.note}</div></div>)}
      <div style={{ fontSize: 13, marginTop: 8 }}><b>Strengths:</b> {iv.strengths}</div><div style={{ fontSize: 13 }}><b>Concerns:</b> {iv.concerns}</div>
      {iv.suggested_questions && <div style={{ fontSize: 13, marginTop: 6 }}><b>Suggested for your interview:</b> {iv.suggested_questions.join(" / ")}</div>}
      {d.interview.integrity && d.interview.integrity !== "clear" && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Integrity check: {d.interview.integrity}. Ask the recruiting team for detail.</div>}</div>}
    {evals.length > 0 && <div className="card"><b>Panel scores</b>{d.rubric.map((r) => { const v = evals.map((e) => +e.scores?.[r.key]).filter(Boolean); return <div key={r.key} className="row" style={{ justifyContent: "space-between", fontSize: 13, marginTop: 4 }}><span className="muted">{r.label}</span><b>{v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–"} / 5</b></div>; })}
      {evals.map((e, i) => <div key={i} style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8, fontSize: 13 }}><b>{e.panelist}</b> · {e.stage} · {avg(e).toFixed(1)}/5 · {e.recommendation}{e.comment && <div className="muted">{e.comment}</div>}</div>)}</div>}
    {d.resume_excerpt && <details className="card" style={{ fontSize: 13 }}><summary>Resume excerpt</summary><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{d.resume_excerpt}</pre></details>}
    <div className="muted" style={{ fontSize: 11, textAlign: "center" }}>Confidential. Shared by Healthy Planet School's recruiting team; please do not forward.</div>
  </Wrap>;
}
const Wrap = ({ children }) => <div style={{ minHeight: "100vh", padding: 16, maxWidth: 720, margin: "0 auto", display: "grid", gap: 12, alignContent: "start" }}>{children}</div>;
