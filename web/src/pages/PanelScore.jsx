import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

// Panel members (principal, HOD, coordinator) score a demo lesson or interview from their phone. No login.
export default function PanelScore() {
  const { token } = useParams(); const [f, setF] = useState(null); const [err, setErr] = useState(""); const [scores, setScores] = useState({}); const [comment, setComment] = useState(""); const [rec, setRec] = useState(""); const [name, setName] = useState(""); const [done, setDone] = useState(false);
  useEffect(() => { api(`/public/score/${token}`, { auth: false }).then((d) => { setF(d); setName(d.panelist || ""); if (d.submitted) { setScores(d.scores || {}); setComment(d.comment); setRec(d.recommendation); setDone(true); } }).catch((e) => setErr(e.message)); }, [token]);
  if (err) return <Wrap><div className="card">{err}</div></Wrap>;
  if (!f) return <Wrap><span className="muted">Loading...</span></Wrap>;
  const complete = f.rubric.every((r) => scores[r.key]);
  return <Wrap>
    <div className="card">
      <div className="muted" style={{ fontSize: 12 }}>Healthy Planet School · {f.stage}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{f.candidate}</div>
      <div className="muted" style={{ marginBottom: 12 }}>{f.role}</div>
      <label className="field">Your name<input value={name} onChange={(e) => setName(e.target.value)} disabled={done} /></label>
      {f.rubric.map((r) => <div key={r.key} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, marginBottom: 6 }}>{r.label}</div>
        <div className="row" style={{ gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} disabled={done} className={scores[r.key] === n ? "primary" : ""} style={{ width: 44, padding: "8px 0" }} onClick={() => setScores({ ...scores, [r.key]: n })}>{n}</button>)}</div>
      </div>)}
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>1 = well below what we need · 3 = meets · 5 = exceptional</div>
      <label className="field">Overall recommendation<div className="row">{["Hire", "Hire with support", "Not now"].map((o) => <button key={o} disabled={done} className={rec === o ? "warm" : ""} onClick={() => setRec(o)}>{o}</button>)}</div></label>
      <label className="field">What stood out, good or worrying<textarea value={comment} onChange={(e) => setComment(e.target.value)} disabled={done} /></label>
      {!done && <button className="primary" disabled={!complete || !rec} style={{ width: "100%" }} onClick={async () => { try { await api(`/public/score/${token}`, { method: "POST", body: { scores, comment, recommendation: rec, panelist: name }, auth: false }); setDone(true); } catch (e) { setErr(e.message); } }}>Submit scores</button>}
      {done && <div style={{ color: "var(--green)", fontWeight: 500 }}>Thank you. Your scores are with the recruiting team.</div>}
    </div>
  </Wrap>;
}
const Wrap = ({ children }) => <div style={{ minHeight: "100vh", padding: 16, maxWidth: 560, margin: "0 auto" }}>{children}</div>;
