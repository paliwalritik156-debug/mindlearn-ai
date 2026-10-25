import { reportError } from "./telemetry.js"
import { SettingsExtras } from "./v28.jsx"
import { createPortal } from "react-dom"
import { Component, useEffect, useRef, useState } from "react"
import {
  api, setAuthToken, sounds, isSoundOn, setSoundOn, useLocalState, useDark, Spin, Skeleton, toast, uploadPdfs, downloadFile, esc,
  LANGS, THEMES, syncInfo, syncPull, readSyncData, SYNC_KEYS, FUN_META,
} from "./lib.jsx"
import { listLibrary, getLibraryFile, removeFromLibrary, clearLibrary, savePdfs, pdfNames } from "./pdfstore.js"

const notify = k => window.dispatchEvent(new CustomEvent("ml-ls", { detail: k }))
function fmtSize(b){ return b > 1048576 ? (b/1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b/1024)) + " KB" }
function ago(ts){
  if(!ts) return "earlier"
  const m = Math.floor((Date.now()-ts)/60000)
  if(m < 1) return "just now"; if(m < 60) return m + " min ago"
  const h = Math.floor(m/60); if(h < 24) return h + " h ago"
  return Math.floor(h/24) + " d ago"
}

/* ---------- Error boundary ---------- */
export class ErrorBoundary extends Component {
  constructor(p){ super(p); this.state = { err: null } }
  static getDerivedStateFromError(err){ return { err } }
  componentDidCatch(err){ try{ console.error(err); reportError(err, "ErrorBoundary") }catch(e){} }
  componentDidUpdate(prev){ if(this.state.err && prev.resetKey !== this.props.resetKey) this.setState({ err:null }) }
  render(){
    if(!this.state.err) return this.props.children
    return (
      <div className="card err-card" role="alert">
        <div className="empty-icon">🛠️</div>
        <h3>Something went wrong here</h3>
        <p className="profile-email">This section crashed. Your data is safe. Try again, or go back to the overview.</p>
        <div className="row-actions">
          <button className="btn btn-p btn-sm" onClick={()=>this.setState({ err:null })}>Try again</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{ this.setState({ err:null }); window.dispatchEvent(new CustomEvent("ml-goto", { detail:"Home" })) }}>Go to overview</button>
        </div>
      </div>
    )
  }
}

