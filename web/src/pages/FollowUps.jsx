import React, { useEffect, useState } from "react";
import { api, daysSince } from "../api.js";
import CandidatePanel from "../components/CandidatePanel.jsx";
import { useToast } from "../components/Shell.jsx";

export default function FollowUps() {
  const say = useToast(); const [list, setList] = useState([]); const [roles, setRoles] = useState([]); const [openId, setOpenId] = useState(null); const [status, setStatus] = useState(null);
  const load = () => api("/followups").then(setList);
  useEffect(() => { load(); api("/roles").then(setRoles); api("/status").then(setStatus); }, []);
  async function nudge(c) { try { const d = await api(`/candidates/${c.id}/message-draft?key=followup`); const r = await api(`/candidates/${c.id}/messages`, { method: "POST", body: { channel: "whatsapp", body: d.body } }); if (r.link) window.open(r.link, "_blank"); say("Nudge logged"); load(); } catch (e) { say(e.message); } }
  return (
    <div className="grid">
      <div className="muted">Candidates with no movement and no reply for {status?.followup_days ?? 3}+ days. {status?.whatsapp ? "Automatic nudges go out daily at 10:00; anyone still here needs a personal touch." : "Connect the WhatsApp API in Settings and these nudges go out automatically each morning."}</div>
      {status?.whatsapp && <button style={{ width: "fit-content" }} onClick={() => api("/followups/run", { method: "POST" }).then((r) => { say(`Sent ${r.sent} nudges`); load(); })}>Run nudges now</button>}
      {list.length === 0 && <div className="card muted">Nobody is waiting. The pipeline is moving.</div>}
      {list.map((c) => <div key={c.id} className="card row">
        <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 500 }}>{c.name}</div><div className="muted" style={{ fontSize: 12 }}>{c.role_title} · {c.stage} for {daysSince(c.stage_at)} days{c.last_contact_at && ` · last contacted ${daysSince(c.last_contact_at)}d ago`}</div></div>
        <button className="small primary" disabled={!c.phone} onClick={() => nudge(c)}>WhatsApp nudge</button>
        <button className="small" onClick={() => setOpenId(c.id)}>Open</button>
      </div>)}
      {openId && <CandidatePanel id={openId} roles={roles} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
