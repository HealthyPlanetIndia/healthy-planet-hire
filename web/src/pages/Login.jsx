import React, { useState } from "react";
import { api } from "../api.js";
import { Field } from "../components/ui.jsx";

export default function Login() {
  const [f, setF] = useState({ email: "", password: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e) { e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api("/auth/login", { method: "POST", body: f }); localStorage.setItem("hph_token", r.token); localStorage.setItem("hph_user", JSON.stringify(r.user)); location.href = "/"; } catch (e) { setErr(e.message); } setBusy(false); }
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={go} className="card" style={{ width: "min(380px, 100%)", padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}><span style={{ display: "inline-grid", width: 52, height: 52, borderRadius: 14, background: "var(--green)", color: "#fff", placeItems: "center", fontFamily: "var(--font-brand)", fontWeight: 700, fontSize: 18 }}>HP</span><div style={{ fontFamily: "var(--font-brand)", fontWeight: 700, fontSize: 20, marginTop: 12, letterSpacing: "-0.01em" }}>Healthy Planet Recruitment</div><div className="muted" style={{ fontSize: 13 }}>Sign in to continue</div></div>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoFocus /></Field>
        <Field label="Password"><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {err && <div style={{ color: "#B0463C", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="primary" disabled={busy} style={{ width: "100%" }}>{busy ? "Signing in..." : "Sign in"}</button>
        <button type="button" className="link" style={{ marginTop: 10, fontSize: 13 }} onClick={async () => { if (!f.email) return setErr("Type your email first"); await api("/auth/forgot", { method: "POST", body: { email: f.email }, }).catch(() => {}); setErr("If that email has an account, a reset link is on its way."); }}>Forgot password?</button>
      </form>
    </div>
  );
}
