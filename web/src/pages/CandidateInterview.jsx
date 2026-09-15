import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

// The candidate's first-round video interview.
// Briefing and checklist → camera/mic check → Maya asks (natural voice when configured) → 10 s to think →
// recording with a clear indicator → Done → next question. One labelled re-take. Voice command "repeat".
// Uploads retry and never trap the candidate. No transcript is shown; the recording is the record.

const BCP = { en: "en-IN", hi: "hi-IN", pa: "pa-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", ur: "ur-IN" };
const STR = {
  en: {
    title: "First-round interview", hello: "Hello", ready: "I'm ready", start: "Begin the interview", answerNow: "Answer now", done: "Done, next question", rec: "Recording", think: "Take a moment to think", speakIn: "Recording starts in", repeat: "Repeat question", retake: "Re-record this answer (one allowed)", retaking: "Re-recording answer", uploading: "Saving your answer", tryAgain: "Try again", skipClip: "Continue without the video", saved: "Saved", finished: "Your interview is complete", finishedNote: "Thank you. Your answers have been recorded and the school's recruiting team will review them. You will hear from us about the next step. You can close this page.", resume: "Welcome back. Turn your camera and microphone on again to continue.", resumeBtn: "Turn camera on and continue", need: "This interview needs a camera and microphone. Open the link on a laptop or a phone with a camera, and allow access when asked.", check: "Camera and microphone check", checkDark: "Your picture is dark. Face a window or a lamp, so the light is in front of you.", checkOk: "Picture looks good.", micSay: "Say a few words to test your microphone.", micOk: "Microphone is working.", micLow: "We can barely hear you. Move closer to the microphone or check it is not muted.", emailMe: "Email me this link to open on a laptop", emailed: "Sent. Open the email on your laptop and continue there.", listeningRepeat: "Say “repeat the question” or press the button", pressAnswer: "After the countdown, recording starts on its own. Speak to the camera as you would to a panel.", you: "You", maya: "Maya, interviewer", speaking: "Maya is speaking",
  },
  hi: {
    title: "पहला साक्षात्कार", hello: "नमस्ते", ready: "मैं तैयार हूँ", start: "साक्षात्कार शुरू करें", answerNow: "अभी जवाब दें", done: "हो गया, अगला सवाल", rec: "रिकॉर्डिंग", think: "सोचने के लिए एक पल लें", speakIn: "रिकॉर्डिंग शुरू होगी", repeat: "सवाल दोबारा", retake: "यह जवाब दोबारा रिकॉर्ड करें (एक बार)", retaking: "जवाब दोबारा रिकॉर्ड हो रहा है", uploading: "आपका जवाब सहेजा जा रहा है", tryAgain: "फिर कोशिश करें", skipClip: "वीडियो के बिना आगे बढ़ें", saved: "सहेजा गया", finished: "आपका साक्षात्कार पूरा हुआ", finishedNote: "धन्यवाद। आपके जवाब रिकॉर्ड हो गए हैं और स्कूल की टीम उन्हें देखेगी। अगले कदम के बारे में हम आपसे संपर्क करेंगे। आप यह पेज बंद कर सकते हैं।", resume: "वापसी पर स्वागत है। जारी रखने के लिए कैमरा और माइक फिर चालू करें।", resumeBtn: "कैमरा चालू करें और जारी रखें", need: "इस साक्षात्कार के लिए कैमरा और माइक्रोफ़ोन चाहिए। लैपटॉप या कैमरे वाले फ़ोन पर लिंक खोलें और अनुमति दें।", check: "कैमरा और माइक की जाँच", checkDark: "तस्वीर अँधेरी है। खिड़की या लैंप की ओर मुँह करें ताकि रोशनी सामने से आए।", checkOk: "तस्वीर ठीक है।", micSay: "माइक जाँचने के लिए कुछ शब्द बोलें।", micOk: "माइक काम कर रहा है।", micLow: "आवाज़ बहुत धीमी है। माइक के पास आएँ या देखें कि वह म्यूट तो नहीं।", emailMe: "यह लिंक मुझे ईमेल करें ताकि लैपटॉप पर खोल सकूँ", emailed: "भेज दिया। लैपटॉप पर ईमेल खोलकर वहाँ जारी रखें।", listeningRepeat: "“सवाल दोबारा” कहें या बटन दबाएँ", pressAnswer: "गिनती के बाद रिकॉर्डिंग अपने आप शुरू होगी। कैमरे की ओर देखकर वैसे बोलें जैसे पैनल के सामने बोलते।", you: "आप", maya: "माया, साक्षात्कारकर्ता", speaking: "माया बोल रही हैं",
  },
};
const CHECK = {
  en: ["I have 20 uninterrupted minutes and will give this my full attention", "I am in a quiet, private, well-lit room, with the light in front of me", "I am using a laptop or desktop, or my phone is on a stable surface at eye level", "I understand: 3 seconds before recording starts on each answer, I can ask Maya to repeat a question, and I may re-record one answer", "I will answer alone, without notes, other people or the internet, and I understand that leaving the screen or pasting text is noted", "I consent to this interview being recorded, transcribed and assessed for this recruitment. Healthy Planet School restricts access to authorised recruiting staff, stores recordings encrypted, deletes them after 90 days, and takes reasonable measures to protect them, though no online system can be guaranteed against every risk"],
  hi: ["मेरे पास 20 मिनट बिना रुकावट के हैं और मैं पूरा ध्यान दूँगा/दूँगी", "मैं शांत, निजी, अच्छी रोशनी वाले कमरे में हूँ और रोशनी सामने से आ रही है", "मैं लैपटॉप या डेस्कटॉप पर हूँ, या मेरा फ़ोन आँखों की ऊँचाई पर स्थिर रखा है", "मैं समझता/समझती हूँ: हर जवाब से पहले 3 सेकंड, फिर रिकॉर्डिंग शुरू, माया से सवाल दोहराने को कह सकते हैं, और एक जवाब दोबारा रिकॉर्ड कर सकते हैं", "मैं अकेले, बिना नोट्स, बिना किसी की या इंटरनेट की मदद के जवाब दूँगा/दूँगी, और समझता/समझती हूँ कि स्क्रीन छोड़ना या टेक्स्ट पेस्ट करना नोट किया जाता है", "मैं इस भर्ती के लिए साक्षात्कार की रिकॉर्डिंग, ट्रांसक्रिप्शन और मूल्यांकन के लिए सहमति देता/देती हूँ। हेल्दी प्लैनेट स्कूल केवल अधिकृत भर्ती कर्मचारियों को पहुँच देता है, रिकॉर्डिंग एन्क्रिप्टेड रखता है, 90 दिनों में हटा देता है, और उचित सुरक्षा उपाय करता है, यद्यपि किसी भी ऑनलाइन प्रणाली की हर जोखिम से पूर्ण गारंटी नहीं दी जा सकती"],
};

