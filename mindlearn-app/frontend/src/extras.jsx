import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocalState, Skeleton, toast, pushNotif, sounds, downloadFile, printDoc, esc, FUN_META, weakStats } from "./lib.jsx"
import { getIndex, hasPdfs, keywordsOf } from "./pdfstore.js"
import { PdfViewer } from "./features.jsx"

import { DAY, dayKey } from "./core.js"

import { LEVELS, calcXp, levelOf, streakOf, saveToNotes } from "./core.js"
export { LEVELS, calcXp, levelOf, streakOf, saveToNotes }

function MiniRing({ pct, size = 86, label, sub }){
  const R = 38, C = 2 * Math.PI * R, v = Math.max(0, Math.min(100, pct))
  return (
    <div className="mini-ring" style={{ width:size, height:size }}>
      <svg viewBox="0 0 90 90" width={size} height={size}>
        <defs><linearGradient id="mrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2DE3F0"/><stop offset="1" stopColor="#8B6BFF"/></linearGradient></defs>
        <circle cx="45" cy="45" r={R} fill="none" stroke="rgba(139,107,255,.18)" strokeWidth="8" />
        <circle cx="45" cy="45" r={R} fill="none" stroke="url(#mrg)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v/100)} transform="rotate(-90 45 45)" style={{ transition:"stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="mini-ring-t"><b>{label}</b>{sub && <small>{sub}</small>}</div>
    </div>
  )
}

/* ---------- Level card + level-up toast ---------- */
export function LevelCard({ activity }){
  const [scores] = useLocalState("ml_scores", [])
  const xp = calcXp(activity, scores), L = levelOf(xp)
  useEffect(()=>{
    try{
      const prev = +localStorage.getItem("ml_level") || 0
      if(prev && L.lvl > prev){ toast(`Level up! You're now Level ${L.lvl}: ${L.title} 🎉`, "ok"); pushNotif(`Level up! You reached Level ${L.lvl}: ${L.title}`, "🚀"); sounds.levelup() }
      localStorage.setItem("ml_level", String(L.lvl))
    }catch(e){}
  },[L.lvl])
  return (
    <div className="lvl-card">
      <div className="lvl-badge"><b>{L.lvl}</b><small>LVL</small></div>
      <div className="lvl-main">
        <div className="lvl-top"><b>{L.title}</b><span>{xp} XP · {L.toNext} to next level</span></div>
        <div className="lvl-bar"><div style={{ width: L.pct + "%" }} /></div>
      </div>
    </div>
  )
}

