import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocalState, useDark, toast, sounds, pushNotif, applyTheme, THEMES, ACHIEVEMENTS, FUN_META } from "./lib.jsx"
import { calcXp, levelOf, streakOf, LevelCard, GoalsCard } from "./extras.jsx"
import { DueCard } from "./production.jsx"
import { QuickAsk, FirstWin } from "./docs.jsx"
import { WrappedCard, MemoryCard, QotdCard, useExamMode, ExamModeCard } from "./v24.jsx"
import { useApplyTheme, NotifCenter, LiveDemo, StoryScroll, FactsStrip, GrainMesh } from "./lite.jsx"
export { useApplyTheme, NotifCenter, LiveDemo, StoryScroll, FactsStrip, GrainMesh }
import { StudyTimeCard } from "./v28.jsx"
import { TodayCenter, LeagueCard, ScoreChart } from "./v22.jsx"
import { TodayBriefing, Checklist, InstallCard, Buddy, Recommended, Recap } from "./startup.jsx"

const DAY = 86400000
const dayKey = t => new Date(t).toDateString()
const notify = k => window.dispatchEvent(new CustomEvent("ml-ls", { detail: k }))

export function AccentPicker(){
  const [theme, setTheme] = useLocalState("ml_theme", "nova")
  return (
    <div className="accent-row" role="radiogroup" aria-label="Accent colour">
      {Object.entries(THEMES).map(([k, t])=>(
        <button key={k} role="radio" aria-checked={theme === k} aria-label={t.name} title={t.name} className={"accent-dot" + (theme === k ? " on" : "")}
          style={{ background:`linear-gradient(135deg, ${t.v}, ${t.cy})` }} onClick={()=>setTheme(k)} />
      ))}
    </div>
  )
}

/* ---------- notification center ---------- */
/* ---------- achievement engine ---------- */
function evaluate(activity, scores){
  const cnt = k => activity.filter(a=>a.k === k).length
  let chat = 0, notes = 0, pomo = 0
  try{ chat = JSON.parse(localStorage.getItem("ml_chat") || "[]").filter(m=>m.role === "user").length }catch(e){}
  try{ notes = JSON.parse(localStorage.getItem("ml_mynotes") || "[]").length }catch(e){}
  try{ pomo = +JSON.parse(localStorage.getItem("ml_pomodoro") || "0") || 0 }catch(e){}
  const st = streakOf(activity)
  return {
    first_upload: !!localStorage.getItem("ml_doc"),
    first_quiz: scores.length >= 1,
    streak_3: st >= 3,
    flash_10: cnt("flashcards") >= 10,
    chat_50: chat >= 50,
    night_owl: activity.some(a=>{ const h = new Date(a.at).getHours(); return h < 4 }),
    quiz_5: scores.length >= 5,
    quiz_ace: scores.some(s=>(+s.pct || 0) >= 90),
    week_streak: st >= 7,
    notes_3: notes >= 3,
    pomo_5: pomo >= 5,
    exam_1: cnt("exam") >= 1,
    lvl_5: levelOf(calcXp(activity, scores)).lvl >= 5,
  }
}
export function AchievementEngine({ activity }){
  const [unlocked, setUnlocked] = useLocalState("ml_achievements", [])
  const [scores] = useLocalState("ml_scores", [])
  const [queue, setQueue] = useState([])
  const [n, tick] = useState(0)
  const [onboarded] = useLocalState("ml_onboarded", false)
  useEffect(()=>{ const f = e=>{ if(e.detail === "ml_pomodoro" || e.detail === "ml_mynotes" || e.detail === "ml_chat" || e.detail === "ml_doc") tick(x=>x + 1) }; window.addEventListener("ml-ls", f); return ()=>window.removeEventListener("ml-ls", f) },[])
  useEffect(()=>{
    if(!onboarded) return
    const res = evaluate(activity, scores)
    const fresh = ACHIEVEMENTS.filter(a=>res[a.id] && !unlocked.includes(a.id))
    const seeded = localStorage.getItem("ml_ach_seeded")
    if(!seeded){
      // first run for an existing user: unlock what they already earned silently, no flood of popups
      localStorage.setItem("ml_ach_seeded", "1")
      if(fresh.length) setUnlocked(u=>[...new Set([...u, ...fresh.map(a=>a.id)])])
      return
    }
    if(!fresh.length) return
    setUnlocked(u=>[...new Set([...u, ...fresh.map(a=>a.id)])])
    setQueue(q=>[...q, ...fresh].slice(0, 3))
    fresh.forEach(a=>pushNotif(`Achievement unlocked: ${a.label}`, a.icon))
  },[activity.length, scores.length, n, onboarded])
  const cur = queue[0]
  useEffect(()=>{ if(!cur) return; sounds.unlock(); const t = setTimeout(()=>setQueue(q=>q.slice(1)), 5200); return ()=>clearTimeout(t) },[cur?.id])
  if(!cur) return null
  return createPortal(
    <div className="ach-overlay" onClick={()=>setQueue(q=>q.slice(1))} role="alertdialog" aria-label={`Achievement unlocked: ${cur.label}`}>
      <div className="ach-burst" aria-hidden="true">{Array.from({ length: 28 }).map((_, i)=>(<i key={i} style={{ "--a": (i / 28) * 360 + "deg", "--d": 90 + (i * 37) % 90 + "px", "--t": (i % 5) * 0.06 + "s", "--c": ["var(--v)","var(--cy)","#F472B6","#FBBF24"][i % 4] }} />))}</div>
      <div className="ach-card" onClick={e=>e.stopPropagation()}>
        <div className="ach-ring"><span>{cur.icon}</span></div>
        <small>ACHIEVEMENT UNLOCKED</small>
        <h3>{cur.label}</h3>
        <p>{cur.desc}</p>
        <button className="btn btn-p btn-sm" onClick={()=>setQueue(q=>q.slice(1))}>Nice!{queue.length > 1 ? ` (${queue.length - 1} more)` : ""}</button>
      </div>
    </div>, document.body)
}

