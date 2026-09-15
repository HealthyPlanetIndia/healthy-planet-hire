import React, { useEffect, useRef, useState } from "react";
import { COUNTRIES, FIXED_LENGTH } from "../data/countries.js";
export const Field = ({ label, children }) => <label className="field">{label}{children}</label>;
export const Score = ({ v }) => <span className="score" style={{ color: v >= 75 ? "var(--green)" : v >= 55 ? "#C9A227" : "var(--coral)" }}>{v}</span>;
export const VERDICT = { meets: { bg: "#E6F1EA", fg: "var(--green)", label: "Meets" }, partial: { bg: "#FDF3D6", fg: "#8A6A10", label: "Partly" }, "does not meet": { bg: "#FBE5E2", fg: "#B0463C", label: "Not shown" }, demonstrated: { bg: "#E6F1EA", fg: "var(--green)", label: "Demonstrated" }, weakness: { bg: "#FBE5E2", fg: "#B0463C", label: "Weakness shown" }, not_assessed: { bg: "#F1F3EE", fg: "var(--mute)", label: "Not assessed" } };
export const Pill = ({ v }) => { const s = VERDICT[v] || VERDICT.partial; return <span className="pill" style={{ background: s.bg, color: s.fg }}>{s.label}</span>; };

// A scroll strip that is always visible, because Macs and phones hide native scrollbars.
// Pass the ref of the horizontally scrolling element.
export function ScrollStrip({ targetRef }) {
  const [st, setSt] = useState({ w: 1, sw: 1, left: 0 }); const drag = useRef(null);
  useEffect(() => {
    const el = targetRef.current; if (!el) return;
    const upd = () => setSt({ w: el.clientWidth, sw: el.scrollWidth, left: el.scrollLeft });
    upd(); el.addEventListener("scroll", upd); const ro = new ResizeObserver(upd); ro.observe(el); const iv = setInterval(upd, 1000);
    return () => { el.removeEventListener("scroll", upd); ro.disconnect(); clearInterval(iv); };
  }, [targetRef]);
  const frac = st.w / st.sw, thumbW = Math.max(40, frac * 100), maxLeft = 100 - thumbW, pos = st.sw > st.w ? (st.left / (st.sw - st.w)) * maxLeft : 0;
  const scrollBy = (dx) => targetRef.current.scrollBy({ left: dx, behavior: "smooth" });
  const onDown = (e) => { drag.current = { x: e.clientX ?? e.touches?.[0].clientX, left: targetRef.current.scrollLeft, trackW: e.currentTarget.parentElement.clientWidth }; e.preventDefault(); };
  const onMove = (e) => { if (!drag.current) return; const x = e.clientX ?? e.touches?.[0].clientX; const dx = (x - drag.current.x) / (drag.current.trackW * (maxLeft / 100)) * (st.sw - st.w); targetRef.current.scrollLeft = drag.current.left + dx; };
  const onUp = () => { drag.current = null; };
  useEffect(() => { window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); window.addEventListener("touchmove", onMove); window.addEventListener("touchend", onUp); return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); }; });
  if (st.sw <= st.w + 2) return null;
  return <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
    <button className="small" onClick={() => scrollBy(-st.w * 0.8)} aria-label="Scroll left" style={{ padding: "2px 8px" }}>‹</button>
    <div style={{ flex: 1, height: 14, background: "var(--soft)", borderRadius: 7, position: "relative", cursor: "pointer" }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); targetRef.current.scrollLeft = ((e.clientX - r.left) / r.width) * (st.sw - st.w) - st.w / 2; }}>
      <div onMouseDown={onDown} onTouchStart={onDown} style={{ position: "absolute", top: 2, height: 10, left: `${pos}%`, width: `${thumbW}%`, background: "#7F8C84", borderRadius: 5, cursor: "grab" }} />
    </div>
    <button className="small" onClick={() => scrollBy(st.w * 0.8)} aria-label="Scroll right" style={{ padding: "2px 8px" }}>›</button>
    <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{Math.round((st.left + st.w) / st.sw * 100)}% across</span>
  </div>;
}

// Phone input: dial code dropdown (all UN member states, India first) plus the local mobile number.
// Value in/out is "+91 9810012345". The dropdown shows the country name so the same code (+1, +7) is unambiguous.
const CODE_SET = [...new Set(COUNTRIES.map((c) => c[0]))].sort((a, b) => b.length - a.length); // longest first for matching
export function splitPhone(v) { const s = String(v || "").trim(); if (s.startsWith("+")) { const d = "+" + s.replace(/\D/g, ""); for (const code of CODE_SET) if (d.startsWith(code)) return { code, num: d.slice(code.length) }; } const d = s.replace(/\D/g, ""); return { code: "+91", num: d.length > 10 && d.startsWith("91") ? d.slice(2) : d.replace(/^0+/, "") }; }
export function PhoneInput({ value, onChange, onBlur, disabled, placeholder }) {
  const { code, num } = splitPhone(value);
  const [iso, setIso] = useState(() => (COUNTRIES.find((c) => c[0] === code) || COUNTRIES[0])[2]);
  const country = COUNTRIES.find((c) => c[2] === iso && c[0] === code) || COUNTRIES.find((c) => c[0] === code) || COUNTRIES[0];
  const fixed = FIXED_LENGTH[code]; const max = fixed || 12;
  const set = (c, n) => onChange(n ? `${c} ${n}` : "");
  const bad = num && (fixed ? num.length !== fixed : num.length < 6);
  return <div>
    <div style={{ display: "flex", gap: 6 }}>
      <select value={country[2]} disabled={disabled} onChange={(e) => { const c = COUNTRIES.find((x) => x[2] === e.target.value); setIso(c[2]); set(c[0], num); }} style={{ width: "auto", maxWidth: 170 }} aria-label="Country">{COUNTRIES.map((c) => <option key={c[2]} value={c[2]}>{c[1]} ({c[0]})</option>)}</select>
      <input type="tel" inputMode="numeric" disabled={disabled} value={num} placeholder={placeholder || (fixed ? `${fixed}-digit mobile number` : "mobile number")} maxLength={max} onChange={(e) => set(code, e.target.value.replace(/\D/g, "").slice(0, max))} onBlur={onBlur} style={{ flex: 1, borderColor: bad ? "#E78076" : undefined }} aria-label="Mobile number" />
    </div>
    {bad && <div style={{ fontSize: 11, color: "#B0463C", marginTop: 3 }}>{fixed ? `Enter a ${fixed}-digit number for ${country[1]}.` : `Enter at least 6 digits.`}</div>}
  </div>;
}
export const phoneValid = (v) => { const { code, num } = splitPhone(v); const fixed = FIXED_LENGTH[code]; return !num || (fixed ? num.length === fixed : num.length >= 6 && num.length <= 12); };
