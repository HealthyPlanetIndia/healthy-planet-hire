import React, { useEffect, useState } from "react";
import { api, daysSince, BOARD, isManager, t } from "../api.js";
import { useSearchParams } from "react-router-dom";
import { Field, Score } from "../components/ui.jsx";
import CandidatePanel from "../components/CandidatePanel.jsx";
import { useToast } from "../components/Shell.jsx";

export default function Pipeline() {
  const say = useToast();
  const [roles, setRoles] = useState([]); const [cands, setCands] = useState([]);
  const [params, setParams] = useSearchParams();
  const [roleFilter, setRoleFilterState] = useState(params.get("role") || ""); const [openId, setOpenId] = useState(null);
  const setRoleFilter = (v) => { setRoleFilterState(v); setParams(v ? { role: v } : {}); };
  const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", role_id: "", source: "Job portal", resume_text: "" }); const [file, setFile] = useState(null);
  const [bulk, setBulk] = useState(false); const [bulkFiles, setBulkFiles] = useState([]);
  const [campus, setCampus] = useState(""); const [queue, setQueue] = useState(null);
  useEffect(() => { if (!queue || (queue.pending === 0 && queue.active === 0)) return; const iv = setInterval(async () => { const q = await api("/candidates/queue"); setQueue(q); if (q.pending === 0 && q.active === 0) { clearInterval(iv); load(); say(`Screening finished: ${q.done} done${q.failed ? `, ${q.failed} failed` : ""}`); } else load(); }, 2500); return () => clearInterval(iv); }, [queue?.pending, queue?.active]);
  const campuses = [...new Set(roles.map((r) => r.campus).filter(Boolean))];
  async function importBulk() { setBusy(true); try { const fd = new FormData(); fd.append("role_id", f.role_id); for (const x of bulkFiles) fd.append("files", x); const r = await api("/candidates/bulk", { method: "POST", form: fd }); say(`Imported ${r.created}${r.duplicates ? `, ${r.duplicates} possible duplicates` : ""}${r.failed.length ? `, ${r.failed.length} failed` : ""}`); if (r.failed.length) console.warn(r.failed); setBulk(false); setBulkFiles([]); load(); } catch (e) { say(e.message); } setBusy(false); }

  const load = () => api(`/candidates${roleFilter ? `?role_id=${roleFilter}` : ""}`).then(setCands);
  useEffect(() => { api("/roles").then((r) => { setRoles(r); if (!f.role_id && r[0]) setF((x) => ({ ...x, role_id: r[0].id })); }); }, []);
  useEffect(() => { load(); }, [roleFilter]);

  async function add() {
    setBusy(true);
    try { const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append("resume", file);
      const c = await api("/candidates", { method: "POST", form: fd }); setAdding(false); setFile(null); setF({ ...f, name: "", phone: "", email: "", resume_text: "" }); await load(); setOpenId(c.id); say(`Added ${c.name}`); } catch (e) { say(e.message); }
    setBusy(false);
  }
  async function screenAll() { try { const r = await api("/candidates/screen-all", { method: "POST", body: { role_id: roleFilter || undefined } }); say(`${r.queued} queued for screening; carry on, I'll update the board as they finish`); setQueue(r); load(); } catch (e) { say(e.message); } }
  const shown = campus ? cands.filter((c) => roles.find((r) => r.id === c.role_id)?.campus === campus) : cands;
  const unscreened = shown.filter((c) => c.stage === "Applied" && c.resume_text && !c.screening && !c.queued).length;

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: "auto" }}><option value="">All roles</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
        {campuses.length > 1 && <select value={campus} onChange={(e) => setCampus(e.target.value)} style={{ width: "auto" }}><option value="">All campuses</option>{campuses.map((c) => <option key={c}>{c}</option>)}</select>}
        <span className="muted">{shown.length} {t("candidates")}</span>
        {queue && (queue.pending > 0 || queue.active > 0) && <span className="pill" style={{ background: "#EAF1FB", color: "var(--blue)" }}>Screening {queue.active} now, {queue.pending} waiting, {queue.done} done</span>}
        {!isManager() && <div className="row" style={{ marginLeft: "auto" }}>
          {unscreened > 0 && <button disabled={busy} onClick={screenAll}>{busy ? "Screening..." : `Screen ${unscreened} new`}</button>}
          <button onClick={() => setBulk(true)}>{t("Bulk import")}</button>
          <button className="primary" onClick={() => setAdding(true)}>{t("Add candidate")}</button>
        </div>}
      </div>
      {bulk && <div className="card" style={{ marginBottom: 12, borderColor: "var(--blue)" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Bulk import</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Drop many CVs at once (PDF or Word; the name is read from each file) or a CSV with columns name, phone, email, resume_text. All go into the role selected below as Applied, ready for "Screen new".</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: "0 12px" }}>
          <Field label="Role"><select value={f.role_id} onChange={(e) => setF({ ...f, role_id: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></Field>
          <Field label={`Files${bulkFiles.length ? ` (${bulkFiles.length} selected)` : ""}`}><input type="file" multiple accept=".pdf,.docx,.txt,.csv" onChange={(e) => setBulkFiles([...e.target.files])} /></Field>
        </div>
        <div className="row"><button className="primary" disabled={busy || !bulkFiles.length || !f.role_id} onClick={importBulk}>{busy ? "Importing..." : `Import ${bulkFiles.length} file${bulkFiles.length === 1 ? "" : "s"}`}</button><button onClick={() => setBulk(false)}>Cancel</button></div>
      </div>}
      {adding && (
        <div className="card" style={{ marginBottom: 12, borderColor: "var(--green)" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>New candidate</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 12px" }}>
            <Field label="Full name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="WhatsApp number"><input placeholder="+91 ..." value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Email"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Applying for"><select value={f.role_id} onChange={(e) => setF({ ...f, role_id: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></Field>
            <Field label="Source"><select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{["Job portal", "Referral", "Walk-in", "LinkedIn", "ARISE network", "Sourced", "Careers page"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Resume file (PDF or Word)"><input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files[0])} /></Field>
          </div>
          <Field label="Or paste the resume text"><textarea value={f.resume_text} onChange={(e) => setF({ ...f, resume_text: e.target.value })} /></Field>
          <div className="row"><button className="primary" disabled={busy || !f.name.trim()} onClick={add}>{busy ? "Adding..." : "Add to pipeline"}</button><button onClick={() => setAdding(false)}>Cancel</button></div>
        </div>
      )}
      <div className="board">
        {BOARD.map((stage) => { const list = shown.filter((c) => c.stage === stage); return (
          <div key={stage} className="col">
            <h4><span>{t(stage)}</span><span className="muted" style={{ fontWeight: 400 }}>{list.length}</span></h4>
            <div className="stack">
              {list.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 10, textAlign: "center" }}>Nothing here yet</div>}
              {list.map((c) => { const d = daysSince(c.stage_at), stale = d >= 3 && stage !== "Joined"; return (
                <div key={c.id} className={`cand ${stale ? "stale" : ""}`} role="button" tabIndex={0} onClick={() => setOpenId(c.id)} onKeyDown={(e) => e.key === "Enter" && setOpenId(c.id)}>
                  <div className="row" style={{ justifyContent: "space-between" }}><span style={{ fontWeight: 500 }}>{c.name}</span>{c.screening && <Score v={c.screening.overall} />}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{c.role_title || "No role"}</div>
                  {["high", "medium-high"].includes(c.integrity_risk) && <div style={{ fontSize: 11, color: "#B0463C", fontWeight: 500, marginTop: 4 }}>⚑ Possible outside help, review</div>}
                  {c.blockers > 0 && <div style={{ fontSize: 11, color: "#8A6A10", marginTop: 4 }}>{c.blockers} check{c.blockers > 1 ? "s" : ""} before offer</div>}
                  {c.interview_at && new Date(c.interview_at) > new Date() && <div style={{ fontSize: 11, color: "var(--blue)", marginTop: 4 }}>Booked {new Date(c.interview_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>}
                  <div className="muted" style={{ fontSize: 11, marginTop: 6, color: stale ? "var(--coral)" : undefined }}>{c.queued ? "Screening..." : stale ? `Waiting ${d} days` : `${d}d in stage`}</div>
                  {c.needs_human === 1 && <div style={{ fontSize: 11, color: "var(--coral)", marginTop: 4 }}>Replied, needs a person</div>}
                </div>); })}
            </div>
          </div>); })}
      </div>
      {openId && <CandidatePanel id={openId} roles={roles} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