export default function CandidateInterview() {
  const { token } = useParams();
  const [info, setInfo] = useState(null); const [err, setErr] = useState(""); const [lang, setLang] = useState("en");
  const [transcript, setTr] = useState([]); const [ended, setEnded] = useState(false);
  const [ticks, setTicks] = useState([false, false, false, false, false, false]);
  const [camState, setCamState] = useState("off"); const [light, setLight] = useState(null); const [mic, setMic] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | asking | thinking | answering | uploading | failed | retakeOffer
  const [countdown, setCountdown] = useState(0); const [seconds, setSeconds] = useState(0); const [busy, setBusy] = useState(false); const [emailed, setEmailed] = useState(false);
  const [retakeUsed, setRetakeUsed] = useState(false); const [isRetake, setIsRetake] = useState(false); const [pendingBlob, setPendingBlob] = useState(null);
  const videoRef = useRef(null), streamRef = useRef(null), recRef = useRef(null), chunksRef = useRef([]), srRef = useRef(null), finalRef = useRef(""), interimRef = useRef(""), timerRef = useRef(null), startedAtRef = useRef(0), phaseRef = useRef("idle"), audioRef = useRef(null), spokenForRef = useRef("");
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const t = STR[lang] || STR.en, checklist = CHECK[lang] || CHECK.en;
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const signal = (type, detail = "") => api(`/public/interview/${token}/signal`, { method: "POST", body: { type, detail } }).catch(() => {});

  useEffect(() => { api(`/public/interview/${token}`, { auth: false }).then((i) => { setInfo(i); setTr(i.transcript); setLang(i.language); setRetakeUsed(i.retake_used); if (i.status === "completed") setEnded(true); }).catch((e) => setErr(e.message)); }, [token]);
  useEffect(() => { let id = localStorage.getItem("hph_dev"); if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("hph_dev", id); } api(`/public/interview/${token}/session`, { method: "POST", body: { id } }).catch(() => {}); }, [token]);

  const running = info?.status === "in_progress" && !ended;
  useEffect(() => {
    if (!running) return;
    const vis = () => document.hidden && signal("hidden"), blur = () => signal("blur"), paste = (e) => signal("paste", (e.clipboardData?.getData("text") || "").slice(0, 400)), copy = () => signal("copy");
    document.addEventListener("visibilitychange", vis); window.addEventListener("blur", blur); document.addEventListener("paste", paste); document.addEventListener("copy", copy);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("blur", blur); document.removeEventListener("paste", paste); document.removeEventListener("copy", copy); };
  }, [running]);

  // ---------- camera, light and microphone check ----------
  async function startCamera() {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true });
      streamRef.current = st; setCamState("on"); signal("camera_ok");
      setTimeout(checkLight, 1500); startMicMeter(st);
    } catch { setCamState("denied"); signal("camera_denied"); }
  }
  function checkLight() {
    const v = videoRef.current; if (!v || !v.videoWidth) return setTimeout(checkLight, 800);
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 48; const ctx = cv.getContext("2d"); ctx.drawImage(v, 0, 0, 64, 48);
    const d = ctx.getImageData(0, 0, 64, 48).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    const avg = sum / (d.length / 4); setLight(avg < 55 ? "dark" : "ok"); if (avg < 55) signal("dark", String(Math.round(avg)));
  }
  function startMicMeter(st) {
    try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaStreamSource(st); const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an); const buf = new Uint8Array(an.fftSize); let peak = 0, n = 0;
      const iv = setInterval(() => { an.getByteTimeDomainData(buf); let s = 0; for (const x of buf) s += (x - 128) ** 2; const rms = Math.sqrt(s / buf.length); peak = Math.max(peak, rms); n++; if (peak > 6) { setMic("ok"); clearInterval(iv); } else if (n > 60) { setMic("low"); signal("audio_low"); clearInterval(iv); } }, 100);
    } catch { setMic("ok"); }
  }
  useEffect(() => { if (camState === "on" && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) videoRef.current.srcObject = streamRef.current; });
  useEffect(() => {
    if (!running || camState !== "on" || !("FaceDetector" in window)) return;
    const det = new window.FaceDetector({ maxDetectedFaces: 4, fastMode: true });
    const check = async () => { const v = videoRef.current; if (!v || !v.videoWidth) return; const cv = document.createElement("canvas"); cv.width = 320; cv.height = Math.round(320 * v.videoHeight / v.videoWidth); cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height); try { const f = await det.detect(cv); signal("faces", String(f.length)); } catch {} };
    const iv = setInterval(check, 60000); const t0 = setTimeout(check, 5000); return () => { clearInterval(iv); clearTimeout(t0); };
  }, [running, camState]);
  useEffect(() => { if (ended) { streamRef.current?.getTracks().forEach((x) => x.stop()); window.speechSynthesis?.cancel(); audioRef.current?.pause(); } }, [ended]);

  // ---------- Maya speaks: natural voice from the server if configured, else the browser ----------
  const speak = (text) => new Promise(async (resolve) => {
    let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
    if (info?.tts) {
      try { const r = await fetch(`/api/public/interview/${token}/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (r.status === 200) { const url = URL.createObjectURL(await r.blob()); const a = new Audio(url); audioRef.current = a; a.onended = fin; a.onerror = fin; await a.play().catch(fin); setTimeout(fin, 8000 + text.length * 90); return; } } catch {}
    }
    if (!window.speechSynthesis) return fin();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = BCP[lang] || "en-IN"; u.rate = 0.92; u.pitch = 1;
    const voices = window.speechSynthesis.getVoices(); const v = voices.find((x) => x.lang === u.lang && /female|woman|neerja|heera|veena/i.test(x.name)) || voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang.startsWith(lang)); if (v) u.voice = v;
    u.onend = fin; u.onerror = fin; window.speechSynthesis.speak(u); setTimeout(fin, 8000 + text.length * 90);
  });
  const lastQ = [...transcript].reverse().find((m) => m.role === "assistant")?.content || "";

  // Ask → think (10 s, with "repeat" listening) → record
  useEffect(() => {
    if (!running || !lastQ || ended || spokenForRef.current === lastQ || camState !== "on") return;
    if (["retakeOffer", "uploading", "failed", "answering"].includes(phase)) return; // the next question waits until the candidate has decided about a re-take
    spokenForRef.current = lastQ; askThenThink(lastQ);
  }, [lastQ, running, camState, phase]);
  async function askThenThink(q) {
    setPhase("asking"); await speak(q); if (phaseRef.current !== "asking") return;
    setPhase("thinking"); listenForRepeat();
    let n = info?.thinking_seconds || 3; setCountdown(n);
    const iv = setInterval(() => { n--; setCountdown(n); if (n <= 0) { clearInterval(iv); if (phaseRef.current === "thinking") beginAnswer(); } }, 1000);
    thinkTimerRef.current = iv;
  }
  const thinkTimerRef = useRef(null);
  function listenForRepeat() {
    if (!SR) return; try { srRef.current?.stop(); } catch {}
    const sr = new SR(); sr.lang = BCP[lang] || "en-IN"; sr.interimResults = true; sr.continuous = true; srRef.current = sr;
    sr.onresult = (e) => { const said = Array.from(e.results).map((r) => r[0].transcript).join(" ").toLowerCase(); if (/repeat|again|dobara|दोबारा|फिर से|dohra/.test(said) && phaseRef.current === "thinking") repeatQuestion(); };
    sr.onerror = () => {}; try { sr.start(); } catch {}
  }
  function repeatQuestion() { clearInterval(thinkTimerRef.current); try { srRef.current?.stop(); } catch {} spokenForRef.current = ""; window.speechSynthesis?.cancel(); audioRef.current?.pause(); askThenThink(lastQ); }

  async function start() {
    setBusy(true);
    try { const r = await api(`/public/interview/${token}/start`, { method: "POST", body: { language: lang } }); setTr(r.transcript); setInfo({ ...info, status: "in_progress" }); } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  // ---------- answering ----------
  function beginAnswer() {
    clearInterval(thinkTimerRef.current); try { srRef.current?.stop(); } catch {} window.speechSynthesis?.cancel(); audioRef.current?.pause();
    setPhase("answering"); setErr(""); finalRef.current = ""; chunksRef.current = []; setSeconds(0); startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000)), 500);
    if (streamRef.current && window.MediaRecorder) {
      const mime = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      try { const rec = new MediaRecorder(streamRef.current, { mimeType: mime || undefined, videoBitsPerSecond: 400000, audioBitsPerSecond: 48000 }); rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data); rec.start(1000); recRef.current = rec; } catch { recRef.current = null; }
    }
    if (SR) { // browser transcript is only a fallback for the server's transcription; the candidate never sees it
      const sr = new SR(); sr.lang = BCP[lang] || "en-IN"; sr.interimResults = true; sr.continuous = true; srRef.current = sr;
      sr.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalRef.current = (finalRef.current + " " + e.results[i][0].transcript).trim(); else interim += e.results[i][0].transcript; } interimRef.current = interim; };
      sr.onend = () => { if (phaseRef.current === "answering") { try { sr.start(); } catch {} } }; sr.onerror = () => {}; try { sr.start(); } catch {}
    }
  }
  async function finishAnswer() {
    clearInterval(timerRef.current); setPhase("uploading");
    // Let speech recognition confirm the last few words before we stop it (up to 1.5 s), then fold in any unconfirmed text
    if (srRef.current) { const sr = srRef.current; await new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; sr.onend = fin; try { sr.stop(); } catch { fin(); } setTimeout(fin, 1500); }); if (interimRef.current) { finalRef.current = (finalRef.current + " " + interimRef.current).trim(); interimRef.current = ""; } }
    let blob = null;
    if (recRef.current && recRef.current.state !== "inactive") { await new Promise((res) => { recRef.current.onstop = res; recRef.current.stop(); }); blob = new Blob(chunksRef.current, { type: recRef.current.mimeType || "video/webm" }); }
    setPendingBlob(blob); await submit(blob, false);
  }
  async function submit(blob, skipClip) {
    const answerIndex = transcript.filter((m) => m.role === "user").length;
    const secs = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const text = (finalRef.current || "").trim() || (lang === "hi" ? "(उत्तर वीडियो में रिकॉर्ड किया गया)" : "(answer recorded on video; see the recording)");
    setPhase("uploading");
    try {
      if (blob && blob.size > 1000 && !skipClip) {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 45000);
        const plainType = (blob.type || "video/webm").split(";")[0]; // codecs suffix confused the server before
        const up = await fetch(`/api/public/interview/${token}/clip/${answerIndex}?seconds=${secs}`, { method: "POST", headers: { "Content-Type": plainType }, body: blob, signal: ctrl.signal });
        clearTimeout(to); if (!up.ok) throw new Error(`upload ${up.status}`);
      } else if (skipClip) signal("clip_failed", `answer ${answerIndex + 1}: continued without video after upload failure`);
      const r = await api(`/public/interview/${token}/answer`, { method: "POST", body: { answer: text } });
      setTr(r.transcript); setPendingBlob(null); setIsRetake(false);
      if (r.ended) { setEnded(true); setPhase("idle"); } else setPhase(retakeUsed ? "idle" : "retakeOffer");
    } catch (e) { setPhase("failed"); setErr(e.name === "AbortError" ? "The upload timed out." : e.message); }
  }
  async function retake() {
    try { const r = await api(`/public/interview/${token}/retake`, { method: "POST", body: {} }); setRetakeUsed(true); setIsRetake(true); setTr(r.transcript); spokenForRef.current = ""; } catch (e) { setErr(e.message); }
  }
  // When a re-take offer is on screen and Maya's next question arrives, the next question waits until the offer is dismissed
  useEffect(() => { if (phase === "retakeOffer") { window.speechSynthesis?.cancel(); audioRef.current?.pause(); } }, [phase]);
  function proceedAfterOffer() { setPhase("idle"); spokenForRef.current = ""; }

  if (err && !info) return <Center><div className="card" style={{ maxWidth: 380 }}><b>Healthy Planet School</b><p>{err}</p></div></Center>;
  if (!info) return <Center><span className="muted">Loading...</span></Center>;
  if (info.status === "expired") return <Center><div className="card" style={{ maxWidth: 380 }}><b>Healthy Planet School</b><p>This interview link has expired. Please reply to the school's message and we will send you a fresh one.</p></div></Center>;
  const answered = transcript.filter((m) => m.role === "user").length;
  const allTicked = ticks.every(Boolean);
  const canStart = allTicked && camState === "on" && light !== null && mic !== null;
  const firstName = info.candidate;

  // ---------- completion ----------
  if (ended) return <Center><div className="card" style={{ maxWidth: 460, textAlign: "center", padding: 28 }}><div style={{ fontSize: 40, color: "var(--green)" }}>✓</div><div style={{ fontSize: 20, fontWeight: 700, margin: "6px 0" }}>{t.finished}</div><p className="muted" style={{ lineHeight: 1.5 }}>{t.finishedNote}</p></div></Center>;

  // ---------- resume after a dropped connection: camera must come back first ----------
  if (running && camState !== "on") return <Center><div className="card" style={{ maxWidth: 420 }}><b>Healthy Planet School · {t.title}</b><p>{t.resume}</p>{camState === "denied" && <p style={{ color: "#B0463C" }}>{t.need}</p>}<button className="warm" style={{ width: "100%" }} onClick={() => { signal("resumed"); startCamera(); }}>{t.resumeBtn}</button></div></Center>;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0F1512", color: "#fff" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, maxWidth: 960, width: "100%", margin: "0 auto" }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--yellow)", color: "#000", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 13 }}>HP</span>
        <div><div style={{ fontWeight: 700 }}>Healthy Planet School · {t.title}</div><div style={{ fontSize: 12, opacity: .7 }}>{info.role}{running ? ` · ${Math.min(answered, info.total)} / ${info.total}` : ""}</div></div>
      </div>
      {running && <div style={{ height: 4, background: "#2A332E" }}><div style={{ height: 4, width: `${Math.min(100, (answered / info.total) * 100)}%`, background: "var(--yellow)", transition: "width .3s" }} /></div>}

      {/* Briefing and checklist */}
      {!running && (
        <div style={{ padding: 16, maxWidth: 720, width: "100%", margin: "0 auto" }}>
          <div className="card" style={{ background: "#fff", color: "var(--ink)" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{t.hello}, {firstName}</div>
            <p style={{ lineHeight: 1.55, marginTop: 6 }}>{lang === "hi" ? `यह ${info.role} पद के लिए चयन प्रक्रिया का पहला दौर है। माया, हमारी साक्षात्कारकर्ता, ${info.total} सवाल पूछेंगी, साथ में कुछ फ़ॉलो-अप${info.interactive ? " और एक छोटा रोल-प्ले" : ""}। लगभग 15 से 20 मिनट। आपके जवाबों को इस भूमिका की ज़रूरतों के अनुसार परखा जाता है, और इसी से तय होता है कि स्कूल में पैनल दौर के लिए किसे बुलाया जाए।` : `This is the first round of the selection process for ${info.role}. Maya, our interviewer, will ask ${info.total} questions with some follow-ups${info.interactive ? " and a short role play in which she plays another person" : ""}. It takes 15 to 20 minutes. Your answers are assessed against what this role needs, and the result decides who is invited to the panel rounds at the school. Specific examples from your own classroom count for more than general statements, and nobody expects polish.`}</p>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{lang === "hi" ? "यह कैसे चलेगा: माया हर सवाल बोलकर पूछेंगी। सवाल पूरा होने के 3 सेकंड बाद रिकॉर्डिंग अपने आप शुरू होगी। कैमरे की ओर देखकर बोलें, फिर 'हो गया' दबाएँ। सवाल दोहराने के लिए 'सवाल दोबारा' कहें या बटन दबाएँ। पूरे साक्षात्कार में एक जवाब दोबारा रिकॉर्ड किया जा सकता है; दोनों रिकॉर्डिंग रखी जाती हैं।" : "How it works: Maya asks each question aloud. Three seconds after she finishes, recording starts on its own. Speak to the camera, then press Done. To hear a question again, say “repeat the question” or press the button. Once in the interview you may re-record one answer; both recordings are kept and the second is marked as a re-take."}</div>
            {Object.keys(info.languages || {}).length > 1 && <div className="row" style={{ margin: "12px 0 4px", gap: 6 }}>{Object.entries(info.languages).map(([k, l]) => <button key={k} className={`small ${lang === k ? "primary" : ""}`} onClick={() => setLang(k)}>{l}</button>)}</div>}

            <div style={{ fontWeight: 700, fontSize: 15, margin: "16px 0 4px", paddingTop: 12, borderTop: "1px solid var(--line)" }}>{lang === "hi" ? "साक्षात्कार शुरू करने से पहले, कृपया सुनिश्चित करें:" : "Before starting the interview, please ensure the following:"}</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{lang === "hi" ? "हर बिंदु पढ़ें और सही का निशान लगाएँ।" : "Read and tick each point."}</div>
            {checklist.map((c, i) => <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.45, marginBottom: 8, background: ticks[i] ? "#E6F1EA" : "var(--soft)", borderRadius: 8, padding: "8px 10px" }}><input type="checkbox" style={{ width: "auto", marginTop: 4 }} checked={ticks[i]} onChange={(e) => setTicks(ticks.map((x, j) => (j === i ? e.target.checked : x)))} /><span><b style={{ marginRight: 6 }}>{i + 1}.</b>{c}</span></label>)}
            {info.candidate_email && !emailed && <button className="link" style={{ fontSize: 13, margin: "4px 0 10px" }} onClick={async () => { try { await api(`/public/interview/${token}/email-link`, { method: "POST", body: {}, auth: false }); setEmailed(true); } catch (e) { setErr(e.message); } }}>{t.emailMe}</button>}
            {emailed && <div style={{ fontSize: 13, color: "var(--green)", margin: "4px 0 10px" }}>{t.emailed}</div>}

            <div style={{ fontWeight: 700, fontSize: 15, margin: "16px 0 6px", paddingTop: 12, borderTop: "1px solid var(--line)" }}>{t.check}</div>
            {camState !== "on" && <div><button className="warm" onClick={startCamera}>{lang === "hi" ? "कैमरा और माइक चालू करें" : "Turn on camera and microphone"}</button>{camState === "denied" && <div style={{ color: "#B0463C", fontSize: 13, marginTop: 6 }}>{t.need}</div>}</div>}
            {camState === "on" && <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "center" }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: 180, height: 135, objectFit: "cover", borderRadius: 10, transform: "scaleX(-1)", background: "#000" }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ color: light === "dark" ? "#B0463C" : light === "ok" ? "var(--green)" : "var(--mute)" }}>{light === null ? "..." : light === "dark" ? t.checkDark : t.checkOk} {light === "dark" && <button className="link" style={{ fontSize: 12 }} onClick={checkLight}>{lang === "hi" ? "फिर जाँचें" : "check again"}</button>}</div>
                <div style={{ color: mic === "low" ? "#B0463C" : mic === "ok" ? "var(--green)" : "var(--mute)" }}>{mic === null ? t.micSay : mic === "ok" ? t.micOk : t.micLow} {mic === "low" && <button className="link" style={{ fontSize: 12 }} onClick={() => { setMic(null); startMicMeter(streamRef.current); }}>{lang === "hi" ? "फिर जाँचें" : "test again"}</button>}</div>
              </div>
            </div>}

            <button className="primary" disabled={busy || !canStart} onClick={start} style={{ width: "100%", marginTop: 16, padding: 12, fontSize: 15 }}>{busy ? "..." : t.start}</button>
            {!allTicked && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{lang === "hi" ? "शुरू करने के लिए ऊपर हर बिंदु पर सही का निशान लगाएँ।" : "Tick every item above to begin."}</div>}
            <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{lang === "hi" ? "आपका डेटा केवल इस भर्ती के लिए उपयोग होता है। अपना डेटा देखने, सुधारने या हटाने के लिए, या सहमति वापस लेने के लिए hr@healthyplanetschool.com पर लिखें।" : "Your data is used for this recruitment only. Write to hr@healthyplanetschool.com to see, correct or delete your data, or to withdraw consent."}</div>
          </div>
        </div>
      )}

      {/* The interview: two boxes */}
      {running && (
        <div style={{ flex: 1, padding: 12, maxWidth: 960, width: "100%", margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 12 }} className="interview-grid">
          <style>{`@media (max-width: 700px) { .interview-grid { grid-template-columns: 1fr !important; } }`}</style>
          <div style={{ position: "relative", background: "#000", borderRadius: 14, overflow: "hidden", minHeight: 240 }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", minHeight: 240, maxHeight: "60vh", objectFit: "cover", transform: "scaleX(-1)", display: "block" }} />
            <div style={{ position: "absolute", left: 12, bottom: 12, background: "rgba(0,0,0,.6)", borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 500 }}>{t.you}: {firstName}</div>
            {phase === "answering" && <div style={{ position: "absolute", right: 12, top: 12, background: "#C0392B", borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", animation: "blink 1s infinite" }} />{t.rec} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>}
            <style>{`@keyframes blink { 50% { opacity: .2 } } @keyframes pulse { 0%,100% { transform: scale(1); opacity: .6 } 50% { transform: scale(1.35); opacity: 0 } }`}</style>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#1C2620", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", width: 56, height: 56 }}>
                {phase === "asking" && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--green)", animation: "pulse 1.4s infinite" }} />}
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--green)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20 }}>M</span>
              </div>
              <div><div style={{ fontWeight: 700 }}>{t.maya}</div><div style={{ fontSize: 12, opacity: .75 }}>{phase === "asking" ? t.speaking : phase === "thinking" ? t.think : phase === "answering" ? t.rec : ""}</div></div>
            </div>
            <div className="card" style={{ background: "#fff", color: "var(--ink)", flex: 1 }}>
              {phase !== "retakeOffer" && <div style={{ fontSize: 16, lineHeight: 1.45 }}>{lastQ}</div>}
              {(phase === "asking" || phase === "thinking") && <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12 }}>{t.pressAnswer}</div>
                {phase === "thinking" && <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}><div style={{ width: 52, height: 52, borderRadius: "50%", border: "4px solid var(--yellow)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20 }}>{countdown}</div><div style={{ fontSize: 13 }}>{t.speakIn} {countdown}s<div className="muted" style={{ fontSize: 12 }}>{t.listeningRepeat}</div></div></div>}
                <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={phase !== "thinking"} onClick={beginAnswer}>{t.answerNow}</button><button disabled={phase !== "thinking"} onClick={repeatQuestion}>{t.repeat}</button></div>
              </div>}
              {phase === "answering" && <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: "#C0392B", fontWeight: 700 }}>● {t.rec}{isRetake ? ` · ${t.retaking}` : ""}</div>
                <button className="warm" onClick={finishAnswer} style={{ width: "100%", padding: 12, fontSize: 15, marginTop: 10 }} disabled={seconds < 3}>{t.done}</button>
              </div>}
              {phase === "uploading" && <div className="muted" style={{ marginTop: 12 }}>{t.uploading}...</div>}
              {phase === "failed" && <div style={{ marginTop: 12 }}><div style={{ color: "#B0463C", fontSize: 13 }}>{err}</div><div className="row" style={{ marginTop: 8 }}><button className="primary" onClick={() => submit(pendingBlob, false)}>{t.tryAgain}</button><button onClick={() => submit(pendingBlob, true)}>{t.skipClip}</button></div></div>}
              {phase === "retakeOffer" && <div style={{ marginTop: 12 }}><div style={{ color: "var(--green)", fontSize: 13, fontWeight: 500 }}>✓ {t.saved}</div><div className="row" style={{ marginTop: 8 }}><button className="primary" onClick={proceedAfterOffer}>{lang === "hi" ? "अगला सवाल" : "Next question"}</button>{!retakeUsed && <button onClick={retake}>{t.retake}</button>}</div></div>}
              {err && phase !== "failed" && <div style={{ color: "#B0463C", fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const Center = ({ children }) => <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>{children}</div>;
