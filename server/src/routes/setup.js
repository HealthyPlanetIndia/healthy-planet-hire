// Setup wizard: live connection tests and one-click WhatsApp webhook registration. Admins only.
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, audit } from "../db.js";
import { requireAdmin } from "../auth.js";
import { aiEnabled } from "../ai.js";
import { waEnabled, sendWhatsApp } from "../services/whatsapp.js";
import { mailEnabled, sendEmail } from "../services/email.js";
import { smsEnabled, sendSms } from "../services/sms.js";
import { videoEnabled } from "../services/video.js";
import { transcribeEnabled, transcribeBuffer } from "../services/transcribe.js";
import { ttsEnabled, speak } from "../services/tts.js";

export const setup = Router();
setup.use(requireAdmin);

const publicUrl = () => (process.env.PUBLIC_URL || "").replace(/\/$/, "");

setup.get("/", async (req, res) => {
  const counts = { roles: db.prepare("SELECT COUNT(*) n FROM roles").get().n, users: db.prepare("SELECT COUNT(*) n FROM users").get().n, faqs: db.prepare("SELECT COUNT(*) n FROM faqs").get().n, templates: db.prepare("SELECT COUNT(*) n FROM templates").get().n, slots: db.prepare("SELECT COUNT(*) n FROM slots WHERE starts_at > datetime('now')").get().n };
  const items = [
    { key: "url", label: "Web address (PUBLIC_URL)", ok: /^https:\/\//.test(publicUrl()) && !publicUrl().includes("TEMP") && !publicUrl().includes("localhost"), detail: publicUrl() || "not set", fix: "In Railway → Variables set PUBLIC_URL to your https address. Interview and booking links use it." },
    { key: "admin", label: "Admin password changed from the default", ok: !(await defaultPassword()), fix: "Settings → Your password." },
    { key: "ai", label: "AI screening and interviews", ok: aiEnabled(), fix: "Add ANTHROPIC_API_KEY in Railway → Variables." },
    { key: "whatsapp", label: "WhatsApp Business API", ok: waEnabled(), fix: "Add WA_TOKEN and WA_PHONE_NUMBER_ID, then register the webhook below.", optional: true },
    { key: "email", label: "Email sending", ok: mailEnabled(), fix: "Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.", optional: true },
    { key: "sms", label: "SMS", ok: smsEnabled(), fix: "Add MSG91_AUTHKEY and MSG91_SENDER, or Twilio keys.", optional: true },
    { key: "transcribe", label: "Accurate transcription of spoken answers (Deepgram)", ok: transcribeEnabled(), fix: "Add DEEPGRAM_API_KEY. Without it, the candidate's phone does the transcription, which struggles with Hindi-English mixing.", optional: true },
    { key: "tts", label: "Natural voice for Maya (ElevenLabs)", ok: ttsEnabled(), fix: "Add ELEVENLABS_API_KEY. Without it, candidates hear their device's built-in voice, which sounds mechanical and varies by phone.", optional: true },
    { key: "video", label: "Live video rooms (Daily.co)", ok: videoEnabled(), fix: "Add DAILY_API_KEY and point Daily's webhook at " + publicUrl() + "/api/public/webhooks/daily.", optional: true },
    { key: "templates", label: "Message templates rewritten in your words", ok: counts.templates > 0, fix: "Settings → Message templates. Edit at least one and save." },
    { key: "roles", label: "A real role created", ok: counts.roles > 0, fix: "Roles → New role." },
    { key: "faqs", label: "WhatsApp assistant has answers", ok: counts.faqs >= 5, detail: `${counts.faqs} answers`, fix: "Automation → add at least 5 questions candidates ask.", optional: true },
    { key: "slots", label: "Interview slots for candidates to book", ok: counts.slots > 0, detail: `${counts.slots} upcoming`, fix: "Roles → Slots.", optional: true },
    { key: "team", label: "Team members added", ok: counts.users > 1, detail: `${counts.users} user${counts.users > 1 ? "s" : ""}`, fix: "Settings → Team.", optional: true },
  ];
  res.json({ items, webhook_url: publicUrl() + "/api/webhooks/whatsapp", verify_token: process.env.WA_VERIFY_TOKEN || "healthyplanet-verify", apply_url: publicUrl() + "/apply", jobs_feed: publicUrl() + "/api/public/jobs.xml" });
});
async function defaultPassword() { try { const { login } = await import("../auth.js"); return !!(await login(process.env.ADMIN_EMAIL || "arunabh@healthyplanetschool.com", process.env.ADMIN_PASSWORD || "changeme")); } catch { return false; } }

// Live tests. Each returns { ok, message } and never throws.
setup.post("/test/:what", async (req, res) => {
  const w = req.params.what, to = req.body.to || ""; let out;
  try {
    if (w === "ai") { if (!aiEnabled()) throw new Error("ANTHROPIC_API_KEY not set"); const r = await new Anthropic().messages.create({ model: "claude-sonnet-4-6", max_tokens: 20, messages: [{ role: "user", content: "Reply with the single word: ready" }] }); out = { ok: true, message: `AI replied: ${r.content[0].text.trim()}` }; }
    else if (w === "whatsapp") { if (!waEnabled()) throw new Error("WA_TOKEN or WA_PHONE_NUMBER_ID not set"); const id = await sendWhatsApp(to, "Healthy Planet Recruitment is connected to WhatsApp. This is a test message."); out = { ok: true, message: `Sent to ${to} (id ${id}). Check your phone.` }; }
    else if (w === "email") { if (!mailEnabled()) throw new Error("SMTP not set"); await sendEmail(to, "Healthy Planet Recruitment test", "Email sending is connected."); out = { ok: true, message: `Sent to ${to}. Check the inbox (and spam).` }; }
    else if (w === "sms") { if (!smsEnabled()) throw new Error("SMS not set"); await sendSms(to, "Healthy Planet Recruitment: SMS is connected."); out = { ok: true, message: `Sent to ${to}.` }; }
    else if (w === "transcribe") { if (!transcribeEnabled()) throw new Error("DEEPGRAM_API_KEY not set"); const r = await fetch("https://api.deepgram.com/v1/projects", { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } }); if (!r.ok) throw new Error("Deepgram rejected the key"); out = { ok: true, message: "Deepgram key accepted. Spoken answers will be transcribed on the server with Hindi-English support." }; }
    else if (w === "voice") { if (!ttsEnabled()) throw new Error("ELEVENLABS_API_KEY not set; candidates hear their device's built-in voice"); const buf = await speak("Hello, I'm Maya. Thank you for joining today. When you're ready, I'll ask the first question."); out = { ok: true, message: `Natural voice working (${Math.round(buf.length / 1024)} KB sample generated). If candidates still hear a robotic voice, check the ElevenLabs usage page for quota.` }; }
    else if (w === "webhook") { const r = await fetch(`${publicUrl()}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(process.env.WA_VERIFY_TOKEN || "healthyplanet-verify")}&hub.challenge=hello`); out = { ok: (await r.text()) === "hello", message: r.ok ? "Your server answers Meta's verification correctly." : `Server returned ${r.status}. Is PUBLIC_URL right?` }; }
    else throw new Error("Unknown test");
  } catch (e) { out = { ok: false, message: e.message }; }
  audit(req, `setup test ${w}: ${out.ok ? "ok" : out.message}`); res.json(out);
});

