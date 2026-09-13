import React, { useEffect, useState } from "react";
import { api, daysSince } from "../api.js";
import { Score } from "../components/ui.jsx";
import CandidatePanel from "../components/CandidatePanel.jsx";
import { useToast } from "../components/Shell.jsx";

export default function Pool() {
  const say = useToast(); const [q, setQ] = useState(""); const [list, setList] = useState([]); const [roles, setRoles] = useState([]); const [openId, setOpenId] = useState(null);
  const load = () => api(`/candidates?stage=${encodeURIComponent("Talent pool")}&q=${encodeURIComponent(q)}`).then(setList);
  useEffect(() => { api("/roles").then(setRoles); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);
  async function reactivate(c, role_id) { await api(`/candidates/${c.id}`, { method: "PUT", body: { role_id, stage: "Applied", screening: null } }); say(`${c.name} is back in the pipeline`); load(); }
  return (
    <div className="grid">
      <input placeholder="Search by name, skill or previous role, e.g. Montessori, Hindi, IB" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div className="card muted">The talent pool is empty. Move promising candidates you cannot hire right now into "Talent pool" and they stay searchable here.</div>}
      {list.map((c) => <div key={c.id} className="card row">
        <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 500 }}>{c.name} {c.screening && <Score v={c.screening.overall} />}</div><div className="muted" style={{ fontSize: 12 }}>Applied for {c.role_title} · pooled {daysSince(c.stage_at)} days ago</div></div>
        <select style={{ width: "auto" }} defaultValue="" onChange={(e) => e.target.value && reactivate(c, e.target.value)}><option value="">Reactivate for...</option>{roles.filter((r) => r.status === "open").map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
        <button className="small" onClick={() => setOpenId(c.id)}>Open</button>
      </div>)}
      {openId && <CandidatePanel id={openId} roles={roles} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