export function ErrBox({ msg, onRetry }){
  if(!msg) return null
  return (
    <div className="err-box" role="alert">
      <span>⚠️</span><p>{msg}</p>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}

/* ---------- Toasts + offline banner ---------- */
export function ToastHost(){
  const [items, setItems] = useState([])
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine)
  useEffect(()=>{
    let id = 0
    const f = e=>{
      const t = { id: ++id, ...e.detail }
      setItems(a=>[...a.filter(x=>x.msg !== t.msg), t].slice(-3))
      if(t.kind === "error") sounds.error()
      setTimeout(()=>setItems(a=>a.filter(x=>x.id !== t.id)), t.kind === "error" ? 6000 : 3500)
    }
    const on = ()=>setOnline(true), off = ()=>setOnline(false)
    window.addEventListener("ml-toast", f); window.addEventListener("online", on); window.addEventListener("offline", off)
    return ()=>{ window.removeEventListener("ml-toast", f); window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  },[])
  return (
    <>
      {!online && <div className="net-banner" role="status">You're offline. Some features need an internet connection.</div>}
      <div className="toast-host" aria-live="polite">
        {items.map(t=>(
          <div key={t.id} className={"toast " + (t.kind || "info")} role={t.kind === "error" ? "alert" : "status"}>
            <span>{t.kind === "error" ? "⚠️" : t.kind === "ok" ? "✅" : "ℹ️"}</span>
            <span className="toast-msg">{t.msg}</span>
            <button aria-label="Dismiss" onClick={()=>setItems(a=>a.filter(x=>x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </>
  )
}

/* ---------- Upload progress strip ---------- */
export function UploadStrip({ pct }){
  if(pct == null) return null
  return (
    <div className="up-strip" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="up-strip-bar"><div style={{ width: pct + "%" }} /></div>
      <span>{pct < 100 ? `Uploading… ${pct}%` : "Processing your PDF…"}</span>
    </div>
  )
}

/* ---------- Legal modal ---------- */
export function LegalModal({ kind, onClose }){
  useEffect(()=>{
    const f = e=>{ if(e.key === "Escape") onClose() }
    window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f)
  },[])
  const privacy = kind === "privacy"
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal legal" role="dialog" aria-modal="true" aria-label={privacy ? "Privacy Policy" : "Terms of Use"} onClick={e=>e.stopPropagation()}>
        <button className="modal-x" aria-label="Close" onClick={onClose}>×</button>
        <h3>{privacy ? "Privacy Policy" : "Terms of Use"}</h3>
        <p className="legal-note">Starter text. Have it reviewed before you rely on it for a public launch.</p>
        {privacy ? (
          <div className="legal-body">
            <h4>What we handle</h4>
            <p>Your account details (name, email and a hashed password), the PDFs you upload, and the questions you ask.</p>
            <h4>How PDFs are used</h4>
            <p>Uploaded PDFs are processed by our server to extract text. Parts of that text and your questions are sent to a third-party AI provider (Groq) to generate answers. Do not upload documents you are not allowed to share.</p>
            <h4>What stays on your device</h4>
            <p>Your progress, scores, flashcards, settings and a copy of your PDFs for page highlighting are stored in your browser. Clearing browser data removes them. You can export a backup from Settings.</p>
            <h4>Your choices</h4>
            <p>You can delete local data and stored PDFs at any time from Settings and the Library. To remove your account and server-side data, contact the site owner.</p>
          </div>
        ) : (
          <div className="legal-body">
            <h4>Using the service</h4>
            <p>MindLearn AI is a study aid. Answers are generated by AI and can be wrong or incomplete. Verify important facts against your source material.</p>
            <h4>Your content</h4>
            <p>You keep ownership of what you upload. You confirm you have the right to upload it and that it does not break the law or anyone's rights.</p>
            <h4>Acceptable use</h4>
            <p>Do not abuse, overload, or attempt to break the service, and do not use it to produce harmful content.</p>
            <h4>No warranty</h4>
            <p>The service is provided as is, without guarantees of availability or accuracy.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/* ---------- Document library ---------- */
export function LibraryTab(){
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState("")
  const [pct, setPct] = useState(null)
  const [doc] = useLocalState("ml_doc", null)
  const [, setDoc] = useLocalState("ml_doc", null)
  const ref = useRef()
  const active = pdfNames()

  async function refresh(){ try{ setItems(await listLibrary()) }catch(e){ setItems([]) } }
  useEffect(()=>{ refresh() },[])

  async function use(name){
    setBusy(name)
    try{
      const f = await getLibraryFile(name)
      await uploadPdfs([f])
      await savePdfs([f])
      localStorage.setItem("ml_doc", JSON.stringify(name)); notify("ml_doc"); setDoc(name)
      toast(`"${name}" is now your active document.`, "ok"); sounds.success()
      refresh()
    }catch(e){ toast(e?.message || "Couldn't activate this document.", "error") }
    finally{ setBusy("") }
  }
  async function del(name){
    if(!window.confirm(`Remove "${name}" from this browser?`)) return
    await removeFromLibrary(name); refresh()
    toast("Removed from your library.", "ok")
  }
  async function add(files){
    if(!files || !files.length) return
    setBusy("__add"); setPct(0)
    try{
      await uploadPdfs(files, setPct)
      await savePdfs(files)
      const names = Array.from(files).map(f=>f.name)
      const label = names.length > 1 ? names[0] + " +" + (names.length-1) : names[0]
      localStorage.setItem("ml_doc", JSON.stringify(label)); notify("ml_doc"); setDoc(label)
      toast("Uploaded. Your tools now use it.", "ok"); sounds.success(); refresh()
    }catch(e){ toast(e?.response?.data?.detail || e?.message || "Upload failed.", "error") }
    finally{ setBusy(""); setPct(null) }
  }
  return (
    <div className="card">
      <div className="lib-head">
        <div>
          <b>{items ? items.length : "…"} document{items && items.length === 1 ? "" : "s"}</b>
          <p className="profile-email" style={{margin:"4px 0 0"}}>Stored in this browser. The active one is what Chat, Notes and Quiz use.</p>
        </div>
        <button className="btn btn-p btn-sm" disabled={busy==="__add"} onClick={()=>ref.current?.click()}>{busy==="__add" ? <Spin/> : "+ Add PDF"}</button>
        <input ref={ref} type="file" accept="application/pdf" multiple hidden onChange={e=>{ add(e.target.files); e.target.value = "" }} />
      </div>
      <UploadStrip pct={pct} />
      {items === null && <div className="skel-card"><Skeleton lines={4}/></div>}
      {items && items.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📚</div><h3>No documents yet</h3><p>Upload a PDF to start your library. Only PDFs uploaded in this browser appear here.</p></div>
      )}
      <ul className="lib-list">
        {(items || []).map(it=>{
          const isActive = active.includes(it.name)
          return (
            <li key={it.name} className={"lib-item" + (isActive ? " active" : "")}>
              <span className="lib-ico">📄</span>
              <div className="lib-meta">
                <b title={it.name}>{it.name}</b>
                <span>{fmtSize(it.size)} · {ago(it.at)}{isActive ? " · active" : ""}</span>
              </div>
              <button className="btn btn-ghost btn-sm" disabled={!!busy || (isActive && doc)} onClick={()=>use(it.name)}>{busy === it.name ? <Spin/> : isActive ? "Active" : "Use"}</button>
              <button className="btn btn-ghost btn-sm" aria-label={"Remove " + it.name} onClick={()=>del(it.name)}>🗑</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- Settings ---------- */
function AccountSecurity(){
  const [open, setOpen] = useState("")
  const [old, setOld] = useState(""), [nw, setNw] = useState(""), [del, setDel] = useState("")
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  const reset = ()=>{ setOld(""); setNw(""); setDel(""); setErr(""); setOpen("") }
  const msg = ex=>!ex?.response ? "Can't reach the server. Try again." : (ex.response.data?.detail || "Something went wrong.")
  async function change(e){
    e.preventDefault(); setErr("")
    if(nw.length < 8) return setErr("New password must be at least 8 characters.")
    setBusy(true)
    try{
      const { data } = await api.post("/auth/change-password", { old_password: old, new_password: nw })
      localStorage.setItem("ml_token", JSON.stringify(data.access_token)); setAuthToken(data.access_token)
      toast("Password changed. Other devices were signed out.", "ok"); reset()
    }catch(ex){ setErr(msg(ex)) }finally{ setBusy(false) }
  }
  async function remove(e){
    e.preventDefault(); setErr("")
    if(!window.confirm("Delete your account and all server-side data (PDFs, index, synced progress)? This cannot be undone.")) return
    setBusy(true)
    try{
      await api.post("/auth/delete-account", { password: del })
      try{ await clearLibrary() }catch(_){}
      ;["ml_token", "ml_user"].forEach(k=>localStorage.removeItem(k))
      toast("Account deleted. Reloading…", "ok"); setTimeout(()=>window.location.reload(), 900)
    }catch(ex){ setErr(msg(ex)) }finally{ setBusy(false) }
  }
  return (
    <div>
      <div className="row-actions">
        <button className="btn btn-ghost btn-sm" onClick={()=>{ reset(); setOpen("pw") }}>Change password</button>
        <button className="btn btn-ghost btn-sm danger" onClick={()=>{ reset(); setOpen("del") }}>Delete account</button>
      </div>
      {open === "pw" && (
        <form className="acct-form" onSubmit={change}>
          <input className="inp" type="password" placeholder="Current password" aria-label="Current password" autoComplete="current-password" value={old} onChange={e=>setOld(e.target.value)} />
          <input className="inp" type="password" placeholder="New password (8+ characters)" aria-label="New password" autoComplete="new-password" value={nw} onChange={e=>setNw(e.target.value)} />
          {err && <div className="auth-err" role="alert">⚠️ {err}</div>}
          <div className="row-actions"><button className="btn btn-p btn-sm" disabled={busy} type="submit">{busy ? "Saving…" : "Save"}</button><button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button></div>
        </form>
      )}
      {open === "del" && (
        <form className="acct-form" onSubmit={remove}>
          <p className="profile-email">This permanently deletes your account, uploaded PDFs, search index and synced progress. Enter your password to confirm.</p>
          <input className="inp" type="password" placeholder="Your password" aria-label="Password to confirm" autoComplete="current-password" value={del} onChange={e=>setDel(e.target.value)} />
          {err && <div className="auth-err" role="alert">⚠️ {err}</div>}
          <div className="row-actions"><button className="btn btn-ghost btn-sm danger" disabled={busy || !del} type="submit">{busy ? "Deleting…" : "Delete my account"}</button><button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button></div>
        </form>
      )}
    </div>
  )
}

export function SettingsTab(){
  const [dark, setDark] = useDark()
  const [lang, setLang] = useLocalState("ml_outlang", "en")
  const [theme, setTheme] = useLocalState("ml_theme", "nova")
  const [auto, setAuto] = useLocalState("ml_theme_auto", false)
  const [profile, setProfile] = useLocalState("ml_profile", null)
  const [sound, setSound] = useState(isSoundOn())
  const [, force] = useState(0)
  const [legal, setLegal] = useState(null)
  const fileRef = useRef()
  let user = null
  try{ user = JSON.parse(localStorage.getItem("ml_user") || "null") }catch(e){}
  useEffect(()=>{ const f = ()=>force(n=>n+1); window.addEventListener("ml-sync-status", f); return ()=>window.removeEventListener("ml-sync-status", f) },[])

  function allData(){
    const out = {}
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i)
      if(k && k.startsWith("ml_") && k !== "ml_token") out[k] = localStorage.getItem(k)
    }
    return out
  }
  function backup(){
    downloadFile(`mindlearn-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ app:"mindlearn", v:1, at:new Date().toISOString(), data: allData() }, null, 2), "application/json")
    toast("Backup downloaded.", "ok")
  }
  function restore(file){
    if(!file) return
    const r = new FileReader()
    r.onload = ()=>{
      try{
        const j = JSON.parse(r.result)
        if(j.app !== "mindlearn" || !j.data) throw new Error("bad")
        Object.entries(j.data).forEach(([k, v])=>{ if(k.startsWith("ml_") && k !== "ml_token" && typeof v === "string") localStorage.setItem(k, v) })
        toast("Backup restored. Reloading…", "ok")
        setTimeout(()=>window.location.reload(), 900)
      }catch(e){ toast("That file isn't a valid MindLearn backup.", "error") }
    }
    r.readAsText(file)
  }
  async function wipe(){
    if(!window.confirm("Delete all your local study data (progress, flashcards, chat history, stored PDFs)? This cannot be undone.")) return
    const keep = ["ml_token", "ml_user", "ml_dark"]
    Object.keys(allData()).forEach(k=>{ if(!keep.includes(k)) localStorage.removeItem(k) })
    try{ await clearLibrary() }catch(e){}
    toast("Local data deleted. Reloading…", "ok")
    setTimeout(()=>window.location.reload(), 900)
  }
  const st = syncInfo.status
  return (
    <div className="set-wrap">
      <div className="card set-card">
        <h3>Account</h3>
        <div className="set-row"><span>Name</span><b>{user?.name || "—"}</b></div>
        <div className="set-row"><span>Email</span><b>{user?.email || "—"}</b></div>
        <AccountSecurity />
      </div>
      <div className="card set-card">
        <h3>Preferences</h3>
        <div className="set-row"><span>Preparing for</span>
          <select className="sel" aria-label="Preparing for" value={profile?.goal || ""} onChange={e=>setProfile({ goal:e.target.value })}>
            <option value="" disabled>Choose…</option>
            {[["neet","NEET"],["jee","JEE"],["upsc","UPSC"],["college","College / University"],["school","School boards"],["coding","Coding / Skills"],["other","Something else"]].map(([k, n])=>(<option key={k} value={k}>{n}</option>))}
          </select>
        </div>
        <div className="set-row"><span>Answer language</span>
          <div className="lang-seg-btns">{Object.entries(LANGS).map(([k,v])=>(<button key={k} className={lang===k?"on":""} onClick={()=>setLang(k)}>{v.short}</button>))}</div>
        </div>
        <div className="set-row"><span>Theme</span>
          <div className="lang-seg-btns"><button className={!auto&&dark?"on":""} onClick={()=>{ setAuto(false); setDark(true) }}>Dark</button><button className={!auto&&!dark?"on":""} onClick={()=>{ setAuto(false); setDark(false) }}>Light</button><button className={auto?"on":""} onClick={()=>setAuto(true)}>Auto</button></div>
        </div>
        <div className="set-row"><span>Accent colour</span>
          <div className="accent-row">{Object.entries(THEMES).map(([k, t])=>(<button key={k} aria-label={t.name} title={t.name} className={"accent-dot" + (theme===k ? " on":"")} style={{ background:`linear-gradient(135deg, ${t.v}, ${t.cy})` }} onClick={()=>setTheme(k)} />))}</div>
        </div>
        <div className="set-row"><span>Sound effects</span>
          <div className="lang-seg-btns"><button className={sound?"on":""} onClick={()=>{ setSoundOn(true); setSound(true); sounds.click() }}>On</button><button className={!sound?"on":""} onClick={()=>{ setSoundOn(false); setSound(false) }}>Off</button></div>
        </div>
      </div>
      <SettingsExtras />
      <div className="card set-card">
        <h3>Your data</h3>
        <p className="profile-email">Progress, flashcards and settings live in this browser. Download a backup to move them to another device.</p>
        <div className="row-actions">
          <button className="btn btn-p btn-sm" onClick={backup}>Download backup</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current?.click()}>Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={e=>{ restore(e.target.files[0]); e.target.value = "" }} />
          <button className="btn btn-ghost btn-sm danger" onClick={wipe}>Delete local data</button>
        </div>
        <div className="set-row" style={{marginTop:14}}>
          <span>Cloud sync</span>
          <b className={"sync-pill " + st}>{st === "on" ? "On" : st === "error" ? "Error" : st === "off" ? "Not available" : "Checking…"}</b>
        </div>
        {st === "off" && <p className="profile-email">The backend doesn't offer sync yet, so your data stays on this device.</p>}
        {st === "on" && <button className="btn btn-ghost btn-sm" onClick={()=>{ syncPull(); toast("Syncing…") }}>Sync now</button>}
      </div>
      <div className="card set-card">
        <h3>About</h3>
        <div className="row-actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>setLegal("privacy")}>Privacy Policy</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setLegal("terms")}>Terms of Use</button>
        </div>
      </div>
      {legal && <LegalModal kind={legal} onClose={()=>setLegal(null)} />}
    </div>
  )
}

/* ---------- Due cards (spaced repetition reminders) ---------- */
export function useDueCount(){
  const [cards] = useLocalState("ml_srs", [])
  const now = Date.now()
  return Array.isArray(cards) ? cards.filter(c=>c.due <= now).length : 0
}
export function DueCard({ goTo }){
  const n = useDueCount()
  if(n === 0) return null
  return (
    <button className="due-card" onClick={()=>goTo("srs")}>
      <span className="due-ico">🔔</span>
      <span className="due-text"><b>{n} card{n === 1 ? "" : "s"} due for review</b><i>Reviewing now keeps them in long-term memory.</i></span>
      <span className="btn btn-p btn-sm">Review</span>
    </button>
  )
}

/* ---------- Mobile bottom navigation ---------- */
export function BottomNav({ tab, goTo }){
  const due = useDueCount()
  const items = [["Home","🏠","Home"],["chat","💬","Chat"],["quiz","🧠","Quiz"],["exam","📝","Exam"]]
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map(([k, ic, label])=>(
        <button key={k} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} onClick={()=>goTo(k)}>
          <span>{ic}</span><i>{label}</i>
        </button>
      ))}
      <button onClick={()=>window.dispatchEvent(new Event("ml-menu"))} aria-label="All tools">
        <span>☰{due > 0 && <em className="bn-dot">{due > 9 ? "9+" : due}</em>}</span><i>More</i>
      </button>
    </nav>
  )
}

/* ---------- Export helpers ---------- */
export function ExportBar({ items }){
  return (
    <div className="export-bar">
      {items.map(([label, fn])=>(<button key={label} className="btn btn-ghost btn-sm" onClick={fn}>{label}</button>))}
    </div>
  )
}
export function notesToHtml(text){
  return `<pre>${esc(text)}</pre>`
}
export function csvCell(s){ return '"' + String(s ?? "").replace(/"/g, '""') + '"' }