/* ---------- heatmap ---------- */
export function HeatmapCard({ activity }){
  const WEEKS = 20
  const counts = {}; activity.forEach(a=>{ const k = dayKey(a.at); counts[k] = (counts[k] || 0) + 1 })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today.getTime() - ((WEEKS - 1) * 7 + today.getDay()) * DAY)
  const cols = []
  for(let w = 0; w < WEEKS; w++){
    const col = []
    for(let d = 0; d < 7; d++){
      const dt = new Date(start.getTime() + (w * 7 + d) * DAY)
      const n = dt > today ? -1 : (counts[dt.toDateString()] || 0)
      col.push({ dt, n })
    }
    cols.push(col)
  }
  const lvl = n => n <= 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4
  const total = Object.values(counts).reduce((a, b)=>a + b, 0), active = Object.keys(counts).length
  return (
    <div className="heat-card">
      <div className="heat-head"><b>Study activity</b><span>{total} actions · {active} active days</span></div>
      <div className="heat-grid" role="img" aria-label={`Activity heatmap, ${active} active days`}>
        {cols.map((c, i)=>(<div key={i}>{c.map((x, j)=>(<i key={j} className={x.n < 0 ? "fut" : "l" + lvl(x.n)} title={x.n < 0 ? "" : `${x.dt.toLocaleDateString()}: ${x.n} action${x.n === 1 ? "" : "s"}`} />))}</div>))}
      </div>
      <div className="heat-legend"><span>Less</span><i className="l0"/><i className="l1"/><i className="l2"/><i className="l3"/><i className="l4"/><span>More</span></div>
    </div>
  )
}

