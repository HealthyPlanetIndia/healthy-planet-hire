import React from "react";
export const Field = ({ label, children }) => <label className="field">{label}{children}</label>;
export const Score = ({ v }) => <span className="score" style={{ color: v >= 75 ? "var(--green)" : v >= 55 ? "#C9A227" : "var(--coral)" }}>{v}</span>;
export const VERDICT = { meets: { bg: "#E6F1EA", fg: "var(--green)", label: "Meets" }, partial: { bg: "#FDF3D6", fg: "#8A6A10", label: "Partly" }, "does not meet": { bg: "#FBE5E2", fg: "#B0463C", label: "Not shown" } };
export const Pill = ({ v }) => { const s = VERDICT[v] || VERDICT.partial; return <span className="pill" style={{ background: s.bg, color: s.fg }}>{s.label}</span>; };
