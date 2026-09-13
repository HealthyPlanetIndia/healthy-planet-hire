import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";

// The candidate's interview page. Video-first: camera and microphone are required, Maya asks each question
// aloud, the candidate answers on camera, each answer is recorded and uploaded (stored encrypted), and the
// spoken words are transcribed in the browser for the written report. Typing is only a fallback.

const BCP = { en: "en-IN", hi: "hi-IN", pa: "pa-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", ur: "ur-IN" };
const STR = {
  en: { title: "Video interview", hi: "Hello", intro: "This is a recorded video interview of about 15 minutes. Maya, our interviewer, will ask you questions out loud. Press Answer, speak to the camera as you would in person, then press Done.", need: "This interview needs a camera and microphone. Please open the link on a phone or laptop with a camera and allow access when asked.", cam: "Turn on camera and microphone", camOn: "Camera and microphone are on", start: "Start interview", answer: "Answer", done: "Done, next question", rec: "Recording", listen: "Listening", typeHint: "If speech is not being picked up, you can type your answer here too.", uploading: "Saving your answer...", finished: "Thank you! Your interview is complete. The school team will be in touch soon.", honest: "Please complete this alone, without help from anyone or the internet. We note if you leave the screen or paste text, and the video is seen only by the school's recruiting team and deleted after 90 days.", agree: "I understand", repeat: "Repeat question", privacy: "Write to hr@healthyplanetschool.com to see or delete your data.", retry: "Connection problem. Press Done again to retry.", interactive: "This interview includes a short role play where Maya plays another person and you respond as you would in real life.", speaking: "Maya is speaking...", earlier: "Earlier questions", yourAnswer: "Your last answer, as transcribed", checking: "Checking the transcription...", fromServer: "transcribed", fromPhone: "heard by your phone", wrong: "Not quite what you said? Add a note", noteHint: "Briefly say what you actually meant. The recording is the record; this note goes to the school with it.", noteSend: "Send note", noteSaved: "Note saved. Thank you." },
  hi: { title: "वीडियो साक्षात्कार", hi: "नमस्ते", intro: "यह लगभग 15 मिनट का रिकॉर्डेड वीडियो साक्षात्कार है। माया आपसे सवाल बोलकर पूछेंगी। जवाब दें दबाएँ, कैमरे की ओर देखकर बोलें, फिर हो गया दबाएँ।", need: "इस साक्षात्कार के लिए कैमरा और माइक्रोफ़ोन चाहिए। कृपया कैमरे वाले फ़ोन या लैपटॉप पर लिंक खोलें और अनुमति दें।", cam: "कैमरा और माइक चालू करें", camOn: "कैमरा और माइक चालू हैं", start: "साक्षात्कार शुरू करें", answer: "जवाब दें", done: "हो गया, अगला सवाल", rec: "रिकॉर्डिंग", listen: "सुन रही हूँ", typeHint: "अगर आवाज़ पकड़ी नहीं जा रही हो तो यहाँ टाइप भी कर सकते हैं।", uploading: "आपका जवाब सहेजा जा रहा है...", finished: "धन्यवाद! आपका साक्षात्कार पूरा हुआ। स्कूल की टीम शीघ्र ही संपर्क करेगी।", honest: "कृपया अकेले, बिना किसी की मदद या इंटरनेट के जवाब दें। स्क्रीन से बाहर जाना या टेक्स्ट पेस्ट करना नोट किया जाता है, और वीडियो केवल स्कूल की भर्ती टीम देखती है और 90 दिनों में हट जाता है।", agree: "मैं समझता/समझती हूँ", repeat: "सवाल दोबारा", privacy: "अपना डेटा देखने या हटाने के लिए hr@healthyplanetschool.com पर लिखें।", retry: "कनेक्शन में समस्या। हो गया दोबारा दबाएँ।", interactive: "इस साक्षात्कार में एक छोटा रोल-प्ले भी होगा, जिसमें माया किसी और की भूमिका निभाएगी।", speaking: "माया बोल रही हैं...", earlier: "पिछले सवाल", yourAnswer: "आपका पिछला जवाब, जैसा लिखा गया", checking: "लिखावट की जाँच हो रही है...", fromServer: "ट्रांसक्राइब किया गया", fromPhone: "आपके फ़ोन ने सुना", wrong: "जो कहा वह ठीक नहीं लिखा? नोट जोड़ें", noteHint: "संक्षेप में बताएँ कि आपने क्या कहा था। रिकॉर्डिंग ही मुख्य रिकॉर्ड है; यह नोट उसके साथ स्कूल को जाता है।", noteSend: "नोट भेजें", noteSaved: "नोट सहेजा गया। धन्यवाद।" },
};

