import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocalState, toast, sounds, pushNotif, weakStats, ACHIEVEMENTS, FUN_META } from "./lib.jsx"
import { calcXp, levelOf, streakOf, saveToNotes } from "./core.js"
import { useDueCount } from "./production.jsx"
import { listLibrary, getLibraryFile, pdfNames } from "./pdfstore.js"

const DAY = 86400000
const go = k => window.dispatchEvent(new CustomEvent("ml-goto", { detail: k }))
const notify = k => window.dispatchEvent(new CustomEvent("ml-ls", { detail: k }))

/* ---------- install prompt capture ---------- */
if(typeof window !== "undefined"){
  window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); window.__bip = e; window.dispatchEvent(new Event("ml-bip")) })
  window.addEventListener("appinstalled", ()=>{ window.__bip = null; window.dispatchEvent(new Event("ml-bip")) })
}
const isStandalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

/* ---------- global effects: cursor spotlight on cards ---------- */
const SPOT = ".feature-card, .tool-card, .pr-card, .goal-block, .lab-card, .cmp-card"
export function useSpotlight(){
  useEffect(()=>{
    if(window.matchMedia && !window.matchMedia("(pointer: fine)").matches) return
    let raf = 0
    const f = e=>{
      const el = e.target.closest && e.target.closest(SPOT)
      if(!el) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(()=>{ const r = el.getBoundingClientRect(); el.style.setProperty("--mx", (e.clientX - r.left) + "px"); el.style.setProperty("--my", (e.clientY - r.top) + "px") })
    }
    document.addEventListener("mousemove", f, { passive:true })
    return ()=>document.removeEventListener("mousemove", f)
  },[])
}

