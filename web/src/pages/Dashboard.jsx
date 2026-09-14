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
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {[["Active candidates", active], ["New this week", d.newThisWeek], ["Awaiting screening", n("Applied")], ["AI interviews completed", done], ["Avg days to offer", d.avgDaysToOffer ?? "none yet"], ["In talent pool", n("Talent pool")]].map(([l, v]) => <div key={l} className="card"><div className="stat">{v}</div><div className="muted" style={{ fontSize: 12 }}>{l}</div></div>)}
      </div>
      <RolesBoard d={d} />
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Pipeline, all roles</div>
        <div className="row" style={{ gap: 4, alignItems: "stretch" }}>
          {["Applied", "Screened", "AI interview", "Screening call", "Shortlist", "Leadership interview", "Subject assessment", "Demo lesson", "Written assessment", "Final review", "HR discussion", "Offer", "Joined"].map((st) => <Link key={st} to={`/pipeline`} style={{ flex: 1, minWidth: 90, textDecoration: "none", color: "inherit", background: "var(--soft)", borderRadius: 8, padding: 10, textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 20 }}>{n(st)}</div><div className="muted" style={{ fontSize: 11 }}>{st}</div></Link>)}
        </div>
      </div>
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

// Applications by role and campus, with where each role's candidates stand
const COLS = [["Applied", "Applied"], ["Screened", "Screened"], ["AI interview", "AI int."], ["Screening call", "Call"], ["Shortlist", "Shortlist"], ["Leadership interview", "R1"], ["Subject assessment", "R2"], ["Demo lesson", "Demo"], ["Written assessment", "Written"], ["Final review", "Final"], ["HR discussion", "HR"], ["Offer", "Offer"], ["Joined", "Joined"], ["Talent pool", "Pool"], ["Not now", "No"]];
function RolesBoard({ d }) {
  const [campus, setCampus] = useState(""); const [showClosed, setShowClosed] = useState(false);
  const roles = (d.roles || []).filter((r) => (!campus || r.campus === campus) && (showClosed || r.status === "open"));
  const campuses = [...new Set((d.roles || []).map((r) => r.campus).filter(Boolean))];
  const byCampus = {}; for (const r of roles) (byCampus[r.campus || "No campus"] ||= []).push(r);
  const active = (r) => COLS.slice(0, 12).reduce((a, [k]) => a + (r.stages[k] || 0), 0);
  const cell = (n, hot) => <td style={{ textAlign: "center", padding: "6px 4px", color: n ? "var(--ink)" : "var(--line)", fontWeight: n && hot ? 700 : 400, background: n && hot ? "#EAF1FB" : "transparent" }}>{n || "·"}</td>;
  return <div className="card" style={{ overflowX: "auto" }}>
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
      <div><b>Applications by role</b><div className="muted" style={{ fontSize: 12 }}>Tap a role to open its pipeline. Highlighted cells are where a role's candidates are right now.</div></div>
      <div className="row">{campuses.length > 1 && <select value={campus} onChange={(e) => setCampus(e.target.value)} style={{ width: "auto" }}><option value="">All campuses</option>{campuses.map((c) => <option key={c}>{c}</option>)}</select>}<label style={{ fontSize: 12 }}><input type="checkbox" style={{ width: "auto" }} checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> closed roles</label></div>
    </div>
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, minWidth: 900 }}>
      <thead><tr style={{ color: "var(--mute)" }}><th style={{ textAlign: "left", padding: "6px 4px" }}>Role</th><th style={{ textAlign: "center" }}>Total</th><th style={{ textAlign: "center" }}>This week</th><th style={{ textAlign: "center" }}>Active</th>{COLS.map(([k, l]) => <th key={k} style={{ textAlign: "center", padding: "6px 2px", fontWeight: 500 }} title={k}>{l}</th>)}<th style={{ textAlign: "center" }}>Waiting</th></tr></thead>
      <tbody>
        {Object.entries(byCampus).map(([c, rs]) => <React.Fragment key={c}>
          <tr><td colSpan={COLS.length + 5} style={{ padding: "10px 4px 4px", fontWeight: 700, color: "var(--green)", borderTop: "1px solid var(--line)" }}>{c} campus <span className="muted" style={{ fontWeight: 400 }}>· {rs.length} role{rs.length > 1 ? "s" : ""} · {rs.reduce((a, r) => a + r.total, 0)} applications</span></td></tr>
          {rs.map((r) => { const a = active(r); const most = COLS.slice(0, 12).reduce((m, [k]) => ((r.stages[k] || 0) > (r.stages[m] || 0) ? k : m), "Applied"); return <tr key={r.id} style={{ borderTop: "1px solid var(--line)", opacity: r.status === "open" ? 1 : .55 }}>
            <td style={{ padding: "6px 4px" }}><Link to={`/pipeline?role=${r.id}`} style={{ color: "inherit", fontWeight: 500 }}>{r.title}</Link><div className="muted" style={{ fontSize: 11 }}>{[r.department, r.grade, r.subject].filter(Boolean).join(" · ")} · {r.openings} opening{r.openings > 1 ? "s" : ""}{r.stages["Joined"] ? ` · ${r.stages["Joined"]} joined` : ""}{r.status !== "open" ? " · closed" : ""}</div></td>
            <td style={{ textAlign: "center", fontWeight: 700 }}>{r.total}</td>
            <td style={{ textAlign: "center", color: r.week ? "var(--green)" : "var(--line)" }}>{r.week ? `+${r.week}` : "·"}</td>
            <td style={{ textAlign: "center" }}>{a}</td>
            {COLS.map(([k]) => <React.Fragment key={k}>{cell(r.stages[k] || 0, k === most)}</React.Fragment>)}
            <td style={{ textAlign: "center", color: r.waiting ? "var(--coral)" : "var(--line)", fontWeight: r.waiting ? 700 : 400 }}>{r.waiting || "·"}</td>
          </tr>; })}
        </React.Fragment>)}
        {roles.length === 0 && <tr><td colSpan={COLS.length + 5} className="muted" style={{ padding: 10 }}>No open roles{campus ? ` at ${campus}` : ""}. Approve a requisition or create a role.</td></tr>}
        {d.unassigned > 0 && <tr><td colSpan={COLS.length + 5} className="muted" style={{ padding: "8px 4px", borderTop: "1px solid var(--line)" }}>{d.unassigned} candidate{d.unassigned > 1 ? "s" : ""} with no role assigned. <Link to="/pipeline">Open the pipeline</Link> and assign them.</td></tr>}
      </tbody>
    </table>
    <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>R1 Leadership interview · R2 Subject assessment · Demo lesson · Written assessment · Final review · HR discussion. "Waiting" counts candidates with no movement or reply for {3}+ days.</div>
  </div>;
}
