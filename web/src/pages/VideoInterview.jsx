import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

// Video room (Daily.co). The recording and transcript come back to the server by webhook.
export default function VideoInterview() {
  const { token } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState(""); const [joined, setJoined] = useState(false);
  useEffect(() => { api(`/public/video/${token}`, { auth: false }).then(setD).catch((e) => setErr(e.message)); }, [token]);
  if (err) return <Center>{err}</Center>;
  if (!d) return <Center>Loading...</Center>;
  if (d.status === "expired" || !d.room_url) return <Center>This interview link has expired. Please reply to the school's message for a new one.</Center>;
  return <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <div style={{ background: "var(--black)", color: "#fff", padding: "12px 16px" }}><b>Healthy Planet School · Video interview</b><div style={{ fontSize: 12, opacity: .8 }}>{d.candidate} · {d.role}</div></div>
    {!joined ? <div className="card" style={{ margin: 16, maxWidth: 560 }}>
      <p>Hello {d.candidate}. This is a recorded video interview of about 15 minutes. You will be asked {d.questions.length} questions; the text of each appears on screen so you can take a moment before answering. Please complete it alone in a quiet place. By joining you consent to the interview being recorded and assessed for this recruitment. Healthy Planet School restricts access to authorised recruiting staff, stores the recording encrypted, deletes it after 90 days and takes reasonable measures to protect it, though no online system can be guaranteed against every risk. Write to hr@healthyplanetschool.com to have it deleted sooner.</p>
      <details style={{ fontSize: 13, marginBottom: 12 }}><summary>See the questions</summary><ol>{d.questions.map((q, i) => <li key={i}>{q}</li>)}</ol></details>
      <button className="warm" style={{ width: "100%" }} onClick={() => setJoined(true)}>I'm ready, start</button>
    </div> : <>
      <iframe title="Interview" src={`${d.room_url}?t=&showLeaveButton=true`} allow="camera; microphone; fullscreen; display-capture" style={{ flex: 1, border: 0, minHeight: 420 }} />
      <div style={{ padding: 12, background: "#fff", borderTop: "1px solid var(--line)" }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Questions: {d.questions.map((q, i) => <span key={i}> {i + 1}. {q}</span>)}</div>
        <button className="primary" onClick={async () => { await api(`/public/video/${token}/done`, { method: "POST", auth: false }).catch(() => {}); setD({ ...d, room_url: null, status: "completed" }); }}>I have finished</button>
      </div>
    </>}
    {d.status === "completed" && <Center>Thank you. Your interview is complete and the school team will be in touch.</Center>}
  </div>;
}
const Center = ({ children }) => <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 16 }}><div className="card" style={{ maxWidth: 420 }}>{children}</div></div>;