export function ScrollProgress(){
  const ref = useRef()
  useEffect(()=>{
    const f = ()=>{ const h = document.documentElement.scrollHeight - window.innerHeight; if(ref.current) ref.current.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})` }
    f(); window.addEventListener("scroll", f, { passive:true }); window.addEventListener("resize", f)
    return ()=>{ window.removeEventListener("scroll", f); window.removeEventListener("resize", f) }
  },[])
  return <div className="scroll-prog" aria-hidden="true"><i ref={ref} /></div>
}

export function Words({ text, as: Tag = "h2", className = "section-title" }){
  const ref = useRef()
  const [on, setOn] = useState(false)
  useEffect(()=>{
    const el = ref.current; if(!el) return
    const io = new IntersectionObserver(es=>{ if(es[0].isIntersecting){ setOn(true); io.disconnect() } }, { threshold:.3 })
    io.observe(el); return ()=>io.disconnect()
  },[])
  return (
    <Tag ref={ref} className={className + " words" + (on ? " in" : "")} aria-label={text}>
      {text.split(" ").map((w, i)=>(<span key={i} aria-hidden="true" style={{ "--i": i }}>{w}&nbsp;</span>))}
    </Tag>
  )
}

/* ---------- landing: sticky nav links ---------- */
export function NavLinks({ t = k=>({n_how:"How it works",n_try:"Try demo",n_feat:"Features",n_price:"Pricing",n_road:"Roadmap"}[k]) }){
  const sc = id=>()=>{ const el = document.getElementById(id); el && el.scrollIntoView({ behavior:"smooth", block:"start" }) }
  return (
    <div className="nav-links" role="navigation" aria-label="Sections">
      <button onClick={sc("how-it-works")}>{t("n_how")}</button>
      <button onClick={sc("try")}>{t("n_try")}</button>
      <button onClick={sc("features")}>{t("n_feat")}</button>
      <button onClick={sc("pricing")}>{t("n_price")}</button>
      <button onClick={sc("roadmap")}>{t("n_road")}</button>
      <button onClick={sc("faq")}>FAQ</button>
    </div>
  )
}

/* ---------- landing: use-case marquee ---------- */
const CASES = [["🧬","NEET biology chapters"],["⚖️","Law case summaries"],["💻","Code review before you submit"],["🏛️","UPSC current-affairs notes"],["📐","JEE formula flashcards"],["📊","Finance and CA chapters"],["🎓","Thesis literature skim"],["🎤","Interview prep from a job post"],["📚","School board revision"],["🧪","Lab manual walkthroughs"]]
export function UseCases(){
  const row = (rev)=>(
    <div className={"uc-row" + (rev ? " rev" : "")} aria-hidden={rev ? "true" : undefined}>
      <div className="uc-track">{[...CASES, ...CASES].map(([i, t], k)=>(<span key={k} className="uc-chip"><b>{i}</b>{t}</span>))}</div>
    </div>
  )
  return (
    <section className="section usecases" aria-label="What people study with it">
      <Words text="Use it for whatever you're studying" />
      {row(false)}{row(true)}
    </section>
  )
}

/* ---------- landing: before / after ---------- */
export function BeforeAfter(){
  const [pos, setPos] = useState(50)
  const raw = "The process of cellular respiration involves the breakdown of glucose in the presence of oxygen to produce carbon dioxide water and energy in the form of ATP which occurs in three main stages namely glycolysis which takes place in the cytoplasm the Krebs cycle which occurs in the mitochondrial matrix and the electron transport chain located on the inner mitochondrial membrane where most ATP is generated via oxidative phosphorylation and it is important to note that"
  return (
    <section className="section ba" aria-label="Before and after">
      <Words text="From a wall of text to notes you can revise" />
      <div className="ba-box" style={{ "--p": pos + "%" }}>
        <div className="ba-layer ba-before"><small>BEFORE · raw PDF text</small><p>{raw}</p></div>
        <div className="ba-layer ba-after" aria-hidden="true">
          <small>AFTER · MindLearn notes</small>
          <h4>Cellular respiration</h4>
          <ul><li><b>Glycolysis</b> · cytoplasm · glucose → pyruvate</li><li><b>Krebs cycle</b> · mitochondrial matrix</li><li><b>Electron transport chain</b> · inner membrane · makes most ATP</li></ul>
          <div className="ba-chip">📎 Biology.pdf · p.8</div>
        </div>
        <div className="ba-handle" aria-hidden="true"><i>⇆</i></div>
        <input className="ba-range" type="range" min="5" max="95" value={pos} onChange={e=>setPos(+e.target.value)} aria-label="Compare before and after" />
      </div>
    </section>
  )
}

/* ---------- landing: pricing ---------- */
export function Pricing({ onStart }){
  return (
    <section className="section pricing" id="pricing">
      <Words text="Simple pricing" />
      <p className="section-sub">Start free today. Pro is planned and not on sale yet, so this site collects no payment.</p>
      <div className="pr-grid">
        <div className="pr-card">
          <h3>Free</h3>
          <div className="pr-price"><b>₹0</b><span>forever</span></div>
          <ul>
            <li>All study tools: chat, notes, quizzes, flashcards, exams</li>
            <li>English, Hinglish and Hindi answers</li>
            <li>Progress, goals and notes saved on your device</li>
            <li>Install as an app, backups and exports</li>
          </ul>
          <button className="btn btn-p" onClick={onStart}>Start free</button>
        </div>
        <div className="pr-card pro">
          <span className="pr-tag">Coming soon</span>
          <h3>Pro</h3>
          <div className="pr-price"><b>₹199</b><span>/ month, planned</span></div>
          <ul>
            <li>Everything in Free</li>
            <li>Cloud sync across your devices</li>
            <li>Scanned-PDF reading (OCR) and larger files</li>
            <li>Weekly progress report by email</li>
          </ul>
          <button className="btn btn-ghost" disabled>Not available yet</button>
        </div>
      </div>
      <p className="pr-foot">Planned features and price may change before launch.</p>
    </section>
  )
}

/* ---------- landing: comparison ---------- */
export function Compare(){
  const rows = [["Ask questions about your PDF", true, true],["Quizzes and timed mock exams", false, true],["Flashcards with spaced-repetition reminders", false, true],["Tracks your weak topics", false, true],["Hinglish and Hindi answers", false, true],["Sources linked to PDF pages (approximate)", false, true],["Daily goals, streaks and levels", false, true]]
  return (
    <section className="section compare">
      <Words text="Chatting with a PDF is the start. Not the whole thing." />
      <div className="cmp-card">
        <div className="cmp-head"><span/><b>Basic chat-with-PDF</b><b className="us">MindLearn</b></div>
        {rows.map(([t, a, b])=>(<div key={t} className="cmp-row"><span>{t}</span><i className={a ? "y" : "n"}>{a ? "✓" : "–"}</i><i className={b ? "y us" : "n"}>{b ? "✓" : "–"}</i></div>))}
      </div>
      <p className="pr-foot">Compared with simple chat-with-PDF tools. Some tools offer a few of these.</p>
    </section>
  )
}

/* ---------- dashboard: helpers ---------- */
export function UserAvatar({ initial, className = "side-avatar", size }){
  const [img] = useLocalState("ml_avatar", "")
  return <span className={className} style={size ? { width:size, height:size, fontSize:size * .42 } : undefined}>{img ? <img src={img} alt="" /> : initial}</span>
}
export function Spark({ data, w = 70, h = 26 }){
  if(!data || data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1
  const pts = data.map((v, i)=>`${(i / (data.length - 1) * w).toFixed(1)},${(h - 3 - (v - min) / span * (h - 6)).toFixed(1)}`).join(" ")
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--cy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={pts.split(" ").pop().split(",")[1]} r="2.6" fill="var(--cy)" />
    </svg>
  )
}

/* ---------- dashboard: today briefing ---------- */
export function TodayBriefing({ activity }){
  const due = useDueCount()
  const [g] = useLocalState("ml_goals", { daily:5, exam:null })
  const [, force] = useState(0)
  useEffect(()=>{ const f = e=>{ if(e.detail === "ml_weak") force(n=>n + 1) }; window.addEventListener("ml-ls", f); return ()=>window.removeEventListener("ml-ls", f) },[])
  const today = activity.filter(a=>new Date(a.at).toDateString() === new Date().toDateString()).length
  let weak = null; try{ weak = weakStats().find(t=>t.attempts >= 3 && t.acc < 70) }catch(e){}
  const examDays = g.exam ? Math.round((new Date(g.exam.date + "T00:00:00") - new Date(new Date().toDateString())) / DAY) : null
  const items = []
  if(examDays !== null && examDays >= 0 && examDays <= 14) items.push({ icon:"⏳", text:`${g.exam.name || "Your exam"} is ${examDays === 0 ? "today" : "in " + examDays + " day" + (examDays === 1 ? "" : "s")}`, act:"Mock exam", to:"exam" })
  if(due > 0) items.push({ icon:"🔔", text:`${due} flashcard${due === 1 ? "" : "s"} due for review`, act:"Review", to:"srs" })
  if(weak) items.push({ icon:"🎯", text:`${weak.topic} is your weakest topic (${weak.acc}%)`, act:"Practise", to:"weakspots" })
  if(today < g.daily) items.push({ icon:"🔥", text:`${g.daily - today} more action${g.daily - today === 1 ? "" : "s"} to hit today's goal`, act:"Take a quiz", to:"quiz" })
  const list = items.slice(0, 3)
  return (
    <div className="brief-card">
      <div className="brief-head"><b>Today's plan</b><span>{new Date().toLocaleDateString(undefined, { weekday:"long" })}</span></div>
      {list.length === 0 ? <p className="profile-email" style={{ margin:0 }}>You're all caught up today. Nice work! Try a mock exam to stay sharp.</p> : list.map(it=>(
        <div key={it.to} className="brief-row"><span>{it.icon}</span><p>{it.text}</p><button className="btn btn-ghost btn-sm" onClick={()=>go(it.to)}>{it.act}</button></div>
      ))}
    </div>
  )
}

