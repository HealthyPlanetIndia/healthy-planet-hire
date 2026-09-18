// Maya's voice. With ELEVENLABS_API_KEY set, questions are spoken by a natural voice with the school's chosen
// accent, tone and speed (Settings → Interview voice). Without it, the candidate's browser voice is used.
import { db } from "../db.js";
export const ttsEnabled = () => !!process.env.ELEVENLABS_API_KEY;
export const VOICES = {
  "indian-female-calm": { id: process.env.ELEVEN_VOICE_INDIAN_F || "EXAVITQu4vr4xnSDxMaL", label: "Indian English, female, calm" },
  "indian-male-calm": { id: process.env.ELEVEN_VOICE_INDIAN_M || "pNInz6obpgDQGcFmaJgB", label: "Indian English, male, calm" },
  "british-female": { id: process.env.ELEVEN_VOICE_BRITISH_F || "XB0fDUnXU5powFXDhCwa", label: "British English, female" },
  "neutral-female": { id: process.env.ELEVEN_VOICE_NEUTRAL_F || "21m00Tcm4TlvDq8ikWAM", label: "Neutral English, female" },
};
export function voiceSettings() {
  const get = (k, d) => db.prepare("SELECT body FROM templates WHERE key=?").get(k)?.body ?? d;
  return { voice: get("tts_voice", "indian-female-calm"), speed: +get("tts_speed", "0.92"), stability: +get("tts_stability", "0.7"), style: +get("tts_style", "0.2") };
}
const cache = new Map();
export async function speak(text, language = "en") {
  const s = voiceSettings(), v = VOICES[s.voice] || VOICES["indian-female-calm"];
  const key = `${v.id}|${s.speed}|${s.stability}|${language}|${text}`;
  if (cache.has(key)) return cache.get(key);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_22050_32`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: s.stability, similarity_boost: 0.8, style: s.style, use_speaker_boost: true, speed: s.speed } }) });
  if (!r.ok) { let why = `status ${r.status}`; try { const d = await r.json(); why = d?.detail?.message || d?.detail?.status || d?.detail || why; } catch {} throw new Error(r.status === 401 ? "voice key rejected" : r.status === 429 || /quota|limit/i.test(String(why)) ? `voice quota exhausted (${why})` : `voice service ${why}`); }
  const buf = Buffer.from(await r.arrayBuffer());
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, buf); return buf;
}