/* ---------- Goals + exam countdown ---------- */
export function GoalsCard({ activity }){
  const [g, setG] = useLocalState("ml_goals", { daily: 5, exam: null })
  const [edit, setEdit] = useState(false)
  const [nm, setNm] = useState(""), [dt, setDt] = useState("")
  const today = (activity || []).filter(a=>dayKey(a.at) === dayKey(Date.now())).length
  const pct = Math.min(100, Math.round(today / Math.max(1, g.daily) * 100))
  const done = today >= g.daily
  const firedRef = useRef(done)
  useEffect(()=>{
    if(done && !firedRef.current){ toast("Daily goal reached. Nice work! 🔥", "ok"); pushNotif("Daily goal reached. Keep the streak going!", "🔥"); sounds.success() }
    firedRef.current = done
  },[done])
  const left = g.exam ? Math.round((new Date(g.exam.date + "T00:00:00") - new Date(new Date().toDateString())) / DAY) : null
  return (
    <div className="goals-card">
      <div className="goal-block">
        <MiniRing pct={pct} label={`${Math.min(today, g.daily)}/${g.daily}`} sub="today" />
        <div className="goal-text">
          <b>{done ? "Daily goal done 🔥" : "Daily goal"}</b>
          <span>{done ? "Keep the streak alive tomorrow." : `${g.daily - today} more action${g.daily - today === 1 ? "" : "s"} to hit today's target.`}</span>
          <div className="goal-step" aria-label="Daily target">
            <button aria-label="Decrease target" onClick={()=>setG({ ...g, daily: Math.max(1, g.daily - 1) })}>−</button>
            <i>{g.daily} / day</i>
            <button aria-label="Increase target" onClick={()=>setG({ ...g, daily: Math.min(30, g.daily + 1) })}>+</button>
          </div>
        </div>
      </div>
      <div className="goal-block exam-block">
        {g.exam && !edit ? (
          <>
            <div className={"exam-days" + (left <= 7 ? " hot" : "")}><b>{Math.max(left, 0)}</b><small>{left === 1 ? "day" : "days"}</small></div>
            <div className="goal-text">
              <b>{g.exam.name || "Your exam"}</b>
              <span>{left < 0 ? "Exam date has passed." : left === 0 ? "It's today. You've got this!" : new Date(g.exam.date).toLocaleDateString(undefined, { day:"numeric", month:"long" })}</span>
              <div className="goal-step"><button onClick={()=>{ setNm(g.exam.name); setDt(g.exam.date); setEdit(true) }}>Edit</button><button onClick={()=>setG({ ...g, exam:null })}>Clear</button></div>
            </div>
          </>
        ) : edit || !g.exam ? (
          <form className="exam-form" onSubmit={e=>{ e.preventDefault(); if(!dt) return; setG({ ...g, exam:{ name:nm.trim(), date:dt } }); setEdit(false) }}>
            <b>⏳ Exam countdown</b>
            <input className="inp" placeholder="Exam name (optional)" value={nm} onChange={e=>setNm(e.target.value)} />
            <input className="inp" type="date" aria-label="Exam date" min={new Date().toISOString().slice(0,10)} value={dt} onChange={e=>setDt(e.target.value)} />
            <button className="btn btn-p btn-sm" type="submit" disabled={!dt}>Start countdown</button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- Shortcuts help ---------- */
export function ShortcutsModal(){
  const [open, setOpen] = useState(false)
  useEffect(()=>{
    const f = e=>{
      if(/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return
      if(e.key === "?"){ e.preventDefault(); setOpen(o=>!o) }
      else if(e.key === "Escape") setOpen(false)
    }
    const o = ()=>setOpen(true)
    window.addEventListener("keydown", f); window.addEventListener("ml-shortcuts", o)
    return ()=>{ window.removeEventListener("keydown", f); window.removeEventListener("ml-shortcuts", o) }
  },[])
  if(!open) return null
  const rows = [["⌘ / Ctrl + K","Search any tool"],["⌘ / Ctrl + 1–9","Jump to a tool"],["Shift + F","Focus mode (hide sidebar)"],["?","Show this help"],["← →  Space","Flip through flashcards"],["Esc","Close dialogs"]]
  return createPortal(
    <div className="modal-bg" onClick={()=>setOpen(false)}>
      <div className="modal legal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={e=>e.stopPropagation()}>
        <button className="modal-x" aria-label="Close" onClick={()=>setOpen(false)}>×</button>
        <h3>Keyboard shortcuts</h3>
        <div className="kbd-list">{rows.map(([k, d])=>(<div key={k}><kbd>{k}</kbd><span>{d}</span></div>))}</div>
      </div>
    </div>, document.body)
}

/* ---------- My Notes (editor) ---------- */
export function MyNotesTab(){
  const [list, setList] = useLocalState("ml_mynotes", [])
  const [sel, setSel] = useState(null)
  const [q, setQ] = useState("")
  const cur = list.find(n=>n.id === sel) || null
  useEffect(()=>{ if(!sel && list[0]) setSel(list[0].id) },[list.length])
  const upd = patch => setList(l=>l.map(n=>n.id === sel ? { ...n, ...patch, at: Date.now() } : n))
  function add(){ const n = { id: Date.now().toString(36), title:"Untitled note", body:"", at: Date.now() }; setList(l=>[n, ...l]); setSel(n.id) }
  function del(){ if(!cur || !window.confirm("Delete this note?")) return; setList(l=>l.filter(n=>n.id !== cur.id)); setSel(null) }
  const shown = list.filter(n=>!q || (n.title + n.body).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mynotes">
      <div className="card mn-list">
        <div className="mn-top"><input className="inp" placeholder="Search notes…" aria-label="Search notes" value={q} onChange={e=>setQ(e.target.value)} /><button className="btn btn-p btn-sm" onClick={add}>+ New</button><button className="btn btn-ghost btn-sm split-btn" title="Show a PDF beside your notes" onClick={()=>window.dispatchEvent(new Event("ml-split"))}>📖</button></div>
        {shown.length === 0 && <p className="profile-email">{list.length ? "No matches." : "No notes yet. Create one, or use “Save to My Notes” in Smart Notes and Chat."}</p>}
        {shown.map(n=>(
          <button key={n.id} className={"mn-item" + (n.id === sel ? " on" : "")} onClick={()=>setSel(n.id)}>
            <b>{n.title || "Untitled"}</b><span>{(n.body || "").slice(0, 60) || "Empty"}</span>
          </button>
        ))}
      </div>
      <div className="card mn-edit">
        {cur ? (
          <>
            <input className="inp mn-title" aria-label="Note title" value={cur.title} onChange={e=>upd({ title:e.target.value })} />
            <textarea className="inp mn-body" aria-label="Note body" value={cur.body} onChange={e=>upd({ body:e.target.value })} placeholder="Write or paste your notes here. They save automatically." />
            <div className="row-actions">
              <span className="profile-email" style={{marginRight:"auto"}}>{cur.body.trim() ? cur.body.trim().split(/\s+/).length : 0} words · autosaved</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>downloadFile((cur.title || "note") + ".md", `# ${cur.title}\n\n${cur.body}`, "text/markdown")}>⬇ Markdown</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>printDoc(cur.title, `<pre>${esc(cur.body)}</pre>`)}>🖨 PDF</button>
              <button className="btn btn-ghost btn-sm danger" onClick={del}>Delete</button>
            </div>
          </>
        ) : <p className="profile-email">Select a note or create a new one.</p>}
      </div>
    </div>
  )
}

/* ---------- PDF search ---------- */
export function PdfSearchTab(){
  const [q, setQ] = useState("")
  const [pages, setPages] = useState(null)
  const [err, setErr] = useState("")
  const [view, setView] = useState(null)
  useEffect(()=>{
    if(!hasPdfs()) { setPages([]); return }
    let dead = false
    getIndex().then(p=>{ if(!dead) setPages(p) }).catch(()=>{ if(!dead){ setErr("Couldn't read your PDFs. Check your internet connection (the PDF reader loads from a CDN) and try again."); setPages([]) } })
    return ()=>{ dead = true }
  },[])
  const terms = useMemo(()=>q.toLowerCase().split(/\s+/).filter(t=>t.length >= 2), [q])
  const results = useMemo(()=>{
    if(!pages || !terms.length) return []
    return pages.map(pg=>{
      let score = 0, first = -1
      for(const t of terms){ const i = pg.text.indexOf(t); if(i >= 0){ score += 1 + Math.min(5, pg.text.split(t).length - 2) * .2; if(first < 0 || i < first) first = i } }
      return score ? { ...pg, score, first } : null
    }).filter(Boolean).sort((a, b)=>b.score - a.score).slice(0, 30)
  },[pages, terms])
  function snippet(r){
    const s = Math.max(0, r.first - 60), txt = r.text.slice(s, s + 220)
    const re = new RegExp("(" + terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi")
    return txt.split(re).map((p, i)=> i % 2 ? <mark key={i}>{p}</mark> : p)
  }
  return (
    <div className="card">
      <input className="inp" autoFocus placeholder="Search inside your uploaded PDFs…" aria-label="Search PDFs" value={q} onChange={e=>setQ(e.target.value)} />
      {pages === null && <div className="skel-card"><Skeleton lines={4}/></div>}
      {err && <div className="form-err">{err}</div>}
      {pages && pages.length === 0 && !err && <p className="profile-email" style={{marginTop:12}}>No PDFs stored in this browser yet. Upload one first (only PDFs uploaded in v15 or later are searchable).</p>}
      {pages && pages.length > 0 && <p className="profile-email" style={{marginTop:10}}>{pages.length} pages indexed{terms.length ? ` · ${results.length} match${results.length === 1 ? "" : "es"}` : ""}</p>}
      <div className="ps-list">
        {results.map(r=>(
          <button key={r.pdf + r.page} className="ps-item" onClick={()=>setView(r)}>
            <span className="ps-meta">📄 {r.pdf} · p.{r.page}</span>
            <span className="ps-snip">…{snippet(r)}…</span>
          </button>
        ))}
      </div>
      {view && <PdfViewer pdf={view.pdf} page={view.page} keywords={terms} onClose={()=>setView(null)} />}
    </div>
  )
}

/* ---------- Weekly report ---------- */
export function WeeklyReportTab(){
  const [activity] = useLocalState("ml_activity", [])
  const [scores] = useLocalState("ml_scores", [])
  const since = Date.now() - 7 * DAY
  const acts = activity.filter(a=>a.at >= since)
  const days = Array.from({ length:7 }, (_, i)=>{ const t = Date.now() - (6 - i) * DAY; return { d: new Date(t).toLocaleDateString(undefined, { weekday:"short" }), n: activity.filter(a=>dayKey(a.at) === dayKey(t)).length } })
  const max = Math.max(1, ...days.map(d=>d.n))
  const wk = scores.filter(s=>new Date(s.date).getTime() >= since)
  const avg = wk.length ? Math.round(wk.reduce((a, s)=>a + (+s.pct || 0), 0) / wk.length) : null
  const byTool = {}; acts.forEach(a=>{ byTool[a.k] = (byTool[a.k] || 0) + 1 })
  const top = Object.entries(byTool).sort((a, b)=>b[1] - a[1]).slice(0, 4)
  let weak = []; try{ weak = weakStats().filter(t=>t.attempts >= 2).slice(0, 3) }catch(e){}
  const xp = calcXp(activity, scores), L = levelOf(xp), st = streakOf(activity)
  function pdf(){
    printDoc("Weekly study report", `<h2>This week</h2><p>${acts.length} study actions · ${wk.length} quizzes${avg !== null ? ` · average ${avg}%` : ""} · ${st}-day streak · Level ${L.lvl} (${L.title})</p><h2>Most used</h2>` + (top.map(([k, n])=>`<div class="q">${esc(FUN_META[k]?.title || k)}: ${n}</div>`).join("") || "<p>No activity yet.</p>") + `<h2>Needs work</h2>` + (weak.map(t=>`<div class="q bad">${esc(t.topic)}: ${t.acc}%</div>`).join("") || "<p>Nothing flagged yet.</p>"))
  }
  return (
    <div className="card report">
      <div className="rep-grid">
        <div><b>{acts.length}</b><span>actions</span></div>
        <div><b>{wk.length}</b><span>quizzes</span></div>
        <div><b>{avg === null ? "—" : avg + "%"}</b><span>avg score</span></div>
        <div><b>{st}</b><span>day streak</span></div>
      </div>
      <h4 className="rep-h">Daily activity</h4>
      <div className="rep-bars" role="img" aria-label="Actions per day this week">
        {days.map((d, i)=>(<div key={i}><i style={{ height: Math.max(4, d.n / max * 100) + "%" }} title={d.n + " actions"} /><span>{d.d}</span></div>))}
      </div>
      <h4 className="rep-h">Most used</h4>
      {top.length ? top.map(([k, n])=>(<div className="rep-row" key={k}><span>{FUN_META[k]?.title || k}</span><b>{n}</b></div>)) : <p className="profile-email">No activity yet this week.</p>}
      <h4 className="rep-h">Needs work</h4>
      {weak.length ? weak.map(t=>(<div className="rep-row" key={t.topic}><span>{t.topic}</span><b>{t.acc}%</b></div>)) : <p className="profile-email">Take a few quizzes and your weak topics show up here.</p>}
      <div className="row-actions" style={{marginTop:16}}><button className="btn btn-p btn-sm" onClick={pdf}>🖨 Save as PDF</button></div>
    </div>
  )
}