/* ---------- dashboard: getting-started checklist ---------- */
export function Checklist({ activity }){
  const [off, setOff] = useLocalState("ml_checklist_off", false)
  const [doc] = useLocalState("ml_doc", null)
  const [scores] = useLocalState("ml_scores", [])
  const [g] = useLocalState("ml_goals", { daily:5, exam:null })
  const [notes] = useLocalState("ml_mynotes", [])
  const lab = ["knowledge", "weakspots", "exam", "voice"]
  const items = [
    { t:"Upload your first PDF", ok: !!doc, to:"Home" },
    { t:"Take a quiz", ok: scores.length > 0, to:"quiz" },
    { t:"Set an exam date or daily goal", ok: !!g.exam || g.daily !== 5, to:"Home" },
    { t:"Save a note", ok: notes.length > 0, to:"mynotes" },
    { t:"Try a Smart Lab tool", ok: activity.some(a=>lab.includes(a.k)), to:"knowledge" },
  ]
  const n = items.filter(i=>i.ok).length, all = n === items.length
  const fired = useRef(all)
  useEffect(()=>{ if(all && !fired.current){ toast("Setup complete. You're a pro already! 🎉", "ok"); pushNotif("You completed the getting-started checklist.", "✅"); sounds.success() } fired.current = all },[all])
  if(off) return null
  return (
    <div className={"cl-card" + (all ? " done" : "")}>
      <div className="cl-head"><b>{all ? "All set!" : "Get started"}</b><span>{n}/{items.length}</span><button aria-label="Hide checklist" onClick={()=>setOff(true)}>×</button></div>
      <div className="lvl-bar"><div style={{ width: n / items.length * 100 + "%" }} /></div>
      <div className="cl-list">
        {items.map(i=>(<button key={i.t} className={i.ok ? "ok" : ""} onClick={()=>!i.ok && go(i.to)}><i>{i.ok ? "✓" : ""}</i><span>{i.t}</span></button>))}
      </div>
    </div>
  )
}

