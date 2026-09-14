import React, { useEffect, useRef, useState } from "react";
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