/* ---------- customisable home widgets ---------- */
const WIDGETS = { firstwin:"First summary (new uploads)", quickask:"Quick ask", exammode:"Exam mode (last 7 days)", today:"Today (command center)", wrapped:"Your week, wrapped", qotd:"Question of the day", memory:"Memory strength", recommended:"Recommended tools", recap:"Weekly recap (Sun & Mon)", buddy:"Study buddy", checklist:"Getting started", briefing:"Today's plan", install:"Install app", due:"Cards due", level:"Level & XP", league:"League", scores:"Quiz score trend", goals:"Goals & countdown", heatmap:"Activity heatmap", studytime:"Study time" }
export function HomeWidgets({ activity, goTo }){
  const [cfg, setCfg] = useLocalState("ml_widgets", { order: Object.keys(WIDGETS), hidden: [] })
  const [edit, setEdit] = useState(false)
  const em = useExamMode()
  const order = [...Object.keys(WIDGETS).filter(k=>!cfg.order.includes(k)), ...cfg.order.filter(k=>WIDGETS[k])]
  const move = (k, d)=>{ const i = order.indexOf(k), j = i + d; if(j < 0 || j >= order.length) return; const o = [...order]; [o[i], o[j]] = [o[j], o[i]]; setCfg({ ...cfg, order:o }) }
  const toggle = k=>setCfg({ ...cfg, order, hidden: cfg.hidden.includes(k) ? cfg.hidden.filter(x=>x !== k) : [...cfg.hidden, k] })
  const render = k => k === "studytime" ? <StudyTimeCard /> : k === "firstwin" ? <FirstWin /> : k === "quickask" ? <QuickAsk /> : k === "exammode" ? (em.active ? <ExamModeCard em={em} /> : null) : k === "wrapped" ? <WrappedCard /> : k === "qotd" ? <QotdCard /> : k === "memory" ? <MemoryCard /> : k === "today" ? <TodayCenter activity={activity} /> : k === "league" ? <LeagueCard activity={activity} /> : k === "scores" ? <ScoreChart /> : k === "recommended" ? <Recommended goTo={goTo} /> : k === "recap" ? <Recap activity={activity} /> : k === "buddy" ? <Buddy activity={activity} /> : k === "checklist" ? <Checklist activity={activity} /> : k === "briefing" ? <TodayBriefing activity={activity} /> : k === "install" ? <InstallCard /> : k === "due" ? <DueCard goTo={goTo} /> : k === "level" ? <LevelCard activity={activity} /> : k === "goals" ? <GoalsCard activity={activity} /> : <HeatmapCard activity={activity} />
  return (
    <div className="hw">
      <div className="hw-bar"><button className="btn btn-ghost btn-sm" aria-expanded={edit} onClick={()=>setEdit(e=>!e)}>{edit ? "Done" : "⚙ Customize home"}</button></div>
      {edit && (
        <div className="card hw-panel">
          {order.map((k, i)=>(
            <div key={k} className="hw-row">
              <label><input type="checkbox" checked={!cfg.hidden.includes(k)} onChange={()=>toggle(k)} /> {WIDGETS[k]}</label>
              <span><button aria-label={`Move ${WIDGETS[k]} up`} disabled={i === 0} onClick={()=>move(k, -1)}>↑</button><button aria-label={`Move ${WIDGETS[k]} down`} disabled={i === order.length - 1} onClick={()=>move(k, 1)}>↓</button></span>
            </div>
          ))}
        </div>
      )}
      {em.active
        ? ["exammode", "today", "due", "scores", "goals"].map(k=>(<div key={k}>{render(k)}</div>))
        : order.filter(k=>k !== "exammode" && !cfg.hidden.includes(k)).map(k=>(<div key={k}>{render(k)}</div>))}
      {em.within && !em.active && <div className="hw-bar"><button className="btn btn-ghost btn-sm" onClick={em.on}>🎯 Turn exam mode back on</button></div>}
    </div>
  )
}

