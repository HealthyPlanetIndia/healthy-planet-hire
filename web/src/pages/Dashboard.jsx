import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, isAdmin } from "../api.js";

export default function Dashboard() {
  const [d, setD] = useState(null); const [s, setS] = useState(null); const [setupState, setSetup] = useState(null);
  useEffect(() => { api("/dashboard").then(setD).catch(() => setD({ byStage: [], newThisWeek: 0, avgDaysToOffer: null, interviews: [] })); api("/status").then(setS).catch(() => {}); if (isAdmin()) api("/setup").then(setSetup).catch(() => {}); }, []);
  if (!d) return <div className="muted">Loading...</div>;
  const n = (st) => d.byStage.find((x) => x.stage === st)?.n || 0;
  const active = ["Applied", "Screened", "AI interview", "Screening call", "Shortlist", "Leadership interview", "Subject assessment", "Demo lesson", "Written assessment", "Final review", "HR discussion", "Offer"].reduce((a, st) => a + n(st), 0);
  const done = d.interviews.find((x) => x.status === "completed")?.n || 0;
  const todo = setupState?.items.filter((i) => !i.optional && !i.ok) || [];
  const [reqs, setReqs] = useState([]); useEffect(() => { if (isAdmin()) api("/requisitions").then(setReqs).catch(() => {}); }, []);
  return (
    <div className="grid">
      {(reqs.length > 0 || n("Final review") > 0) && <div className="card" style={{ borderColor: "var(--blue)" }}><b>Waiting for the Director</b><div className="muted" style={{ fontSize: 13 }}>{reqs.length > 0 && <div><Link to="/roles">{reqs.length} manpower requisition{reqs.length > 1 ? "s" : ""}</Link> to approve or reject.</div>}{n("Final review") > 0 && <div><Link to="/pipeline">{n("Final review")} candidate{n("Final review") > 1 ? "s" : ""}</Link> at Final review awaiting your decision.</div>}</div></div>}
      {todo.length > 0 && <Link to="/setup" className="card" style={{ textDecoration: "none", color: "inherit", borderColor: "var(--yellow)", background: "#FFFBEF" }}><b>Finish setting up</b><div className="muted" style={{ fontSize: 13 }}>{todo.length} required step{todo.length > 1 ? "s" : ""} left: {todo.map((i) => i.label).join(", ")}. Open Setup to test connections and fix them.</div></Link>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {[["Active candidates", active], ["New this week", d.newThisWeek], ["Awaiting screening", n("Applied")], ["AI interviews completed", done], ["Avg days to offer", d.avgDaysToOffer ?? "–"], ["In talent pool", n("Talent pool")]].map(([l, v]) => <div key={l} className="card"><div className="stat">{v}</div><div className="muted" style={{ fontSize: 12 }}>{l}</div></div>)}
      </div>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Pipeline</div>
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
