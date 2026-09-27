import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, isAdmin } from "../api.js";

export default function Dashboard() {
  const [d, setD] = useState(null); const [s, setS] = useState(null); const [setupState, setSetup] = useState(null); const [reqs, setReqs] = useState([]);
  useEffect(() => { if (isAdmin()) api("/requisitions").then(setReqs).catch(() => {}); }, []);
  useEffect(() => { api("/dashboard").then(setD).catch(() => setD({ byStage: [], newThisWeek: 0, avgDaysToOffer: null, interviews: [] })); api("/status").then(setS).catch(() => {}); if (isAdmin()) api("/setup").then(setSetup).catch(() => {}); }, []);
  if (!d) return <div className="muted">Loading...</div>;
  const n = (st) => d.byStage.find((x) => x.stage === st)?.n || 0;
  const active = ["Applied", "Screened", "AI interview", "Screening call", "Shortlist", "Leadership interview", "Subject assessment", "Demo lesson", "Written assessment", "Final review", "HR discussion", "Offer"].reduce((a, st) => a + n(st), 0);
  const done = d.interviews.find((x) => x.status === "completed")?.n || 0;
  const todo = setupState?.items.filter((i) => !i.optional && !i.ok) || [];
  return (
    <div className="grid">
      {(reqs.length > 0 || n("Final review") > 0) && <div className="card" style={{ borderColor: "var(--blue)" }}><b>Waiting for the Director</b><div className="muted" style={{ fontSize: 13 }}>{reqs.length > 0 && <div><Link to="/roles">{reqs.length} manpower requisition{reqs.length > 1 ? "s" : ""}</Link> to approve or reject.</div>}{n("Final review") > 0 && <div><Link to="/pipeline">{n("Final review")} candidate{n("Final review") > 1 ? "s" : ""}</Link> at Final review awaiting your decision.</div>}</div></div>}
      {todo.length > 0 && <Link to="/setup" className="card" style={{ textDecoration: "none", color: "inherit", borderColor: "var(--yellow)", background: "#FFFBEF" }}><b>Finish setting up</b><div className="muted" style={{ fontSize: 13 }}>{todo.length} required step{todo.length > 1 ? "s" : ""} left: {todo.map((i) => i.label).join(", ")}. Open Setup to test connections and fix them.</div></Link>}
      <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 0, padding: "14px 8px" }}>
        {[["Active candidates", active], ["New this week", d.newThisWeek], ["Awaiting screening", n("Applied")], ["AI interviews done", done], ["Avg days to offer", d.avgDaysToOffer ?? "none yet"], ["In talent pool", n("Talent pool")]].map(([l, v], i) => <div key={l} style={{ padding: "2px 14px", borderLeft: i ? "1px solid var(--line)" : "none" }}><div className="stat" style={{ fontSize: 26 }}>{v}</div><div className="muted" style={{ fontSize: 12 }}>{l}</div></div>)}
      </div>
      <RolesBoard d={d} />
      <details className="card">
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>Pipeline, all roles combined <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(stage totals across every role)</span></summary>
        <div style={{ height: 10 }} />
        <div className="row" style={{ gap: 4, alignItems: "stretch" }}>
          {["Applied", "Screened", "AI interview", "Screening call", "Shortlist", "Leadership interview", "Subject assessment", "Demo lesson", "Written assessment", "Final review", "HR discussion", "Offer", "Joined"].map((st) => <Link key={st} to={`/pipeline`} style={{ flex: 1, minWidth: 90, textDecoration: "none", color: "inherit", background: "var(--soft)", borderRadius: 8, padding: 10, textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 20 }}>{n(st)}</div><div className="muted" style={{ fontSize: 11 }}>{st}</div></Link>)}
        </div>
      </details>
      {s && <div className="card" style={{ fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Connections</div>
        <div className="row" style={{ gap: 16 }}>
          <span>{s.ai ? "●" : "○"} AI screening & interviews {s.ai ? "on" : "off (set ANTHROPIC_API_KEY)"}</span>
          <span>{s.whatsapp ? "●" : "○"} WhatsApp API {s.whatsapp ? "on" : "off (using open-chat links)"}</span>
          <span>{s.email ? "●" : "○"} Email {s.email ? "on" : "off (using mailto links)"}</span>
          <span>{s.video ? "●" : "○"} Video interviews {s.video ? "on" : "off (set DAILY_API_KEY)"}</span>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Interview links use {s.public_url}. Automatic nudges go out daily at 10:00 IST after {s.followup_days} quiet days, once WhatsApp API is connected.</div>
      </div>}
    </div>
  );
}