// Registers the webhook with Meta so you don't have to click through their dashboard.
// Needs the Meta App ID and App Secret (Meta app → App settings → Basic) and the WhatsApp Business Account ID (WhatsApp → API Setup).
setup.post("/whatsapp/register", async (req, res) => {
  const { app_id, app_secret, waba_id } = req.body; const verify = process.env.WA_VERIFY_TOKEN || "healthyplanet-verify";
  try {
    if (!app_id || !app_secret) throw new Error("App ID and App Secret are required");
    const r1 = await fetch(`https://graph.facebook.com/v20.0/${app_id}/subscriptions`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ object: "whatsapp_business_account", callback_url: `${publicUrl()}/api/webhooks/whatsapp`, verify_token: verify, fields: "messages", access_token: `${app_id}|${app_secret}` }) });
    const d1 = await r1.json(); if (!r1.ok) throw new Error(d1.error?.message || "Meta rejected the webhook. Check PUBLIC_URL is reachable and the App Secret is right.");
    let sub = "skipped (no WABA ID given)";
    if (waba_id && process.env.WA_TOKEN) { const r2 = await fetch(`https://graph.facebook.com/v20.0/${waba_id}/subscribed_apps`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }); const d2 = await r2.json(); sub = r2.ok ? "done" : `failed: ${d2.error?.message}`; }
    audit(req, "whatsapp webhook registered"); res.json({ ok: true, message: `Webhook registered with Meta. App subscription to your WhatsApp account: ${sub}. Now send yourself a test message above.` });
  } catch (e) { res.json({ ok: false, message: e.message }); }
});
