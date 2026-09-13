import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const Bar = ({ v, max, color = "var(--green)" }) => <div style={{ height: 8, background: "var(--soft)", borderRadius: 4 }}><div style={{ width: `${max ? (v / max) * 100 : 0}%`, height: 8, background: color, borderRadius: 4 }} /></div>;
export default function Analytics() {
  const [a, setA] = useState(null);
  useEffect(() => { api("/analytics").then(setA); }, []);
  if (!a) return <div className="muted">Loading...</div>;
  const funnelStages = a.stages.slice(0, 13);
  return <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
    <div className="card">
      <b>Funnel by role</b>
      {a.roles.map((r) => { const max = Math.max(...funnelStages.map((s) => r.stages[s] || 0), 1); return <div key={r.title} style={{ marginTop: 12 }}><div style={{ fontWeight: 500, fontSize: 13 }}>{r.title}</div>{funnelStages.map((s) => <div key={s} className="row" style={{ fontSize: 12, gap: 8, marginTop: 3 }}><span className="muted" style={{ width: 110 }}>{s}</span><div style={{ flex: 1 }}><Bar v={r.stages[s] || 0} max={max} /></div><span style={{ width: 24, textAlign: "right" }}>{r.stages[s] || 0}</span></div>)}</div>; })}
    </div>
    <div className="card">
      <b>Where good candidates come from</b>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Applicants per source, and how many reached Shortlist or were hired</div>
      {a.sources.map((s) => <div key={s.source} style={{ marginBottom: 8, fontSize: 13 }}><div className="row" style={{ justifyContent: "space-between" }}><span>{s.source}</span><span className="muted">{s.total} applied · {s.shortlisted} shortlisted · {s.hired} hired</span></div><Bar v={s.shortlisted} max={s.total} color="var(--blue)" /></div>)}
    </div>
    <div className="card">
      <b>Time to offer</b>
      {a.timeToOffer.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No offers yet.</div>}
      {a.timeToOffer.map((r) => <div key={r.title} className="row" style={{ justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>{r.title}</span><b>{r.days} days <span className="muted" style={{ fontWeight: 400 }}>({r.n} offer{r.n > 1 ? "s" : ""})</span></b></div>)}
      <div style={{ marginTop: 16 }}><b>Where people drop out</b>{a.dropoff.map((d) => <div key={d.from_stage} className="row" style={{ justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>From {d.from_stage}</span><span>{d.n}</span></div>)}{a.dropoff.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No drop-offs recorded.</div>}</div>
    </div>
    <div className="card">
      <b>Applications per month</b>
      {[...a.monthly].reverse().map((m) => <div key={m.m} className="row" style={{ fontSize: 12, gap: 8, marginTop: 4 }}><span className="muted" style={{ width: 60 }}>{m.m}</span><div style={{ flex: 1 }}><Bar v={m.n} max={Math.max(...a.monthly.map((x) => x.n))} color="var(--yellow)" /></div><span>{m.n}</span></div>)}
      <div style={{ marginTop: 16 }}><b>Integrity checks</b>{a.integrity.map((i) => <div key={i.risk} className="row" style={{ justifyContent: "space-between", fontSize: 13, marginTop: 4 }}><span style={{ textTransform: "capitalize" }}>{i.risk}</span><span>{i.n}</span></div>)}</div>
      <div style={{ marginTop: 16 }}><b>Panel scores</b>{a.evaluations.map((e) => <div key={e.stage} className="row" style={{ justifyContent: "space-between", fontSize: 13, marginTop: 4 }}><span>{e.stage}</span><span>{e.avg} / 5 <span className="muted">({e.n})</span></span></div>)}</div>
    </div>
  </div>;
}
