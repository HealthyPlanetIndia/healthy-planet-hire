import React, { useEffect, useState, createContext, useContext } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { api, me, signOut, isManager, isAdmin, t, lang, setLang } from "../api.js";

export const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

// Line icons, 18px, drawn to match each other in weight
const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>,
  pipeline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/></svg>,
  roles: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>,
  follow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>,
  pool: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="10" r="2.5"/><path d="M15.5 19a4.5 4.5 0 0 1 5-4"/></svg>,
  analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16"/><path d="M6 16V9"/><path d="M11 16V5"/><path d="M16 16v-6"/></svg>,
  automation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3 5 13h6l-1 8 9-11h-6z"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  setup: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="8.5"/></svg>,
  more: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
};

const TITLES = { "/": "Home", "/pipeline": "Pipeline", "/roles": "Roles", "/followups": "Follow-ups", "/pool": "Talent pool", "/analytics": "Analytics", "/automation": "Automation", "/settings": "Settings", "/setup": "Setup" };

export default function Shell() {
  const [toast, setToast] = useState("");
  const [overdue, setOverdue] = useState(0); const [inbox, setInbox] = useState(0);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };
  useEffect(() => { if (!isManager()) { api("/followups").then((l) => setOverdue(l.length)).catch(() => {}); api("/inbox").then((l) => setInbox(l.length)).catch(() => {}); } }, [loc.pathname]);
  useEffect(() => { setMore(false); }, [loc.pathname]);

  const items = [
    !isManager() && { to: "/", label: t("Home"), icon: I.home, end: true },
    { to: "/pipeline", label: t("Pipeline"), icon: I.pipeline },
    { to: "/roles", label: t("Roles"), icon: I.roles },
    !isManager() && { to: "/followups", label: t("Follow-ups"), icon: I.follow, count: overdue },
    !isManager() && { to: "/pool", label: t("Talent pool"), icon: I.pool },
    !isManager() && { to: "/analytics", label: t("Analytics"), icon: I.analytics },
    !isManager() && { to: "/automation", label: t("Automation"), icon: I.automation, count: inbox },
    { to: "/settings", label: t("Settings"), icon: I.settings },
    isAdmin() && { to: "/setup", label: "Setup", icon: I.setup },
  ].filter(Boolean);
  const title = TITLES[loc.pathname] || "";
  const primary = items.slice(0, 4), rest = items.slice(4);

  return (
    <ToastCtx.Provider value={say}>
      <div className="frame">
        <aside className="rail">
          <div className="brand"><span className="mark">HP</span><div><div className="name">Healthy Planet<br />Recruitment</div><div className="ver">v{__APP_VERSION__}</div></div></div>
          {items.map((it) => <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav ${isActive ? "active" : ""}`}>{it.icon}<span>{it.label}</span>{it.count > 0 && <span className="count">{it.count}</span>}</NavLink>)}
          <div className="foot"><span>{me()?.name?.split(" ")[0]}</span><button className="small" onClick={() => setLang(lang() === "hi" ? "en" : "hi")}>{lang() === "hi" ? "EN" : "हिं"}</button><button className="small" onClick={signOut}>{t("Sign out")}</button></div>
        </aside>
        <div className="content">
          {title && <div className="pagehead"><h1>{title}</h1></div>}
          <main><Outlet /></main>
        </div>
      </div>
      <nav className="tabbar">
        {primary.map((it) => <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? "active" : "")}>{it.icon}<span>{it.label}</span>{it.count > 0 && <span className="count">{it.count}</span>}</NavLink>)}
        {rest.length > 0 && <a href="#" onClick={(e) => { e.preventDefault(); setMore(!more); }} className={rest.some((r) => loc.pathname === r.to) ? "active" : ""}>{I.more}<span>More</span></a>}
      </nav>
      {more && <div className="drawer-bg" onClick={() => setMore(false)} style={{ alignItems: "flex-end", justifyContent: "center" }}><div className="card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: "22px 22px 0 0", padding: "10px 12px calc(84px + env(safe-area-inset-bottom))" }}>
        {rest.map((it) => <NavLink key={it.to} to={it.to} className="nav" style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 10px", textDecoration: "none", color: "var(--ink)", fontSize: 16, borderBottom: "1px solid var(--hair)" }}><span style={{ width: 22, color: "var(--mute)" }}>{it.icon}</span>{it.label}{it.count > 0 && <span className="pill" style={{ marginLeft: "auto", background: "var(--coral)", color: "#fff" }}>{it.count}</span>}</NavLink>)}
        <div className="row" style={{ padding: "12px 10px 0" }}><button className="small" onClick={() => setLang(lang() === "hi" ? "en" : "hi")}>{lang() === "hi" ? "English" : "हिन्दी"}</button><button className="small" onClick={signOut}>{t("Sign out")}, {me()?.name?.split(" ")[0]}</button></div>
      </div></div>}
      {toast && <div className="toast">{toast}</div>}
    </ToastCtx.Provider>
  );
}