// Applications by role: one row per role, one bar per row. The bar groups the fifteen stages into five
// phases so the shape of a pipeline is readable at a glance; tap a row for the stage-by-stage detail.
const PHASES = [
  { key: "new", label: "New", stages: ["Applied", "Screened"], color: "#C9CDD3" },
  { key: "interview", label: "AI interview", stages: ["AI interview", "Screening call"], color: "#7AA8EA" },
  { key: "panels", label: "Panel rounds", stages: ["Shortlist", "Leadership interview", "Subject assessment", "Demo lesson", "Written assessment"], color: "#639B7C" },
  { key: "closing", label: "Closing", stages: ["Final review", "HR discussion", "Offer"], color: "#F7CF61" },
  { key: "joined", label: "Joined", stages: ["Joined"], color: "#1D1D1F" },
];
const ARCHIVE = ["Talent pool", "Not now"];
function RolesBoard({ d }) {
  const [campus, setCampus] = useState(""); const [showClosed, setShowClosed] = useState(false); const [open, setOpen] = useState(null);
  const roles = (d.roles || []).filter((r) => (!campus || r.campus === campus) && (showClosed || r.status === "open"));
  const campuses = [...new Set((d.roles || []).map((r) => r.campus).filter(Boolean))].sort();
  const byCampus = {}; for (const r of roles) (byCampus[r.campus || "No campus"] ||= []).push(r);
  const count = (r, stages) => stages.reduce((a, k) => a + (r.stages[k] || 0), 0);
  const active = (r) => count(r, PHASES.flatMap((p) => p.stages));
  const maxActive = Math.max(1, ...roles.map(active));
  const busiest = (r) => { let best = null; for (const k of PHASES.flatMap((p) => p.stages)) if ((r.stages[k] || 0) > (best ? r.stages[best] : 0)) best = k; return best; };
  return <div className="card">
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
      <div><b style={{ fontSize: 16 }}>Applications by role</b><div className="muted" style={{ fontSize: 13 }}>One bar per role. Tap a row for the stage-by-stage numbers, or the role name to open its pipeline.</div></div>
      <div className="row">{campuses.length > 1 && <select value={campus} onChange={(e) => setCampus(e.target.value)} style={{ width: "auto" }}><option value="">All campuses</option>{campuses.map((c) => <option key={c}>{c}</option>)}</select>}<label style={{ fontSize: 13 }} className="muted"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> closed roles</label></div>
    </div>
    <div className="row" style={{ gap: 14, margin: "8px 0 4px", fontSize: 12 }}>{PHASES.map((p) => <span key={p.key} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: "inline-block" }} />{p.label}</span>)}</div>
    {Object.entries(byCampus).map(([c, rs]) => <div key={c} style={{ marginTop: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", padding: "0 2px 6px" }}><b style={{ fontSize: 13, color: "var(--mute)" }}>{c}</b><span className="muted" style={{ fontSize: 12 }}>{rs.length} role{rs.length > 1 ? "s" : ""} · {rs.reduce((a, r) => a + r.total, 0)} applications</span></div>
      {rs.map((r) => { const a = active(r); const b = busiest(r); const isOpen = open === r.id; return <div key={r.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 2px", opacity: r.status === "open" ? 1 : .55 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.2fr) minmax(200px, 2fr) auto", gap: 16, alignItems: "center", cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : r.id)}>
          <div style={{ minWidth: 0 }}>
            <Link to={`/pipeline?role=${r.id}`} onClick={(e) => e.stopPropagation()} style={{ color: "inherit", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>{r.title}</Link>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.openings} opening{r.openings > 1 ? "s" : ""}{r.stages["Joined"] ? `, ${r.stages["Joined"]} joined` : ""}{r.status !== "open" ? " · closed" : ""}{r.week ? <span style={{ color: "var(--green)" }}> · +{r.week} this week</span> : ""}</div>
          </div>
          <div>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "var(--soft)", width: `${Math.max(6, (a / maxActive) * 100)}%`, minWidth: a ? 24 : 0, transition: "width .3s" }} title={PHASES.map((p) => `${p.label}: ${count(r, p.stages)}`).join(" · ")}>
              {PHASES.map((p) => { const n = count(r, p.stages); return n ? <div key={p.key} style={{ flex: n, background: p.color }} /> : null; })}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{a === 0 ? (r.total ? "Nobody active; see archive" : "No applications yet") : <><b style={{ color: "var(--ink)" }}>{a} active</b>{b ? `, most at ${b}` : ""}</>}</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 110 }}>
            {r.waiting ? <div style={{ color: "#B0463C", fontWeight: 600, fontSize: 13 }}>{r.waiting} waiting 3+ days</div> : <div className="muted" style={{ fontSize: 13 }}>Nothing stuck</div>}
            <div className="muted" style={{ fontSize: 12 }}>{r.total} total{count(r, ARCHIVE) ? ` · ${count(r, ARCHIVE)} archived` : ""}</div>
          </div>
        </div>
        {isOpen && <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {PHASES.map((p) => <div key={p.key} style={{ background: "var(--soft)", borderRadius: 10, padding: "8px 10px", borderLeft: `3px solid ${p.color}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{p.label} <span className="muted" style={{ fontWeight: 400 }}>{count(r, p.stages)}</span></div>
            {p.stages.map((k) => <div key={k} className="row" style={{ justifyContent: "space-between", fontSize: 12, color: r.stages[k] ? "var(--ink)" : "var(--mute)", opacity: r.stages[k] ? 1 : .6 }}><span>{k}</span><span>{r.stages[k] || 0}</span></div>)}
          </div>)}
          <div style={{ background: "var(--soft)", borderRadius: 10, padding: "8px 10px", borderLeft: "3px solid var(--line)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Archive <span className="muted" style={{ fontWeight: 400 }}>{count(r, ARCHIVE)}</span></div>
            {ARCHIVE.map((k) => <div key={k} className="row" style={{ justifyContent: "space-between", fontSize: 12, opacity: r.stages[k] ? 1 : .6 }}><span>{k}</span><span>{r.stages[k] || 0}</span></div>)}
          </div>
        </div>}
      </div>; })}
    </div>)}
    {roles.length === 0 && <div className="muted" style={{ padding: 10 }}>No open roles{campus ? ` at ${campus}` : ""}. Approve a requisition or create a role.</div>}
    {d.unassigned > 0 && <div className="muted" style={{ fontSize: 12, padding: "10px 2px 0", borderTop: "1px solid var(--line)", marginTop: 10 }}>{d.unassigned} general application{d.unassigned > 1 ? "s" : ""} in the <Link to="/pool">talent pool</Link> with no role.</div>}
  </div>;
}