export default function CandidateInterview() {
  const { token } = useParams();
  const [info, setInfo] = useState(null); const [err, setErr] = useState(""); const [lang, setLang] = useState("en");
  const [transcript, setTr] = useState([]); const [ended, setEnded] = useState(false); const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | asking | answering | uploading
  const [draft, setDraft] = useState(""); const [seconds, setSeconds] = useState(0);
  const [camState, setCamState] = useState("off"); const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null); // { index, text, source, ready } for the most recent answer
  const [note, setNote] = useState(""); const [noteOpen, setNoteOpen] = useState(false); const [noteSaved, setNoteSaved] = useState(false);
  useEffect(() => {
    if (!last || last.ready) return;
    let tries = 0; const iv = setInterval(async () => { tries++; try { const r = await api(`/public/interview/${token}/transcript/${last.index}`, { auth: false }); if (r.ready || tries > 12) { clearInterval(iv); setLast((l) => (l && l.index === last.index ? { ...l, ...r, ready: true } : l)); } } catch { if (tries > 12) clearInterval(iv); } }, 2000);
    return () => clearInterval(iv);
  }, [last?.index, last?.ready]);
  const videoRef = useRef(null), streamRef = useRef(null), recRef = useRef(null), chunksRef = useRef([]), srRef = useRef(null), finalRef = useRef(""), timerRef = useRef(null), startedAtRef = useRef(0), phaseRef = useRef("idle");
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const t = STR[lang] || STR.en;
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const textMode = info?.mode === "text" || (info?.allow_text && camState === "denied");
  const signal = (type, detail = "") => api(`/public/interview/${token}/signal`, { method: "POST", body: { type, detail } }).catch(() => {});

  useEffect(() => { api(`/public/interview/${token}`, { auth: false }).then((i) => { setInfo(i); setTr(i.transcript); setLang(i.language); if (i.status === "completed") setEnded(true); }).catch((e) => setErr(e.message)); }, [token]);
  useEffect(() => { let id = localStorage.getItem("hph_dev"); if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("hph_dev", id); } api(`/public/interview/${token}/session`, { method: "POST", body: { id } }).catch(() => {}); }, [token]);

  const running = info?.status === "in_progress" && !ended;
  useEffect(() => {
    if (!running) return;
    const vis = () => document.hidden && signal("hidden"), blur = () => signal("blur"), paste = (e) => signal("paste", (e.clipboardData?.getData("text") || "").slice(0, 400)), copy = () => signal("copy");
    document.addEventListener("visibilitychange", vis); window.addEventListener("blur", blur); document.addEventListener("paste", paste); document.addEventListener("copy", copy);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("blur", blur); document.removeEventListener("paste", paste); document.removeEventListener("copy", copy); };
  }, [running]);

  async function startCamera() {
    try { const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true }); streamRef.current = st; setCamState("on"); signal("camera_ok"); }
    catch { setCamState("denied"); signal("camera_denied"); }
  }
  useEffect(() => { if (camState === "on" && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) videoRef.current.srcObject = streamRef.current; });
  useEffect(() => {
    if (!running || camState !== "on" || !("FaceDetector" in window)) return;
    const det = new window.FaceDetector({ maxDetectedFaces: 4, fastMode: true });
    const check = async () => { const v = videoRef.current; if (!v || !v.videoWidth) return; const cv = document.createElement("canvas"); cv.width = 320; cv.height = Math.round(320 * v.videoHeight / v.videoWidth); cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height); try { const f = await det.detect(cv); signal("faces", String(f.length)); } catch {} };
    const iv = setInterval(check, 60000); const t0 = setTimeout(check, 5000); return () => { clearInterval(iv); clearTimeout(t0); };
  }, [running, camState]);
  useEffect(() => { if (ended) { streamRef.current?.getTracks().forEach((x) => x.stop()); window.speechSynthesis?.cancel(); } }, [ended]);

  const speak = (text) => new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = BCP[lang] || "en-IN"; u.rate = 0.95;
    const voices = window.speechSynthesis.getVoices(); const v = voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang.startsWith(lang)); if (v) u.voice = v;
    let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
    u.onend = fin; u.onerror = fin; window.speechSynthesis.speak(u); setTimeout(fin, 8000 + text.length * 90);
  });
  const lastQ = [...transcript].reverse().find((m) => m.role === "assistant")?.content || "";
  useEffect(() => { if (running && lastQ && !ended && phaseRef.current === "idle") { setPhase("asking"); speak(lastQ).then(() => setPhase((p) => (p === "asking" ? "idle" : p))); } }, [lastQ, running]);

  async function start() {
    setBusy(true);
    try { const r = await api(`/public/interview/${token}/start`, { method: "POST", body: { language: lang } }); setTr(r.transcript); setInfo({ ...info, status: "in_progress" }); } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  function beginAnswer() {
    window.speechSynthesis?.cancel(); setPhase("answering"); setDraft(""); setErr(""); finalRef.current = ""; chunksRef.current = []; setSeconds(0); startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000)), 500);
    if (streamRef.current && window.MediaRecorder) {
      const mime = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      try { const rec = new MediaRecorder(streamRef.current, { mimeType: mime || undefined, videoBitsPerSecond: 400000, audioBitsPerSecond: 48000 }); rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data); rec.start(1000); recRef.current = rec; } catch { recRef.current = null; }
    }
    if (SR && !textMode) {
      const sr = new SR(); sr.lang = BCP[lang] || "en-IN"; sr.interimResults = true; sr.continuous = true; srRef.current = sr;
      sr.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalRef.current = (finalRef.current + " " + r[0].transcript).trim(); else interim += r[0].transcript; } setDraft((finalRef.current + " " + interim).trim()); };
      sr.onend = () => { if (phaseRef.current === "answering") { try { sr.start(); } catch {} } };
      sr.onerror = () => {}; try { sr.start(); } catch {}
    }
  }

  async function finishAnswer() {
    clearInterval(timerRef.current); setPhase("uploading");
    const answerIndex = transcript.filter((m) => m.role === "user").length;
    const text = (draft || finalRef.current || "").trim();
    try { srRef.current?.stop(); } catch {}
    let blob = null;
    if (recRef.current && recRef.current.state !== "inactive") { await new Promise((res) => { recRef.current.onstop = res; recRef.current.stop(); }); blob = new Blob(chunksRef.current, { type: recRef.current.mimeType || "video/webm" }); }
    const secs = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    try {
      if (blob && blob.size > 1000) await fetch(`/api/public/interview/${token}/clip/${answerIndex}?seconds=${secs}`, { method: "POST", headers: { "Content-Type": blob.type || "video/webm" }, body: blob });
      const spoken = text || (blob ? (lang === "hi" ? "(उत्तर वीडियो में रिकॉर्ड किया गया; बोले गए शब्द पकड़े नहीं गए)" : "(answer recorded on video; spoken words were not captured)") : "");
      if (!spoken) { setPhase("answering"); return; }
      const r = await api(`/public/interview/${token}/answer`, { method: "POST", body: { answer: spoken } });
      setDraft(""); if (r.ended) setEnded(true); setPhase("idle"); setTr(r.transcript);
      setNote(""); setNoteOpen(false); setNoteSaved(false);
      setLast({ index: answerIndex, text: spoken, source: "phone", ready: false });
    } catch (e) { setErr(t.retry); setPhase("answering"); }
  }

  if (err && !info) return <Center><div className="card" style={{ maxWidth: 380 }}><b>Healthy Planet School</b><p>{err}</p></div></Center>;
  if (!info) return <Center><span className="muted">Loading...</span></Center>;
  if (info.status === "expired") return <Center><div className="card" style={{ maxWidth: 380 }}><b>Healthy Planet School</b><p>This interview link has expired. Please reply to the school's message and we will send you a fresh one.</p></div></Center>;
  const answered = transcript.filter((m) => m.role === "user").length;
  const canStart = agreed && (textMode || camState === "on");
  const showCamera = !textMode && camState === "on" && !ended;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0F1512", color: "#fff" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--yellow)", color: "#000", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 13 }}>HP</span>
        <div><div style={{ fontWeight: 700 }}>Healthy Planet School · {t.title}</div><div style={{ fontSize: 12, opacity: .7 }}>{info.role} · {Math.min(answered, info.total)} / {info.total}</div></div>
        {phase === "answering" && <span style={{ marginLeft: "auto", color: "#E78076", fontWeight: 700, fontSize: 13 }}>● {t.rec} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>}
      </div>
      <div style={{ height: 4, background: "#2A332E" }}><div style={{ height: 4, width: `${Math.min(100, (answered / info.total) * 100)}%`, background: "var(--yellow)", transition: "width .3s" }} /></div>

      {showCamera && (
        <div style={{ position: "relative", background: "#000", maxWidth: 720, width: "100%", margin: "0 auto" }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", maxHeight: "46vh", objectFit: "cover", transform: "scaleX(-1)", display: "block" }} />
          <div style={{ position: "absolute", left: 12, bottom: 12, display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "6px 12px", fontSize: 13 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--green)", display: "grid", placeItems: "center", fontWeight: 700 }}>M</span>
            <span>{phase === "asking" ? t.speaking : phase === "answering" ? (SR ? t.listen : t.rec) : "Maya"}</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, padding: 16, maxWidth: 720, width: "100%", margin: "0 auto" }}>
        {transcript.length === 0 && !ended && (
          <div className="card" style={{ background: "#fff", color: "var(--ink)" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{t.hi}, {info.candidate}</div>
            <p className="muted" style={{ lineHeight: 1.5 }}>{t.intro}</p>
            {info.interactive && <p className="muted" style={{ fontSize: 13 }}>{t.interactive}</p>}
            <div className="row" style={{ marginBottom: 12, gap: 6 }}>{Object.entries(info.languages || { en: "English", hi: "हिन्दी" }).map(([k, l]) => <button key={k} className={`small ${lang === k ? "primary" : ""}`} onClick={() => setLang(k)}>{l}</button>)}</div>
            {!textMode && <div style={{ background: "var(--soft)", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
              {camState === "denied" ? <span style={{ color: "#B0463C" }}>{t.need}</span> : t.honest}
              <div className="row" style={{ marginTop: 10 }}>
                {camState !== "on" && <button className="warm" onClick={startCamera}>{t.cam}</button>}
                {camState === "on" && <span style={{ color: "var(--green)", fontWeight: 500 }}>● {t.camOn}</span>}
              </div>
            </div>}
            <label style={{ fontSize: 13, display: "block", marginBottom: 12 }}><input type="checkbox" style={{ width: "auto" }} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> {t.agree}</label>
            <button className="primary" disabled={busy || !canStart} onClick={start} style={{ width: "100%" }}>{busy ? "..." : t.start}</button>
            <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{t.privacy}</div>
          </div>
        )}

        {running && lastQ && (
          <div className="card" style={{ background: "#fff", color: "var(--ink)" }}>
            <div className="muted" style={{ fontSize: 12 }}>Maya</div>
            <div style={{ fontSize: 17, lineHeight: 1.45, margin: "4px 0 12px" }}>{lastQ}</div>
            {(phase === "idle" || phase === "asking") && <div className="row"><button className="primary" onClick={beginAnswer} style={{ flex: 1, padding: 12, fontSize: 15 }}>{t.answer}</button>{phase === "idle" && <button onClick={() => { setPhase("asking"); speak(lastQ).then(() => setPhase((p) => (p === "asking" ? "idle" : p))); }}>{t.repeat}</button>}</div>}
            {phase === "answering" && <>
              {SR && !textMode ? <div style={{ minHeight: 60, fontSize: 14, color: draft ? "var(--ink)" : "var(--mute)", background: "var(--soft)", borderRadius: 8, padding: 10 }}>{draft || `${t.listen}...`}</div>
                : <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.typeHint} style={{ minHeight: 90 }} />}
              {SR && !textMode && <details style={{ fontSize: 12, marginTop: 6 }}><summary className="muted">{t.typeHint}</summary><textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 70, marginTop: 6 }} /></details>}
              <button className="warm" onClick={finishAnswer} style={{ width: "100%", padding: 12, fontSize: 15, marginTop: 10 }} disabled={seconds < 2 && !draft}>{t.done}</button>
            </>}
            {phase === "uploading" && <div className="muted">{t.uploading}</div>}
            {err && <div style={{ color: "#B0463C", fontSize: 13, marginTop: 8 }}>{err}</div>}
          </div>
        )}

        {last && (
          <div className="card" style={{ background: "#fff", color: "var(--ink)", marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 13 }}>{t.yourAnswer}</b><span className="muted" style={{ fontSize: 11 }}>{!last.ready ? t.checking : last.source === "server" ? `✓ ${t.fromServer}${last.confidence != null ? ` · ${Math.round(last.confidence * 100)}%` : ""}` : t.fromPhone}</span></div>
            <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 6, opacity: last.ready ? 1 : .7 }}>{last.text}</div>
            {last.ready && !noteSaved && !noteOpen && <button className="link" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setNoteOpen(true)}>{t.wrong}</button>}
            {noteOpen && !noteSaved && <div style={{ marginTop: 8 }}><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t.noteHint}</div><textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 600))} style={{ minHeight: 60 }} /><button className="small" disabled={!note.trim()} style={{ marginTop: 6 }} onClick={async () => { try { await api(`/public/interview/${token}/transcript/${last.index}/note`, { method: "POST", body: { note }, auth: false }); setNoteSaved(true); } catch (e) { setErr(e.message); } }}>{t.noteSend}</button></div>}
            {noteSaved && <div style={{ fontSize: 12, color: "var(--green)", marginTop: 6 }}>{t.noteSaved}</div>}
          </div>
        )}
        {ended && <div className="card" style={{ background: "#fff", color: "var(--ink)", borderColor: "var(--green)", marginTop: 12 }}>{t.finished}</div>}
        {transcript.length > 2 && <details style={{ marginTop: 12, fontSize: 13, opacity: .8 }}><summary>{t.earlier}</summary>{transcript.slice(0, -1).map((m, i) => <p key={i} style={{ margin: "6px 0" }}><b>{m.role === "assistant" ? "Maya" : info.candidate}:</b> {m.content}</p>)}</details>}
      </div>
    </div>
  );
}
const Center = ({ children }) => <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>{children}</div>;