/* ---------- dashboard: install card ---------- */
export function InstallCard(){
  const [off, setOff] = useLocalState("ml_install_off", false)
  const [, f] = useState(0)
  useEffect(()=>{ const h = ()=>f(n=>n + 1); window.addEventListener("ml-bip", h); return ()=>window.removeEventListener("ml-bip", h) },[])
  if(off || isStandalone() || (!window.__bip && !isIOS())) return null
  return (
    <div className="inst-card">
      <span className="due-ico">📲</span>
      <div className="due-text"><b>Install MindLearn</b><i>{window.__bip ? "Get it on your home screen. Opens fast and works offline for saved decks." : "On iPhone: tap Share, then Add to Home Screen."}</i></div>
      {window.__bip && <button className="btn btn-p btn-sm" onClick={async ()=>{ const p = window.__bip; p.prompt(); try{ await p.userChoice }catch(e){}; window.__bip = null; f(n=>n + 1) }}>Install</button>}
      <button className="inst-x" aria-label="Dismiss" onClick={()=>setOff(true)}>×</button>
    </div>
  )
}

/* ---------- dashboard: quick capture ---------- */
export function QuickCapture(){
  const [menu, setMenu] = useState(false)
  const [mode, setMode] = useState(null)
  const [a, setA] = useState(""), [b, setB] = useState("")
  useEffect(()=>{
    const f = e=>{ if(e.altKey && e.key.toLowerCase() === "n"){ e.preventDefault(); setMode("note") } else if(e.key === "Escape"){ setMode(null); setMenu(false) } }
    window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f)
  },[])
  function save(e){
    e.preventDefault()
    if(mode === "note"){ if(!b.trim() && !a.trim()) return; saveToNotes(a.trim() || b.trim().slice(0, 40), b) }
    else{
      if(!a.trim() || !b.trim()) return
      try{ const list = JSON.parse(localStorage.getItem("ml_srs") || "[]"); list.push({ q:a.trim(), a:b.trim(), interval:1, due:Date.now() }); localStorage.setItem("ml_srs", JSON.stringify(list)); notify("ml_srs"); toast("Flashcard added to your review deck.", "ok") }catch(err){ toast("Couldn't save the card.", "error") }
    }
    setA(""); setB(""); setMode(null); setMenu(false)
  }
  return (
    <>
      <div className="qc">
        {menu && (<div className="qc-menu"><button onClick={()=>{ setMode("note"); setMenu(false) }}>📝 Quick note</button><button onClick={()=>{ setMode("card"); setMenu(false) }}>🗂️ Flashcard</button></div>)}
        <button className={"qc-fab" + (menu ? " open" : "")} aria-label="Quick capture" aria-expanded={menu} title="Quick capture (Alt+N)" onClick={()=>setMenu(m=>!m)}>+</button>
      </div>
      {mode && createPortal(
        <div className="modal-bg" onClick={()=>setMode(null)}>
          <form className="modal legal" role="dialog" aria-modal="true" aria-label={mode === "note" ? "Quick note" : "New flashcard"} onClick={e=>e.stopPropagation()} onSubmit={save}>
            <button type="button" className="modal-x" aria-label="Close" onClick={()=>setMode(null)}>×</button>
            <h3>{mode === "note" ? "Quick note" : "New flashcard"}</h3>
            <input className="inp" autoFocus placeholder={mode === "note" ? "Title (optional)" : "Question"} value={a} onChange={e=>setA(e.target.value)} style={{ marginTop:12 }} />
            <textarea className="inp" placeholder={mode === "note" ? "Write your note…" : "Answer"} value={b} onChange={e=>setB(e.target.value)} rows={5} style={{ marginTop:10, width:"100%", resize:"vertical" }} />
            <div className="row-actions" style={{ marginTop:12 }}><button className="btn btn-p btn-sm" type="submit">Save</button></div>
          </form>
        </div>, document.body)}
    </>
  )
}

