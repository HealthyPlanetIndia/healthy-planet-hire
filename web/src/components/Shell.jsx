import React, { useEffect, useState, createContext, useContext } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { api, me, signOut, isManager, isAdmin, t, lang, setLang } from "../api.js";

export const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export default function Shell() {
  const [toast, setToast] = useState("");
  const [overdue, setOverdue] = useState(0); const [inbox, setInbox] = useState(0);
  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };
  useEffect(() => { if (!isManager()) { api("/followups").then((l) => setOverdue(l.length)).catch(() => {}); api("/inbox").then((l) => setInbox(l.length)).catch(() => {}); } }, []);
  return (
    <ToastCtx.Provider value={say}>
      <header className="top">
        <div className="row"><span className="logo">HP</span><div><div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.1 }}>Healthy Planet Recruitment</div><div style={{ fontSize: 12, opacity: .85 }}>Recruiting that doesn't depend on heroics · v{__APP_VERSION__}</div></div></div>
        <nav>
          {!isManager() && <NavLink to="/" end>{t("Home")}</NavLink>}
          <NavLink to="/pipeline">{t("Pipeline")}</NavLink>
          <NavLink to="/roles">{t("Roles")}</NavLink>
          {!isManager() && <NavLink to="/followups">{t("Follow-ups")}{overdue ? ` (${overdue})` : ""}</NavLink>}
          {!isManager() && <NavLink to="/pool">{t("Talent pool")}</NavLink>}
          {!isManager() && <NavLink to="/analytics">{t("Analytics")}</NavLink>}
          {!isManager() && <NavLink to="/automation">{t("Automation")}{inbox ? ` (${inbox})` : ""}</NavLink>}
          <NavLink to="/settings">{t("Settings")}</NavLink>
          {isAdmin() && <NavLink to="/setup">Setup</NavLink>}
          <button className="small" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={() => setLang(lang() === "hi" ? "en" : "hi")}>{lang() === "hi" ? "EN" : "हिं"}</button>
          <button className="small" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={signOut}>{t("Sign out")}, {me()?.name?.split(" ")[0]}</button>
        </nav>
      </header>
      <main><Outlet /></main>
      {toast && <div className="toast">{toast}</div>}
    </ToastCtx.Provider>
  );
}
