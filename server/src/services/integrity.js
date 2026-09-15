// Turns raw interview signals into a risk assessment a recruiter can read.
// These are signals, not proof. The recruiter decides; the candidate was told monitoring was on.

const TYPING_CPS_MAX = 7;      // sustained chars/sec above this is faster than almost anyone types on a phone
const PASTE_MIN_CHARS = 40;    // short pastes (a name, a link) are ignored

export function ruleBasedFlags(interview) {
  const reasons = [], sig = interview.signals || [], answers = (interview.transcript || []).filter((m) => m.role === "user" && m.meta);
  const count = (t) => sig.filter((s) => s.type === t).length;

  // "hidden" is the tab or app being switched; "blur" also fires for notifications and address-bar taps, so it counts for less
  const away = count("hidden") + Math.floor(count("blur") / 3);
  if (away >= 8) reasons.push({ level: "high", text: `Left the interview screen about ${away} times` });
  else if (away >= 4) reasons.push({ level: "medium", text: `Left the interview screen about ${away} times` });
  else if (away >= 2) reasons.push({ level: "low", text: `Left the interview screen ${away} times (notifications can cause this)` });

  const pastes = sig.filter((s) => s.type === "paste" && (s.detail?.length || 0) >= PASTE_MIN_CHARS);
  if (sig.some((s) => s.type === "clip_failed")) reasons.push({ level: "low", text: "Some video uploads failed on the candidate's connection; those answers have transcript only" });
  if (pastes.length) reasons.push({ level: "high", text: `Pasted text into ${pastes.length} answer${pastes.length > 1 ? "s" : ""} (${pastes.map((p) => p.detail.length).join(", ")} characters)` });

  // Typing-speed check applies only to typed interviews. Spoken answers naturally arrive at 8 to 12 characters a second.
  const spoken = (interview.mode || "video") !== "text" || (interview.clips || []).length > 0 || answers.some((a) => a.meta?.transcribed);
  if (!spoken) {
    const fast = answers.filter((a) => a.meta.seconds > 3 && a.content.length / a.meta.seconds > TYPING_CPS_MAX);
    if (fast.length) reasons.push({ level: fast.length > 1 ? "high" : "medium", text: `${fast.length} answer${fast.length > 1 ? "s" : ""} arrived faster than typing speed (${fast.map((a) => `${Math.round(a.content.length / a.meta.seconds)} chars/sec`).join(", ")})` });
  }

  const longGaps = answers.filter((a) => a.meta.seconds > 420);
  if (longGaps.length) reasons.push({ level: "low", text: `${longGaps.length} answer${longGaps.length > 1 ? "s" : ""} took over 7 minutes` });

  if ((interview.sessions || []).length > 1) reasons.push({ level: "medium", text: `Opened from ${interview.sessions.length} different devices or browsers` });

  const camDenied = sig.some((s) => s.type === "camera_denied");
  if (interview.proctor && camDenied) reasons.push({ level: "low", text: "Camera access was declined" });
  const faces = sig.filter((s) => s.type === "faces");
  const multi = faces.filter((s) => +s.detail >= 2).length, none = faces.filter((s) => +s.detail === 0).length;
  if (multi >= 2 && multi / faces.length >= 0.3) reasons.push({ level: "high", text: `More than one face seen in ${multi} of ${faces.length} camera checks` });
  else if (multi) reasons.push({ level: "low", text: `A second face was seen once in ${faces.length} camera checks (a poster or a passer-by can cause this)` });
  if (faces.length && none / faces.length > 0.5) reasons.push({ level: "medium", text: `No face visible in ${none} of ${faces.length} camera checks` });

  return reasons;
}

export function combine(rules, ai) {
  const reasons = [...rules, ...(ai?.reasons || []).map((r) => ({ level: r.level || "medium", text: r.text, source: "answers" }))];
  const rank = { low: 1, medium: 2, high: 3 };
  const top = reasons.reduce((m, r) => Math.max(m, rank[r.level] || 1), 0);
  const highs = reasons.filter((r) => r.level === "high").length;
  const risk = highs >= 2 || (highs >= 1 && reasons.length >= 3) ? "high" : top >= 3 ? "medium-high" : top === 2 ? "medium" : reasons.length ? "low" : "clear";
  return { risk, reasons, summary: ai?.summary || (reasons.length ? "Review the flagged items before deciding." : "Nothing unusual was observed."), at: new Date().toISOString() };
}