/* ---------- dashboard: split view (chat + PDF) ---------- */
export function SplitView({ onClose }){
  const [names, setNames] = useState(pdfNames())
  const [sel, setSel] = useState(names[0] || "")
  const [url, setUrl] = useState("")
  const [err, setErr] = useState("")
  useEffect(()=>{ if(!names.length) listLibrary().then(l=>{ const n = l.map(x=>x.name); setNames(n); if(n[0]) setSel(n[0]) }).catch(()=>{}) },[])
  useEffect(()=>{
    if(!sel) return
    let u = "", dead = false
    getLibraryFile(sel).then(f=>{ if(dead) return; u = URL.createObjectURL(f); setUrl(u); setErr("") }).catch(e=>setErr(e.message))
    return ()=>{ dead = true; if(u) URL.revokeObjectURL(u) }
  },[sel])
  return (
    <div className="card split-pdf">
      <div className="split-bar">
        {names.length > 1 ? <select className="sel" value={sel} onChange={e=>setSel(e.target.value)} aria-label="Choose PDF">{names.map(n=>(<option key={n}>{n}</option>))}</select> : <b>{sel || "No PDF stored"}</b>}
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
      {err && <div className="form-err">{err}</div>}
      {!sel && <p className="profile-email">Upload a PDF first (only PDFs uploaded in this browser can be shown).</p>}
      {url && <iframe title="PDF viewer" src={url} className="split-frame" />}
    </div>
  )
}

/* ---------- profile ---------- */
function shrink(file, size = 160){
  return new Promise((res, rej)=>{
    const img = new Image(), u = URL.createObjectURL(file)
    img.onload = ()=>{
      const c = document.createElement("canvas"); c.width = c.height = size
      const s = Math.min(img.width, img.height), g = c.getContext("2d")
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", .85))
    }
    img.onerror = ()=>{ URL.revokeObjectURL(u); rej(new Error("bad image")) }
    img.src = u
  })
}
export function ProfilePanel({ user, onClose, onLogout }){
  const [activity] = useLocalState("ml_activity", [])
  const [scores] = useLocalState("ml_scores", [])
  const [unlocked] = useLocalState("ml_achievements", [])
  const [notes] = useLocalState("ml_mynotes", [])
  const [pomo] = useLocalState("ml_pomodoro", 0)
  const [, setAvatar] = useLocalState("ml_avatar", "")
  const fileRef = useRef()
  const xp = calcXp(activity, scores), L = levelOf(xp)
  useEffect(()=>{ const f = e=>{ if(e.key === "Escape") onClose() }; window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f) },[])
  async function pick(f){
    if(!f) return
    try{ setAvatar(await shrink(f)); toast("Profile photo updated.", "ok") }catch(e){ toast("That image couldn't be used.", "error") }
  }
  const stats = [[activity.length, "Study actions"], [scores.length, "Quizzes"], [notes.length, "Notes"], [streakOf(activity), "Day streak"], [pomo, "Focus sessions"], [`${unlocked.length}/${ACHIEVEMENTS.length}`, "Achievements"]]
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal legal prof" role="dialog" aria-modal="true" aria-label="Your profile" onClick={e=>e.stopPropagation()}>
        <button className="modal-x" aria-label="Close" onClick={onClose}>×</button>
        <div className="prof-top">
          <button className="prof-av" aria-label="Change profile photo" onClick={()=>fileRef.current?.click()}>
            <UserAvatar className="prof-avatar" initial={(user?.name || "U").charAt(0).toUpperCase()} size={88} /><em>Edit</em>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e=>{ pick(e.target.files[0]); e.target.value = "" }} />
          <div><h3>{user?.name || "Student"}</h3><p className="profile-email">{user?.email}</p></div>
        </div>
        <div className="lvl-card" style={{ margin:"16px 0" }}>
          <div className="lvl-badge"><b>{L.lvl}</b><small>LVL</small></div>
          <div className="lvl-main"><div className="lvl-top"><b>{L.title}</b><span>{xp} XP</span></div><div className="lvl-bar"><div style={{ width: L.pct + "%" }} /></div></div>
        </div>
        <div className="prof-stats">{stats.map(([n, l])=>(<div key={l}><b>{n}</b><span>{l}</span></div>))}</div>
        <h4 className="rep-h">Achievements</h4>
        <div className="prof-ach">{ACHIEVEMENTS.map(a=>(<span key={a.id} className={unlocked.includes(a.id) ? "on" : ""} title={`${a.label}: ${a.desc}`} aria-label={`${a.label}${unlocked.includes(a.id) ? ", unlocked" : ", locked"}`}>{a.icon}</span>))}</div>
        <div className="row-actions" style={{ marginTop:18 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>{ onClose(); go("settings") }}>⚙ Settings</button>
          <button className="btn btn-ghost btn-sm danger" onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </div>, document.body)
}