/* ---------- pomodoro (global, with dock) ---------- */
const PK = "ml_pomo2"
function pLoad(){ try{ return { mode:"focus", total:1500, remaining:1500, running:false, endAt:0, ...JSON.parse(localStorage.getItem(PK) || "{}") } }catch(e){ return { mode:"focus", total:1500, remaining:1500, running:false, endAt:0 } } }
let P = pLoad()
function pSet(patch){ P = { ...P, ...patch }; try{ localStorage.setItem(PK, JSON.stringify(P)) }catch(e){}; window.dispatchEvent(new Event("ml-pomo")) }
function usePomo(){
  const [, f] = useState(0)
  useEffect(()=>{ const h = ()=>f(n=>n + 1); window.addEventListener("ml-pomo", h); return ()=>window.removeEventListener("ml-pomo", h) },[])
  return P
}
export const pomo = {
  start(){ pSet({ running:true, endAt: Date.now() + P.remaining * 1000 }) },
  pause(){ pSet({ running:false, remaining: Math.max(1, Math.ceil((P.endAt - Date.now()) / 1000)) }) },
  reset(secs){ const t = secs || P.total; pSet({ running:false, total:t, remaining:t, mode: P.mode }) },
  setMode(mode, secs){ pSet({ mode, running:false, total:secs, remaining:secs }) },
}
export function PomodoroRunner(){
  const p = usePomo()
  const [, t] = useState(0)
  useEffect(()=>{
    if(!p.running) return
    const id = setInterval(()=>{
      const rem = Math.ceil((P.endAt - Date.now()) / 1000)
      if(rem <= 0){
        if(P.mode === "focus"){
          try{ const n = (+JSON.parse(localStorage.getItem("ml_pomodoro") || "0") || 0) + 1; localStorage.setItem("ml_pomodoro", JSON.stringify(n)); notify("ml_pomodoro") }catch(e){}
          toast("Focus session complete. Take a 5-minute break. ☕", "ok"); pushNotif("Focus session complete. Time for a break.", "⏱️"); sounds.success()
          pSet({ mode:"break", total:300, remaining:300, running:false })
        }else{
          toast("Break over. Ready for another round?", "ok"); sounds.pop()
          pSet({ mode:"focus", total:1500, remaining:1500, running:false })
        }
      }else t(n=>n + 1)
    }, 500)
    return ()=>clearInterval(id)
  },[p.running])
  return null
}
const left = p => p.running ? Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000)) : p.remaining
const fmt = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0")
export function PomodoroDock({ goTo }){
  const p = usePomo()
  const started = p.running || p.remaining !== p.total
  if(!started) return null
  return (
    <div className={"pomo-dock " + p.mode} role="timer" aria-label={`${p.mode} timer`}>
      <button className="pd-main" onClick={()=>goTo("pomodoro")} title="Open timer"><span>{p.mode === "focus" ? "🎯" : "☕"}</span><b>{fmt(left(p))}</b></button>
      <button aria-label={p.running ? "Pause timer" : "Resume timer"} onClick={()=>p.running ? pomo.pause() : pomo.start()}>{p.running ? "⏸" : "▶"}</button>
      <button aria-label="Reset timer" onClick={()=>pomo.reset()}>↺</button>
    </div>
  )
}
export function PomodoroTab(){
  const p = usePomo()
  const [sessions] = useLocalState("ml_pomodoro", 0)
  const [, t] = useState(0)
  useEffect(()=>{ const id = setInterval(()=>t(n=>n + 1), 500); return ()=>clearInterval(id) },[])
  const R = 92, C = 2 * Math.PI * R, rem = left(p), pct = 1 - rem / p.total
  const presets = p.mode === "focus" ? [[25, "Pomodoro"], [50, "Deep work"], [15, "Quick"]] : [[5, "Short"], [10, "Long"]]
  return (
    <div className="card pomo-card">
      <div className="lang-seg-btns" style={{ alignSelf:"center" }}>
        <button className={p.mode === "focus" ? "on" : ""} onClick={()=>pomo.setMode("focus", 1500)}>Focus</button>
        <button className={p.mode === "break" ? "on" : ""} onClick={()=>pomo.setMode("break", 300)}>Break</button>
      </div>
      <div className="pomo-ring">
        <svg viewBox="0 0 200 200" width="240" height="240" aria-hidden="true">
          <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--cy)"/><stop offset="1" stopColor="var(--v)"/></linearGradient></defs>
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(var(--v-rgb),.16)" strokeWidth="10" />
          <circle cx="100" cy="100" r={R} fill="none" stroke="url(#pg)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 100 100)" style={{ transition:"stroke-dashoffset .5s linear" }} />
        </svg>
        <div className="pomo-time" aria-live="off"><b>{fmt(rem)}</b><small>{p.mode === "focus" ? "focus" : "break"}</small></div>
      </div>
      <div className="row-actions" style={{ justifyContent:"center" }}>
        <button className="btn btn-p" onClick={()=>p.running ? pomo.pause() : pomo.start()}>{p.running ? "Pause" : rem < p.total ? "Resume" : "Start"}</button>
        <button className="btn btn-ghost" onClick={()=>pomo.reset()}>Reset</button>
      </div>
      <div className="lang-seg-btns" style={{ alignSelf:"center" }}>{presets.map(([m, n])=>(<button key={m} className={p.total === m * 60 ? "on" : ""} onClick={()=>pomo.setMode(p.mode, m * 60)}>{m} min · {n}</button>))}</div>
      <AmbiencePicker />
      <p className="profile-email" style={{ textAlign:"center" }}>Completed focus sessions: {sessions}. The timer keeps running while you use other tools.</p>
    </div>
  )
}

