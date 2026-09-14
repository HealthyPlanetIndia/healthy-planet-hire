import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

// Round 4: written English assessment. 30-minute timer, pasting is noted, auto-submits when time runs out.
export default function WrittenAssessment() {
  const { token } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState(""); const [text, setText] = useState(""); const [left, setLeft] = useState(null); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const signal = (type, detail = "") => api(`/public/interview/${token}/signal`, { method: "POST", body: { type, detail } }).catch(() => {});
  useEffect(() => { api(`/public/written/${token}`, { auth: false }).then((x) => { setD(x); setText(x.text || ""); if (x.status === "completed") setDone(true); }).catch((e) => setErr(e.message)); }, [token]);
  useEffect(() => {
    if (!d?.started_at || done) return;
    const end = new Date(d.started_at + (d.started_at.endsWith("Z") ? "" : "Z")).getTime() + d.minutes * 60000;
    const iv = setInterval(() => { const s = Math.max(0, Math.round((end - Date.now()) / 1000)); setLeft(s); if (s === 0) { clearInterval(iv); submit(true); } }, 1000);
    return () => clearInterval(iv);
  }, [d?.started_at, done]);
  useEffect(() => { if (!d?.started_at || done) return; const p = (e) => signal("paste", (e.clipboardData?.getData("text") || "").slice(0, 400)); const v = () => document.hidden && signal("hidden"); document.addEventListener("paste", p); document.addEventListener("visibilitychange", v); return () => { document.removeEventListener("paste", p); document.removeEventListener("visibilitychange", v); }; }, [d?.started_at, done]);
  const textRef = useRef(""); useEffect(() => { textRef.current = text; }, [text]);
  async function start() { setBusy(true); try { const r = await api(`/public/written/${token}/start`, { method: "POST", body: {}, auth: false }); setD({ ...d, status: "in_progress", started_at: r.started_at }); } catch (e) { setErr(e.message); } setBusy(false); }
  async function submit(auto = false) { if (done) return; setBusy(true); try { await api(`/public/written/${token}/submit`, { method: "POST", body: { text: textRef.current || text }, auth: false }); setDone(true); } catch (e) { if (!auto) setErr(e.message); } setBusy(false); }
  if (err && !d) return <Wrap><div className="card">{err}</div></Wrap>;
  if (!d) return <Wrap><span className="muted">Loading...</span></Wrap>;
  if (d.status === "expired") return <Wrap><div className="card">This link has expired. Please reply to the school's message for a new one.</div></Wrap>;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return <Wrap>
    <div className="card">
      <div className="muted" style={{ fontSize: 12 }}>Healthy Planet School · Written assessment</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Hello {d.candidate}</div>
      {!d.started_at && !done && <>
        <p className="muted" style={{ lineHeight: 1.5 }}>This is a short written task for the {d.role} role. You will have {d.minutes} minutes from the moment you press Start. Please write in your own words, without help from anyone or from AI tools; pasting text is noted. Your writing is assessed for this recruitment by the school's authorised staff and an assessment assistant, and kept under the same safeguards as the rest of your application.</p>
        <button className="warm" style={{ width: "100%" }} disabled={busy} onClick={start}>Start ({d.minutes} minutes)</button>
      </>}
      {d.started_at && !done && <>
        <div className="row" style={{ justifyContent: "space-between", margin: "8px 0" }}><b>Time left: {left == null ? "..." : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</b><span className="muted">{words} words</span></div>
        <div style={{ background: "var(--soft)", borderRadius: 10, padding: 12, lineHeight: 1.5, marginBottom: 10 }}>{d.prompt}</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 280, fontSize: 15, lineHeight: 1.5 }} autoFocus />
        {err && <div style={{ color: "#B0463C", fontSize: 13, marginTop: 6 }}>{err}</div>}
        <button className="primary" style={{ width: "100%", marginTop: 10 }} disabled={busy || words < 20} onClick={() => submit(false)}>Submit</button>
      </>}
      {done && <div style={{ color: "var(--green)", fontWeight: 500, marginTop: 8 }}>Thank you. Your writing has been submitted. The school team will be in touch.</div>}
    </div>
  </Wrap>;
}
const Wrap = ({ children }) => <div style={{ minHeight: "100vh", padding: 16, maxWidth: 720, margin: "0 auto" }}>{children}</div>;
