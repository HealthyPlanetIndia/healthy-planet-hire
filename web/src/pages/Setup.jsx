import React, { useEffect, useState } from "react";
import { api, me } from "../api.js";
import { Field, PhoneInput } from "../components/ui.jsx";
import { useToast } from "../components/Shell.jsx";

// Setup wizard: shows what's connected, tests each piece live, registers the WhatsApp webhook.
export default function Setup() {
  const say = useToast(); const [d, setD] = useState(null); const [to, setTo] = useState(""); const [email, setEmail] = useState(me()?.email || ""); const [out, setOut] = useState({}); const [meta, setMeta] = useState({ app_id: "", app_secret: "", waba_id: "" }); const [busy, setBusy] = useState("");
  const load = () => api("/setup").then(setD).catch((e) => say(e.message));
  useEffect(() => { load(); }, []);
  const test = async (what, target) => { setBusy(what); const r = await api(`/setup/test/${what}`, { method: "POST", body: { to: target } }).catch((e) => ({ ok: false, message: e.message })); setOut((o) => ({ ...o, [what]: r })); setBusy(""); };
  if (!d) return <div className="muted">Loading...</div>;
  const required = d.items.filter((i) => !i.optional), done = required.filter((i) => i.ok).length;
  const here = window.location.origin, configured = (d.apply_url || "").replace(/\/apply$/, "");
  const mismatch = configured && here !== configured;
  const Result = ({ k }) => out[k] ? <div style={{ fontSize: 13, color: out[k].ok ? "var(--green)" : "#B0463C", marginTop: 6 }}>{out[k].ok ? "✓ " : "✗ "}{out[k].message}</div> : null;
  return <div className="grid" style={{ maxWidth: 820 }}>
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 16 }}>Setup</b><span className="muted">{done} of {required.length} required steps done</span></div>
      {mismatch && <div style={{ background: "#FBE5E2", borderRadius: 8, padding: "8px 10px", fontSize: 13, margin: "8px 0" }}><b>Your links are being built with the wrong address.</b> You are using the app at <code>{here}</code>, but PUBLIC_URL is set to <code>{configured}</code>, so interview and booking links sent to candidates use that older address. Fix: Render → your service → Environment → PUBLIC_URL → <code>{here}</code> → Save, wait a minute, then Re-check here.</div>}
      <div style={{ height: 8, background: "var(--soft)", borderRadius: 4, margin: "8px 0 12px" }}><div style={{ width: `${(done / required.length) * 100}%`, height: 8, background: "var(--green)", borderRadius: 4 }} /></div>
      {d.items.map((i) => <div key={i.key} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
        <span style={{ width: 20, color: i.ok ? "var(--green)" : i.optional ? "var(--mute)" : "var(--coral)", fontWeight: 700 }}>{i.ok ? "✓" : i.optional ? "○" : "!"}</span>
        <span style={{ flex: 1 }}><b>{i.label}</b>{i.optional && <span className="muted"> · optional</span>}{i.detail && <span className="muted"> · {i.detail}</span>}{!i.ok && <div className="muted">{i.fix}</div>}</span>
      </div>)}
      <button className="small" style={{ marginTop: 8 }} onClick={load}>Re-check</button>
    </div>

    <div className="card">
      <b>Test each connection</b>
      <div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>Type your own number and email, then press each button. Green means it works.</div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Your WhatsApp / mobile number"><PhoneInput value={to} onChange={setTo} /></Field>
        <Field label="Your email"><input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      </div>
      <div className="row">
        <button disabled={!!busy} onClick={() => test("ai")}>{busy === "ai" ? "Testing..." : "Test AI"}</button>
        <button disabled={!!busy || !to} onClick={() => test("whatsapp", to)}>{busy === "whatsapp" ? "Sending..." : "Send test WhatsApp"}</button>
        <button disabled={!!busy || !email} onClick={() => test("email", email)}>{busy === "email" ? "Sending..." : "Send test email"}</button>
        <button disabled={!!busy || !to} onClick={() => test("sms", to)}>{busy === "sms" ? "Sending..." : "Send test SMS"}</button>
        <button disabled={!!busy} onClick={() => test("transcribe")}>{busy === "transcribe" ? "Testing..." : "Test transcription"}</button>
        <button disabled={!!busy} onClick={() => test("voice")}>{busy === "voice" ? "Testing..." : "Test voice"}</button>
      </div>
      {["ai", "whatsapp", "email", "sms", "transcribe", "voice"].map((k) => <Result key={k} k={k} />)}
    </div>

    <div className="card">
      <b>WhatsApp webhook (so candidate replies reach the app)</b>
      <div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>Either do this here in one click, or copy the two values into Meta's dashboard by hand (WhatsApp → Configuration → Webhook).</div>
      <div style={{ fontSize: 13, background: "var(--soft)", borderRadius: 8, padding: 10, marginBottom: 10 }}><div><b>Callback URL:</b> <code>{d.webhook_url}</code></div><div><b>Verify token:</b> <code>{d.verify_token}</code></div></div>
      <button className="small" disabled={!!busy} onClick={() => test("webhook")}>{busy === "webhook" ? "Checking..." : "Check my server answers Meta"}</button><Result k="webhook" />
      <div style={{ marginTop: 14, fontWeight: 500, fontSize: 14 }}>One-click registration</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>From your Meta app: <b>App settings → Basic</b> gives the App ID and App Secret (press Show). <b>WhatsApp → API Setup</b> shows the WhatsApp Business Account ID. Nothing you type here is stored.</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 10px" }}>
        <Field label="App ID"><input value={meta.app_id} onChange={(e) => setMeta({ ...meta, app_id: e.target.value })} /></Field>
        <Field label="App Secret"><input type="password" value={meta.app_secret} onChange={(e) => setMeta({ ...meta, app_secret: e.target.value })} /></Field>
        <Field label="WhatsApp Business Account ID"><input value={meta.waba_id} onChange={(e) => setMeta({ ...meta, waba_id: e.target.value })} /></Field>
      </div>
      <button className="primary" disabled={!!busy || !meta.app_id || !meta.app_secret} onClick={async () => { setBusy("reg"); const r = await api("/setup/whatsapp/register", { method: "POST", body: meta }).catch((e) => ({ ok: false, message: e.message })); setOut((o) => ({ ...o, reg: r })); setBusy(""); setMeta({ ...meta, app_secret: "" }); }}>{busy === "reg" ? "Registering..." : "Register webhook with Meta"}</button>
      <Result k="reg" />
    </div>

    <div className="card" style={{ fontSize: 13 }}>
      <b>Links to hand out</b>
      <div style={{ marginTop: 6 }}>Careers page for the website: <code>{d.apply_url}</code></div>
      <div>Job feed for Indeed / Google: <code>{d.jobs_feed}</code></div>
      <div className="muted" style={{ marginTop: 8 }}>Video answers are stored on this server's disk (encrypted). Each 15-minute interview is roughly 40 to 60 MB; a 5 GB disk holds about 100 interviews at any one time, and recordings are deleted after 90 days. Increase the disk in Render if you interview more than that in three months.</div>
    </div>
  </div>;
}
