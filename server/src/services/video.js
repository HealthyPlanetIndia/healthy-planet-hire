// Video interviews via Daily.co (https://daily.co). Set DAILY_API_KEY to enable.
// Rooms are created per candidate with cloud recording and transcription on; Daily calls our
// webhook when the transcript is ready and we run the same report generator as text interviews.
const API = "https://api.daily.co/v1";
export const videoEnabled = () => !!process.env.DAILY_API_KEY;
const h = () => ({ Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" });

export async function createRoom(name, expiresAt) {
  const res = await fetch(`${API}/rooms`, { method: "POST", headers: h(), body: JSON.stringify({ name, privacy: "public", properties: { exp: Math.floor(new Date(expiresAt).getTime() / 1000), enable_recording: "cloud", enable_transcription_storage: true, max_participants: 3, enable_chat: false, enable_knocking: false, enable_screenshare: false, eject_at_room_exp: true, start_video_off: false } }) });
  const d = await res.json(); if (!res.ok) throw new Error(d.info || d.error || "Daily room failed"); return d;
}
// Recordings stay in Daily's storage (encrypted at rest, private). We keep only the recording id and
// mint a short-lived access link (default 1 hour) each time a signed-in recruiter presses "Watch".
export async function recordingLink(recordingId, validSeconds = 3600) {
  const r = await fetch(`${API}/recordings/${recordingId}/access-link?valid_for_secs=${validSeconds}`, { headers: h() });
  const d = await r.json(); if (!r.ok) throw new Error(d.info || "Could not create a viewing link");
  return d.download_link;
}
export async function deleteRecording(recordingId) {
  const r = await fetch(`${API}/recordings/${recordingId}`, { method: "DELETE", headers: h() });
  if (!r.ok && r.status !== 404) throw new Error("Could not delete recording");
}
export async function deleteTranscript(transcriptId) {
  const r = await fetch(`${API}/transcript/${transcriptId}`, { method: "DELETE", headers: h() });
  if (!r.ok && r.status !== 404) throw new Error("Could not delete transcript");
}
export async function deleteRoom(roomName) { await fetch(`${API}/rooms/${roomName}`, { method: "DELETE", headers: h() }).catch(() => {}); }
export async function transcriptText(transcriptId) {
  const r = await fetch(`${API}/transcript/${transcriptId}/access-link`, { headers: h() });
  const d = await r.json(); if (!r.ok) throw new Error("Transcript link failed");
  const vtt = await (await fetch(d.link)).text();
  // WebVTT → plain lines, keeping speaker tags where Daily provides them
  return vtt.split("\n").filter((l) => l && !/^\d+$/.test(l) && !l.includes("-->") && l !== "WEBVTT").join("\n");
}