/* ============================================================
   v20: brand mark, roadmap, scroll book, buddy, typewriter
   ============================================================ */
export function Logo({ size = 28, id = "lgm" }){
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="logo-mark">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2DE3F0"/><stop offset="1" stopColor="#8B6BFF"/></linearGradient></defs>
      <path d="M15 47V25q0-4.4 3.6-2L32 36.5 45.4 23q3.6-2.4 3.6 2v22" fill="none" stroke={`url(#${id})`} strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 6.5l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z" fill="#2DE3F0" />
    </svg>
  )
}

export function Roadmap(){
  const cols = [
    { h:"Shipped", c:"ok", items:["Chat, notes, flashcards, quizzes","Timed mock exams (NEET, JEE, UPSC styles)","Weak-spot tracking and knowledge map","Hinglish and Hindi answers, voice tutor","Spaced repetition, goals, streaks, levels","Document library, exports, backups, PWA"] },
    { h:"Building", c:"wip", items:["Streaming answers as they are written","Exact page citations from the server"] },
    { h:"Planned", c:"plan", items:["Cloud sync across devices","Scanned-PDF reading (OCR)","Password reset and email verification","Pro plan"] },
  ]
  return (
    <section className="section roadmap" id="roadmap">
      <Words text="What's built, and what's next" />
      <p className="section-sub">An honest look at where MindLearn is today.</p>
      <div className="rm-grid">
        {cols.map(c=>(
          <div key={c.h} className={"rm-col " + c.c}>
            <h3>{c.h}</h3>
            <ul>{c.items.map(i=>(<li key={i}>{i}</li>))}</ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ScrollBook(){
  const wrap = useRef(), stage = useRef()
  useEffect(()=>{
    const el = wrap.current, st = stage.current
    if(!el || !st) return
    let raf = 0
    const upd = ()=>{
      const r = el.getBoundingClientRect(), span = r.height - window.innerHeight
      const p = Math.max(0, Math.min(1, span > 0 ? -r.top / span : 0))
      st.style.setProperty("--p", p.toFixed(4))
    }
    const f = ()=>{ cancelAnimationFrame(raf); raf = requestAnimationFrame(upd) }
    upd(); window.addEventListener("scroll", f, { passive:true }); window.addEventListener("resize", f)
    return ()=>{ window.removeEventListener("scroll", f); window.removeEventListener("resize", f); cancelAnimationFrame(raf) }
  },[])
  return (
    <section className="book" ref={wrap} aria-label="A PDF page turning into notes">
      <div className="book-stage" ref={stage}>
        <Words text="Watch a page become notes" />
        <div className="book-3d">
          <div className="book-card">
            <div className="book-face front" aria-hidden="true">
              <small>PAGE 12 · Biology.pdf</small>
              {Array.from({ length: 13 }).map((_, i)=>(<i key={i} style={{ width: (i % 4 === 3 ? 62 : 100) + "%" }} />))}
            </div>
            <div className="book-face back">
              <small>NOTES · generated</small>
              <h4>Photosynthesis</h4>
              <ul><li><b>Light reactions</b> · thylakoid · ATP + NADPH</li><li><b>Calvin cycle</b> · stroma · CO₂ → glucose</li><li><b>Chlorophyll</b> · absorbs red + blue</li></ul>
              <span className="book-chip">📎 p.12</span>
            </div>
          </div>
        </div>
        <p className="book-cap">Keep scrolling</p>
      </div>
    </section>
  )
}

/* ---------- study buddy ---------- */
const TIPS = ["Press ⌘K to jump to any tool.", "Shift+F hides the sidebar for focus mode.", "Alt+N saves a quick note from anywhere.", "Short sessions beat long ones. Try a 25-minute focus timer.", "Explaining a topic out loud is a great test. Try the Voice Tutor."]
export function Buddy({ activity }){
  const due = useDueCount()
  const [g] = useLocalState("ml_goals", { daily:5, exam:null })
  const [i, setI] = useState(0)
  const now = new Date(), hr = now.getHours()
  const today = activity.filter(a=>new Date(a.at).toDateString() === now.toDateString()).length
  let weak = null; try{ weak = weakStats().find(t=>t.attempts >= 3 && t.acc < 70) }catch(e){}
  const examDays = g.exam ? Math.round((new Date(g.exam.date + "T00:00:00") - new Date(now.toDateString())) / DAY) : null
  const st = streakOf(activity)
  const msgs = []
  if(examDays !== null && examDays >= 0 && examDays <= 10) msgs.push([`${examDays === 0 ? "Exam day!" : examDays + " day" + (examDays === 1 ? "" : "s") + " to your exam."} A mock test today?`, "focus"])
  if(due > 0) msgs.push([`${due} card${due === 1 ? " is" : "s are"} waiting. Two minutes?`, "wave"])
  if(weak) msgs.push([`Let's fix ${weak.topic} today. You're at ${weak.acc}%.`, "focus"])
  if(today >= g.daily) msgs.push(["Goal done. Proud of you!", "happy"])
  if(st >= 3) msgs.push([`${st}-day streak! Keep it alive.`, "happy"])
  if(hr >= 23 || hr < 4) msgs.push(["It's late. Sleep helps memory more than cramming.", "sleepy"])
  TIPS.forEach(t=>msgs.push([t, "wave"]))
  const [text, mood] = msgs[i % msgs.length]
  return (
    <div className="buddy-card">
      <svg className={"buddy m-" + mood} viewBox="0 0 120 120" width="92" height="92" aria-hidden="true">
        <defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--cy)"/><stop offset="1" stopColor="var(--v)"/></linearGradient></defs>
        <line x1="60" y1="18" x2="60" y2="8" stroke="url(#bg1)" strokeWidth="4" strokeLinecap="round" />
        <circle className="b-spark" cx="60" cy="7" r="5" fill="var(--cy)" />
        <rect className="b-body" x="20" y="22" width="80" height="78" rx="34" fill="url(#bg1)" />
        <rect x="31" y="40" width="58" height="38" rx="19" fill="#0b0920" />
        <g className="b-eyes"><ellipse cx="48" cy="58" rx="6" ry="8" fill="#fff" /><ellipse cx="72" cy="58" rx="6" ry="8" fill="#fff" /></g>
        {mood === "happy" ? <path d="M52 71q8 8 16 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" /> : mood === "sleepy" ? <path d="M54 72h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" /> : <path d="M54 71q6 4 12 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />}
        <circle cx="38" cy="70" r="4" fill="#ff8fc1" opacity=".5" /><circle cx="82" cy="70" r="4" fill="#ff8fc1" opacity=".5" />
      </svg>
      <button className="buddy-bubble" onClick={()=>setI(n=>n + 1)} aria-label="Next tip">
        <small>Mindy · your study buddy</small>
        <span key={i}>{text}</span>
      </button>
    </div>
  )
}

/* ---------- typewriter for fresh chat answers ---------- */
export function Typed({ text, onTick }){
  const [n, setN] = useState(0)
  useEffect(()=>{
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches){ setN(text.length); return }
    const step = Math.max(2, Math.ceil(text.length / 160))
    const id = setInterval(()=>{ setN(v=>{ const nx = Math.min(text.length, v + step); if(nx >= text.length) clearInterval(id); return nx }); onTick && onTick() }, 16)
    return ()=>clearInterval(id)
  },[text])
  return <span onClick={()=>setN(text.length)} title={n < text.length ? "Click to show all" : undefined}>{text.slice(0, n)}{n < text.length && <i className="type-caret" />}</span>
}

/* ============================================================
   v21: personalization + recap
   ============================================================ */
export const GOALS = {
  neet:    { label:"NEET",              icon:"🧬", tools:["pyq","exam","weakspots","quiz"], exam:"neet" },
  jee:     { label:"JEE",               icon:"📐", tools:["pyq","exam","weakspots","quiz"], exam:"jee" },
  upsc:    { label:"UPSC",              icon:"🏛️", tools:["pyq","exam","essay","notes"], exam:"upsc" },
  college: { label:"College / University", icon:"🎓", tools:["notes","flashcards","quiz","chat"], exam:"general" },
  school:  { label:"School boards",     icon:"📚", tools:["notes","flashcards","quiz","eli5"], exam:"general" },
  coding:  { label:"Coding / Skills",   icon:"💻", tools:["codegen","debugger","reviewer","codequiz"], exam:"general" },
  other:   { label:"Something else",    icon:"✨", tools:["chat","notes","quiz","flashcards"], exam:"general" },
}
export function getProfileGoal(){ try{ const p = JSON.parse(localStorage.getItem("ml_profile") || "null"); return p && GOALS[p.goal] ? p.goal : null }catch(e){ return null } }

export function GoalPicker({ onDone, onSkip }){
  const [, setProfile] = useLocalState("ml_profile", null)
  const [sel, setSel] = useState(getProfileGoal())
  return (
    <div className="goalpick">
      <h3>What are you preparing for?</h3>
      <p className="profile-email">We'll suggest the right tools and set your exam style. You can change this anytime in Settings.</p>
      <div className="gp-grid" role="radiogroup" aria-label="What are you preparing for">
        {Object.entries(GOALS).map(([k, g])=>(
          <button key={k} role="radio" aria-checked={sel === k} className={"gp-opt" + (sel === k ? " on" : "")} onClick={()=>setSel(k)}><b>{g.icon}</b><span>{g.label}</span></button>
        ))}
      </div>
      <div className="tour-actions">
        {onSkip && <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip</button>}
        <button className="btn btn-p btn-sm" disabled={!sel} onClick={()=>{ try{ localStorage.setItem("ml_profile", JSON.stringify({ goal: sel })); window.dispatchEvent(new CustomEvent("ml-ls",{detail:"ml_profile"})) }catch(e){}; setProfile({ goal: sel }); onDone && onDone(sel) }}>Continue</button>
      </div>
    </div>
  )
}

export function Recommended({ goTo }){
  const [profile] = useLocalState("ml_profile", null)
  const [editing, setEditing] = useState(false)
  const goal = profile && GOALS[profile.goal] ? profile.goal : null
  if(!goal || editing){
    return (
      <div className="rec-card"><GoalPicker onDone={()=>setEditing(false)} onSkip={goal ? ()=>setEditing(false) : null} /></div>
    )
  }
  const g = GOALS[goal]
  return (
    <div className="rec-card">
      <div className="rec-head"><b>{g.icon} Recommended for {g.label}</b><button onClick={()=>setEditing(true)}>Change</button></div>
      <div className="rec-grid">
        {g.tools.map(k=>(<button key={k} onClick={()=>goTo(k)}><span>{ICON_BY_KEY_SAFE(k)}</span><b>{FUN_META[k]?.title}</b><i>{FUN_META[k]?.tag}</i></button>))}
      </div>
    </div>
  )
}
import { ICON_BY_KEY } from "./lib.jsx"
const ICON_BY_KEY_SAFE = k => ICON_BY_KEY[k] || "✨"

export function Recap({ activity }){
  const [scores] = useLocalState("ml_scores", [])
  const day = new Date().getDay()
  if(day !== 0 && day !== 1) return null
  const since = Date.now() - 7 * DAY
  const acts = activity.filter(a=>a.at >= since)
  const wk = scores.filter(s=>new Date(s.date).getTime() >= since)
  const avg = wk.length ? Math.round(wk.reduce((a, s)=>a + (+s.pct || 0), 0) / wk.length) : null
  const by = {}; acts.forEach(a=>{ by[a.k] = (by[a.k] || 0) + 1 })
  const top = Object.entries(by).sort((a, b)=>b[1] - a[1])[0]
  if(!acts.length) return null
  return (
    <div className="recap-card">
      <div className="brief-head"><b>📅 Your week in review</b><span>{day === 0 ? "Sunday recap" : "Last week"}</span></div>
      <div className="recap-stats">
        <div><b>{acts.length}</b><span>actions</span></div>
        <div><b>{wk.length}</b><span>quizzes</span></div>
        <div><b>{avg === null ? "—" : avg + "%"}</b><span>avg score</span></div>
        <div><b>{streakOf(activity)}</b><span>day streak</span></div>
      </div>
      {top && <p className="profile-email" style={{ margin:"10px 0 0" }}>Most used: {FUN_META[top[0]]?.title || top[0]}</p>}
      <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={()=>go("report")}>Open full report</button>
    </div>
  )
}