/* ---------- focus ambience (generated in the browser, no audio files) ---------- */
let AMB = null
function ambCtx(){ const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; if(!AMB) AMB = { ctx:new C(), nodes:null, type:"off", vol:.5 }; if(AMB.ctx.state === "suspended") AMB.ctx.resume().catch(()=>{}); return AMB }
function noiseBuf(ctx, kind){
  const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0)
  let last = 0
  for(let i = 0; i < len; i++){ const w = Math.random() * 2 - 1; if(kind === "brown"){ last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 } else d[i] = w }
  return b
}
export const ambience = {
  types: { off:"Off", rain:"Rain", brown:"Brown noise", white:"White noise", calm:"Calm pad" },
  stop(){
    if(!AMB || !AMB.nodes) return
    const { ctx, nodes } = AMB, t = ctx.currentTime
    try{ nodes.master.gain.cancelScheduledValues(t); nodes.master.gain.setTargetAtTime(0, t, 0.25) }catch(e){}
    const old = nodes; AMB.nodes = null
    setTimeout(()=>{ try{ old.srcs.forEach(s=>s.stop()) }catch(e){} }, 900)
  },
  play(type, vol = .5){
    this.stop(); if(type === "off"){ if(AMB) AMB.type = "off"; return }
    const A = ambCtx(); if(!A) return
    const { ctx } = A, master = ctx.createGain(), srcs = []
    master.gain.value = 0; master.connect(ctx.destination)
    const noise = kind => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, kind); s.loop = true; srcs.push(s); return s }
    if(type === "rain"){
      const n = noise("white"), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain()
      hp.type = "highpass"; hp.frequency.value = 900; lp.type = "lowpass"; lp.frequency.value = 7500; g.gain.value = .35
      n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master)
      const b = noise("brown"), bl = ctx.createBiquadFilter(), bg = ctx.createGain(); bl.type = "lowpass"; bl.frequency.value = 500; bg.gain.value = .5
      b.connect(bl); bl.connect(bg); bg.connect(master)
    }else if(type === "brown"){ const n = noise("brown"), g = ctx.createGain(); g.gain.value = .9; n.connect(g); g.connect(master) }
    else if(type === "white"){ const n = noise("white"), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 9000; g.gain.value = .35; n.connect(lp); lp.connect(g); g.connect(master) }
    else if(type === "calm"){
      [110, 164.8, 220, 277.2].forEach((f, k)=>{
        const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain()
        o.type = "sine"; o.frequency.value = f * (1 + (k - 1.5) * 0.0015); g.gain.value = .07
        l.frequency.value = .08 + k * .03; lg.gain.value = .05; l.connect(lg); lg.connect(g.gain)
        o.connect(g); g.connect(master); srcs.push(o, l)
      })
    }
    srcs.forEach(s=>s.start())
    master.gain.setTargetAtTime(vol * .6, ctx.currentTime, 0.5)
    A.nodes = { master, srcs }; A.type = type; A.vol = vol
  },
  setVol(v){ if(AMB && AMB.nodes) AMB.nodes.master.gain.setTargetAtTime(v * .6, AMB.ctx.currentTime, .1); if(AMB) AMB.vol = v },
  get type(){ return AMB ? AMB.type : "off" },
  get vol(){ return AMB ? AMB.vol : .5 },
}
function AmbiencePicker(){
  const [type, setType] = useState(ambience.type), [vol, setVol] = useState(ambience.vol)
  return (
    <div className="amb-box">
      <b>🎧 Focus sound</b>
      <div className="lang-seg-btns" role="radiogroup" aria-label="Focus sound">
        {Object.entries(ambience.types).map(([k, n])=>(<button key={k} role="radio" aria-checked={type === k} className={type === k ? "on" : ""} onClick={()=>{ setType(k); ambience.play(k, vol) }}>{n}</button>))}
      </div>
      <label className="amb-vol">Volume<input type="range" min="0.05" max="1" step="0.05" value={vol} aria-label="Focus sound volume" onChange={e=>{ const v = +e.target.value; setVol(v); ambience.setVol(v) }} /></label>
      <p className="profile-email" style={{ margin:0 }}>Generated in your browser. No audio files, works offline.</p>
    </div>
  )
}

/* ---------- route progress bar ---------- */
export function RouteBar({ k }){
  return <div className="route-bar" key={k} aria-hidden="true"><i /></div>
}

/* ---------- command palette actions ---------- */
export const PALETTE_ACTIONS = [
  { k:"act:tour", title:"Take the guided tour", icon:"🧭", tag:"Help" },
  { k:"act:wrapped", title:"Watch your week, wrapped", icon:"✨", tag:"Stories" },
  { k:"act:share", title:"Share my progress card", icon:"📤", tag:"Image" },
  { k:"act:dark", title:"Toggle dark / light mode", icon:"🌗", tag:"Appearance" },
  { k:"act:focus", title:"Toggle focus mode", icon:"⛶", tag:"Hide the sidebar" },
  { k:"act:upload", title:"Upload a PDF", icon:"📄", tag:"Choose a file" },
  { k:"act:pomo", title:"Start a focus session", icon:"🎯", tag:"25-minute timer" },
  { k:"act:lang-en", title:"Answer in English", icon:"🇬🇧", tag:"Language" },
  { k:"act:lang-hinglish", title:"Answer in Hinglish", icon:"💬", tag:"Language" },
  { k:"act:lang-hi", title:"Answer in हिन्दी", icon:"🇮🇳", tag:"Language" },
  { k:"act:shortcuts", title:"Show keyboard shortcuts", icon:"⌨️", tag:"Press ?" },
  { k:"act:backup", title:"Download a backup", icon:"💾", tag:"Settings" },
  { k:"act:logout", title:"Log out", icon:"⏻", tag:"Account" },
]

