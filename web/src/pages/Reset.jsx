import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
export default function Reset() {
  const { token } = useParams(); const [pw, setPw] = useState(""); const [msg, setMsg] = useState("");
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}><div className="card" style={{ width: "min(380px,100%)" }}>
    <b>Set a new password</b>
    <input type="password" placeholder="At least 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} style={{ margin: "10px 0" }} />
    <button className="primary" disabled={pw.length < 8} style={{ width: "100%" }} onClick={async () => { try { const r = await api("/auth/reset", { method: "POST", body: { token, password: pw } }); setMsg(r.ok ? "Done. You can sign in now." : "This link has expired. Request a new one from the sign-in page."); } catch (e) { setMsg(e.message); } }}>Save password</button>
    {msg && <p style={{ fontSize: 13 }}>{msg} {msg.startsWith("Done") && <a href="/login">Sign in</a>}</p>}
  </div></div>;
}
