import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fmtDT } from "../api.js";

export default function Book() {
  const { token } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => api(`/public/book/${token}`, { auth: false }).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [token]);
  if (err) return <Wrap><div className="card">{err}</div></Wrap>;
  if (!d) return <Wrap><span className="muted">Loading...</span></Wrap>;
  const byDay = {}; for (const s of d.open) { const k = new Date(s.starts_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }); (byDay[k] ||= []).push(s); }
  return <Wrap>
    <div className="card">
      <div className="muted" style={{ fontSize: 12 }}>Healthy Planet School</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Hello {d.candidate}</div>
      <div className="muted" style={{ marginBottom: 12 }}>Pick a time for your {d.open[0]?.stage?.toLowerCase() || "interview"} for {d.role}.</div>
      {d.booked && <div style={{ background: "#E6F1EA", borderRadius: 10, padding: 12, marginBottom: 12 }}><b>You're booked:</b> {fmtDT(d.booked.starts_at)}<br /><span className="muted" style={{ fontSize: 13 }}>{d.booked.location}. Bring your original certificates. Choose another time below if you need to change it.</span></div>}
      {Object.keys(byDay).length === 0 && !d.booked && <div className="muted">No open times right now. The school will send new ones shortly.</div>}
      {Object.entries(byDay).map(([day, slots]) => <div key={day} style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 500, marginBottom: 6 }}>{day}</div>
        <div className="row">{slots.map((s) => <button key={s.id} disabled={busy} onClick={async () => { setBusy(true); try { await api(`/public/book/${token}`, { method: "POST", body: { slot_id: s.id }, auth: false }); await load(); } catch (e) { setErr(""); alert(e.message); load(); } setBusy(false); }}>{new Date(s.starts_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</button>)}</div>
      </div>)}
    </div>
  </Wrap>;
}
const Wrap = ({ children }) => <div style={{ minHeight: "100vh", padding: 16, maxWidth: 520, margin: "0 auto" }}>{children}</div>;
