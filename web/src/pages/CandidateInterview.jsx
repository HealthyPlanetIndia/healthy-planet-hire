import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

// Public page: candidates open this on their phone from the link they received.
export default function CandidateInterview() {
  const { token } = useParams();
  const [info, setInfo] = useState(null); const [err, setErr] = useState(""); const [transcript, setTr] = useState([]);
  const [draft, setDraft] = useState(""); const [busy, setBusy] = useState(false); const [ended, setEnded] = useState(false); const [lang, setLang] = useState("en");
  const endRef = useRef(null); const videoRef = useRef(null); const streamRef = useRef(null); const [camState, setCamState] = useState("off");
  const signal = (type, detail = "") => api(`/public/interview/${token}/signal`, { method: "POST", body: { type, detail } }).catch(() => {});

  // Device/browser identity so the school can see if the link was opened from more than one place
  useEffect(() => { let id = localStorage.getItem("hph_dev"); if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("hph_dev", id); } api(`/public/interview/${token}/session`, { method: "POST", body: { id } }).catch(() => {}); }, [token]);

  // Behaviour signals while the interview is running: leaving the tab, losing focus, pasting, copying
  const running = info?.status === "in_progress" && !ended;
  useEffect(() => {
    if (!running) return;
    const vis = () => document.hidden && signal("hidden");
    const blur = () => signal("blur");
    const paste = (e) => signal("paste", (e.clipboardData?.getData("text") || "").slice(0, 400));
    const copy = () => signal("copy");
    document.addEventListener("visibilitychange", vis); window.addEventListener("blur", blur); document.addEventListener("paste", paste); document.addEventListener("copy", copy);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("blur", blur); document.removeEventListener("paste", paste); document.removeEventListener("copy", copy); };
  }, [running]);

  // Optional camera: a small frame every 75 seconds, plus a face count where the browser supports it
  async function startCamera() {
    try { const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320 }, audio: false }); streamRef.current = st; if (videoRef.current) videoRef.current.srcObject = st; setCamState("on"); signal("camera_ok"); }
    catch { setCamState("denied"); signal("camera_denied"); }
  }
  useEffect(() => {
    if (!running || camState !== "on") return;
    const detector = "FaceDetector" in window ? new window.FaceDetector({ maxDetectedFaces: 4, fastMode: true }) : null;
    const shoot = async () => {
      const v = videoRef.current; if (!v || v.videoWidth === 0) return;
      const cv = document.createElement("canvas"); const w = 320, h = Math.round(320 * v.videoHeight / v.videoWidth); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(v, 0, 0, w, h);
      api(`/public/interview/${token}/snapshot`, { method: "POST", body: { image: cv.toDataURL("image/jpeg", 0.5) } }).catch(() => {});
      if (detector) { try { const faces = await detector.detect(cv); signal("faces", String(faces.length)); } catch {} }
    };
    const t0 = setTimeout(shoot, 4000); const iv = setInterval(shoot, 75000);
    return () => { clearTimeout(t0); clearInterval(iv); };
  }, [running, camState]);
  useEffect(() => { if (ended && streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); setCamState("off"); } }, [ended]);

  useEffect(() => { api(`/public/interview/${token}`).then((i) => { setInfo(i); setTr(i.transcript); setLang(i.language); if (i.status === "completed") setEnded(true); }).catch((e) => setErr(e.message)); }, [token]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript, busy]);

  async function start() { setBusy(true); try { const r = await api(`/public/interview/${token}/start`, { method: "POST", body: { language: lang } }); setTr(r.transcript); setInfo({ ...info, status: "in_progress" }); } catch (e) { setErr(e.message); } setBusy(false); }
  async function send() { if (!draft.trim() || busy) return; const a = draft.trim(); setTr((t) => [...t, { role: "user", content: a }]); setDraft(""); setBusy(true);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) { try { const r = await api(`/public/interview/${token}/answer`, { method: "POST", body: { answer: a } }); setTr(r.transcript); if (r.ended) setEnded(true); ok = true; setErr(""); } catch (e) { if (attempt === 2) { setErr(`${e.message}. Your answer is kept in the box below; check your connection and send again.`); setDraft(a); setTr((t) => t.slice(0, -1)); } else await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); } }
    setBusy(false); }

  const answered = transcript.filter((m) => m.role === "user").length;
  const t = lang === "hi" ? { title: "पहला साक्षात्कार", hi: "नमस्ते", intro: "माया, हमारी इंटरव्यूअर, आपसे कुछ सवाल पूछेंगी। आराम से, अपने शब्दों में जवाब दें। इसमें लगभग 15 मिनट लगते हैं।", start: "शुरू करें", type: "अपना जवाब लिखें", send: "भेजें", done: "धन्यवाद! आपका साक्षात्कार पूरा हुआ। स्कूल की टीम शीघ्र ही आपसे संपर्क करेगी।",
      honest: "यह साक्षात्कार आपके अपने विचार जानने के लिए है। कृपया अकेले, बिना किसी की मदद या इंटरनेट के जवाब दें। साक्षात्कार के दौरान हम यह नोट करते हैं कि आप स्क्रीन से बाहर जाते हैं या टेक्स्ट पेस्ट करते हैं, और आपकी अनुमति से कैमरे से कुछ तस्वीरें लेते हैं, जिन्हें केवल स्कूल की भर्ती टीम देखती है।", cam: "कैमरा चालू करें", camOn: "कैमरा चालू है", camNo: "कैमरे के बिना जारी रखें", agree: "मैं समझता/समझती हूँ" }
    : { title: "First-round interview", hi: "Hello", intro: "Maya, our interviewer, will ask you a few questions. Take your time and answer in your own words. It takes about 15 minutes.", start: "Start interview", type: "Type your answer", send: "Send", done: "Thank you! Your interview is complete. The school team will be in touch soon.",
      honest: "This interview is about your own thinking, so please complete it alone, without help from anyone or from the internet. While it runs we note if you leave the screen or paste text, and with your permission we take a few camera photos. Only the school's recruiting team sees these.", cam: "Turn camera on", camOn: "Camera is on", camNo: "Continue without camera", agree: "I understand" };
  const [agreed, setAgreed] = useState(false);
  // Voice mode: browser speech recognition for the candidate, speech synthesis for Maya. Falls back to typing where unsupported.
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const voiceSupported = !!SR && typeof window.speechSynthesis !== "undefined";
  const [voice, setVoice] = useState(false); const [listening, setListening] = useState(false); const recRef = useRef(null);
  const BCP = { en: "en-IN", hi: "hi-IN", pa: "pa-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", ur: "ur-IN" };
  const speak = (text) => { if (!voice || !window.speechSynthesis) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = BCP[lang] || "en-IN"; const v = window.speechSynthesis.getVoices().find((x) => x.lang === u.lang) || window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang)); if (v) u.voice = v; u.rate = 0.95; window.speechSynthesis.speak(u); };
  useEffect(() => { const last = transcript[transcript.length - 1]; if (voice && last?.role === "assistant") speak(last.content); }, [transcript.length, voice]);
  function toggleListen() {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR(); rec.lang = BCP[lang] || "en-IN"; rec.interimResults = true; rec.continuous = true; recRef.current = rec;
    let finalText = draft;
    rec.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText = (finalText + " " + r[0].transcript).trim(); else interim += r[0].transcript; } setDraft((finalText + " " + interim).trim()); };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    window.speechSynthesis?.cancel(); rec.start(); setListening(true);
  }
  useEffect(() => { if (ended) { recRef.current?.stop(); window.speechSynthesis?.cancel(); } }, [ended]);

  if (err && !info) return <Center><div className="card" style={{ maxWidth: 380 }}><b>Healthy Planet School</b><p>{err}</p></div></Center>;
  if (!info) return <Center><span className="muted">Loading...</span></Center>;
  if (info.status === "expired") return <Center><div className="card" style={{ maxWidth: 380 }}><b>Healthy Planet School</b><p>This interview link has expired. Please reply to the school's message and we will send you a fresh one.</p></div></Center>;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "var(--black)", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--yellow)", color: "var(--black)", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 13 }}>HP</span>
        <div><div style={{ fontWeight: 700 }}>Healthy Planet School · {t.title}</div><div style={{ fontSize: 12, opacity: .8 }}>{info.role} · {Math.min(answered, info.total)} / {info.total}</div></div>
      </div>
      <video ref={videoRef} autoPlay muted playsInline style={{ position: "fixed", right: 10, bottom: 80, width: 72, borderRadius: 10, display: camState === "on" ? "block" : "none", border: "2px solid var(--yellow)" }} />
      <div style={{ height: 4, background: "#333" }}><div style={{ height: 4, width: `${Math.min(100, (answered / info.total) * 100)}%`, background: "var(--yellow)", transition: "width .3s" }} /></div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 720, width: "100%", margin: "0 auto" }}>
        {transcript.length === 0 && <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t.hi}, {info.candidate}</div>
          <p className="muted" style={{ lineHeight: 1.5 }}>{t.intro}</p>
          <div className="row" style={{ marginBottom: 12, gap: 6 }}>{Object.entries(info.languages || { en: "English", hi: "हिन्दी" }).map(([k, l]) => <button key={k} className={`small ${lang === k ? "primary" : ""}`} onClick={() => setLang(k)}>{l}</button>)}</div>
          {voiceSupported && <div className="row" style={{ marginBottom: 12 }}><button className={voice ? "warm" : ""} onClick={() => setVoice(!voice)}>{voice ? "🎙 " : ""}{lang === "hi" ? (voice ? "बोलकर जवाब दूँगा/दूँगी" : "टाइप करने के बजाय बोलें") : voice ? "Speaking mode on" : "Talk instead of type"}</button><span className="muted" style={{ fontSize: 12 }}>{lang === "hi" ? "माया सवाल बोलेगी और आप बोलकर जवाब देंगे।" : "Maya will speak her questions and you answer out loud."}</span></div>}
          {info.interactive && <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{lang === "hi" ? "इस साक्षात्कार में एक छोटा रोल-प्ले भी होगा, जिसमें माया किसी और की भूमिका निभाएगी।" : "This interview includes a short role play where Maya plays another person and you respond as you would in real life."}</div>}
          {info.proctor && <div style={{ background: "var(--soft)", borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
            {t.honest}
            <div className="row" style={{ marginTop: 10 }}>
              {camState !== "on" && <button className="small" onClick={startCamera}>{t.cam}</button>}
              {camState === "on" && <span className="small" style={{ color: "var(--green)", fontWeight: 500 }}>● {t.camOn}</span>}
              <label style={{ fontSize: 13 }}><input type="checkbox" style={{ width: "auto" }} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> {t.agree}</label>
            </div>
          </div>}
          <button className="warm" disabled={busy || (info.proctor && !agreed)} onClick={start} style={{ width: "100%" }}>{busy ? "..." : t.start}</button>
          <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.4 }}>{lang === "hi" ? "आपके उत्तर और (यदि चालू हो) कैमरे की तस्वीरें केवल भर्ती के लिए, स्कूल की टीम द्वारा देखी जाती हैं। तस्वीरें 90 दिनों में हट जाती हैं। अपना डेटा देखने या हटाने के लिए hr@healthyplanetschool.com पर लिखें।" : "Your answers and, if on, camera photos are used only for this recruitment and seen only by the school's team. Photos are deleted after 90 days. Write to hr@healthyplanetschool.com to see or delete your data."}</div>
        </div>}
        {transcript.map((m, i) => <div key={i} className={`bubble ${m.role === "user" ? "me" : "them"}`} style={{ marginBottom: 10 }}>{m.content}</div>)}
        {busy && transcript.length > 0 && <div className="muted" style={{ fontSize: 13 }}>Maya is typing...</div>}
        {ended && <div className="card" style={{ borderColor: "var(--green)", marginTop: 12 }}>{t.done}</div>}
        {err && <div style={{ color: "#B0463C", fontSize: 13 }}>{err}</div>}
        <div ref={endRef} />
      </div>
      {transcript.length > 0 && !ended && <div style={{ padding: 12, borderTop: "1px solid var(--line)", background: "#fff" }}>
        <div className="row" style={{ maxWidth: 720, margin: "0 auto", flexWrap: "nowrap" }}>
          {voice && <button className={listening ? "warm" : ""} onClick={toggleListen} aria-label="Speak" style={{ minWidth: 48 }}>{listening ? "■" : "🎙"}</button>}
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={listening ? (lang === "hi" ? "सुन रही हूँ..." : "Listening...") : t.type} aria-label={t.type} style={{ minHeight: 48, resize: "none" }} />
          <button className="primary" disabled={busy || !draft.trim()} onClick={() => { recRef.current?.stop(); send(); }}>{t.send}</button>
        </div>
      </div>}
    </div>
  );
}
const Center = ({ children }) => <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>{children}</div>;
