import { useState, useEffect, useRef, useMemo } from "react"
import { useLocalState, toast, pushNotif, sounds, FUN_META } from "./lib.jsx"
import { calcXp, levelOf, streakOf } from "./core.js"
import { useDueCount } from "./production.jsx"
import { getProfileGoal } from "./startup.jsx"

const go = k => window.dispatchEvent(new CustomEvent("ml-goto", { detail: k }))
const DAY = 86400000
const dk = t => new Date(t).toDateString()
const iso = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0") }

import { useUiLang, UiLangToggle, StickyCta } from "./lang.jsx"
export { useUiLang, UiLangToggle, StickyCta }

/* ---------------- leagues ---------------- */
export const LEAGUES = [
  { name:"Bronze", icon:"🥉", min:0 }, { name:"Silver", icon:"🥈", min:300 }, { name:"Gold", icon:"🥇", min:900 },
  { name:"Platinum", icon:"💠", min:2200 }, { name:"Diamond", icon:"💎", min:4500 },
]
export function leagueOf(xp){
  let i = 0; LEAGUES.forEach((l, n)=>{ if(xp >= l.min) i = n })
  const next = LEAGUES[i + 1]
  return { ...LEAGUES[i], next, pct: next ? Math.round((xp - LEAGUES[i].min) / (next.min - LEAGUES[i].min) * 100) : 100 }
}
export function LeagueCard({ activity }){
  const [scores] = useLocalState("ml_scores", [])
  const xp = calcXp(activity, scores), L = leagueOf(xp)
  useEffect(()=>{
    try{
      const prev = localStorage.getItem("ml_league")
      if(prev && prev !== L.name){ toast(`Promoted to ${L.name} league! ${L.icon}`, "ok"); pushNotif(`You reached the ${L.name} league ${L.icon}`, "🏆"); sounds.unlock() }
      localStorage.setItem("ml_league", L.name)
    }catch(e){}
  },[L.name])
  return (
    <div className="league-card">
      <div className="lg-ico" aria-hidden="true">{L.icon}</div>
      <div className="lg-main">
        <div className="lg-top"><b>{L.name} league</b><span>{L.next ? `${L.next.min - xp} XP to ${L.next.name}` : "Top league 🎉"}</span></div>
        <div className="lvl-bar"><div style={{ width: L.pct + "%" }} /></div>
        <div className="lg-steps" aria-hidden="true">{LEAGUES.map(l=><i key={l.name} className={xp >= l.min ? "on" : ""}>{l.icon}</i>)}</div>
      </div>
    </div>
  )
}

/* ---------------- score history chart ---------------- */
export function ScoreChart(){
  const [scores] = useLocalState("ml_scores", [])
  const pts = scores.slice(-12)
  if(pts.length < 2) return (
    <div className="chart-card"><div className="brief-head"><b>Quiz score trend</b><span>needs 2+ quizzes</span></div>
      <p className="profile-email" style={{ margin:0 }}>Take a couple of quizzes and your progress curve shows up here.</p>
      <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={()=>go("quiz")}>Take a quiz</button></div>
  )
  const W = 320, H = 110, P = 8
  const xy = pts.map((s, i)=>[P + i * (W - 2 * P) / (pts.length - 1), H - P - (Math.max(0, Math.min(100, +s.pct || 0)) / 100) * (H - 2 * P)])
  const line = xy.map((p, i)=>(i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")
  const area = line + ` L${xy[xy.length - 1][0].toFixed(1)} ${H - P} L${xy[0][0].toFixed(1)} ${H - P} Z`
  const avg = Math.round(pts.reduce((a, s)=>a + (+s.pct || 0), 0) / pts.length), best = Math.max(...pts.map(s=>+s.pct || 0))
  const half = Math.floor(pts.length / 2)
  const a1 = pts.slice(0, half).reduce((a, s)=>a + (+s.pct || 0), 0) / half, a2 = pts.slice(half).reduce((a, s)=>a + (+s.pct || 0), 0) / (pts.length - half)
  const diff = Math.round(a2 - a1)
  return (
    <div className="chart-card">
      <div className="brief-head"><b>Quiz score trend</b><span className={diff >= 0 ? "up" : "down"}>{diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}% vs earlier</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svg" role="img" aria-label={`Last ${pts.length} quiz scores. Average ${avg} percent, best ${best} percent.`}>
        <defs><linearGradient id="scg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--v)" stopOpacity=".35" /><stop offset="1" stopColor="var(--v)" stopOpacity="0" /></linearGradient></defs>
        {[25, 50, 75].map(v=><line key={v} x1={P} x2={W - P} y1={H - P - v / 100 * (H - 2 * P)} y2={H - P - v / 100 * (H - 2 * P)} className="sc-grid" />)}
        <path d={area} fill="url(#scg)" /><path d={line} className="sc-line" />
        {xy.map((p, i)=><circle key={i} cx={p[0]} cy={p[1]} r={i === xy.length - 1 ? 4 : 2.5} className="sc-dot" />)}
      </svg>
      <div className="sc-meta"><span>Avg <b>{avg}%</b></span><span>Best <b>{best}%</b></span><span>Latest <b>{Math.round(+pts[pts.length - 1].pct || 0)}%</b></span><span>Quizzes <b>{scores.length}</b></span></div>
    </div>
  )
}

/* ---------------- study planner ---------------- */
const SUBJ = {
  neet:["Physics","Chemistry","Biology"], jee:["Physics","Chemistry","Maths"], upsc:["Polity","History","Geography","Economy","Current Affairs"],
  college:["Core subject 1","Core subject 2","Core subject 3"], school:["Maths","Science","English","Social Science"], coding:["DSA","Projects","System design"], other:["Topic 1","Topic 2","Topic 3"],
}
export function buildPlan(exam, subjects, hours){
  if(!exam || !exam.date) return []
  const start = new Date(new Date().toDateString()), end = new Date(exam.date + "T00:00:00")
  const days = Math.max(0, Math.min(90, Math.round((end - start) / DAY)))
  const out = []
  const subs = subjects.length ? subjects : ["Revision"]
  for(let i = 0; i <= days; i++){
    const d = new Date(start.getTime() + i * DAY), left = days - i
    const tasks = []
    if(left === 0) tasks.push({ t:"Exam day — stay calm, quick glance at formula/notes sheet", k:"notes" })
    else if(left <= 2) tasks.push({ t:"Final revision — flashcards + weak spots", k:"srs" }, { t:"Take one full mock exam", k:"exam" })
    else {
      const s = subs[i % subs.length]
      tasks.push({ t:`Study ${s} (${hours}h)`, k:"chat" })
      tasks.push(i % 3 === 2 ? { t:"Mock exam / quiz to test the week", k:"exam" } : { t:`Quiz on ${s}`, k:"quiz" })
      if(i % 2 === 1) tasks.push({ t:"Review due flashcards", k:"srs" })
      if(i % 7 === 6) tasks.push({ t:"Weekly review: weak spots + report", k:"weakspots" })
    }
    out.push({ key: iso(d), date: d, left, tasks })
  }
  return out
}
function usePlan(){
  const [g] = useLocalState("ml_goals", { daily:5, exam:null })
  const [cfg, setCfg] = useLocalState("ml_plan", null)
  const [done, setDone] = useLocalState("ml_plan_done", {})
  const prof = getProfileGoal()
  const subjects = cfg?.subjects || SUBJ[prof] || SUBJ.other, hours = cfg?.hours || 2
  const plan = useMemo(()=>buildPlan(g.exam, subjects, hours), [g.exam?.date, subjects.join("|"), hours, new Date().toDateString()])
  const toggle = id=>setDone(d=>{ const n = { ...d }; if(n[id]) delete n[id]; else { n[id] = 1; sounds.tick && sounds.tick() } return n })
  return { g, cfg, setCfg, done, toggle, plan, subjects, hours }
}
export function PlannerTab(){
  const { g, setCfg, done, toggle, plan, subjects, hours } = usePlan()
  const [, setGoals] = useLocalState("ml_goals", { daily:5, exam:null })
  const [nm, setNm] = useState(g.exam?.name || ""), [dt, setDt] = useState(g.exam?.date || "")
  const [subs, setSubs] = useState(subjects.join(", ")), [hrs, setHrs] = useState(hours)
  const total = plan.reduce((a, d)=>a + d.tasks.length, 0), fin = plan.reduce((a, d)=>a + d.tasks.filter((_, i)=>done[d.key + ":" + i]).length, 0)
  const pct = total ? Math.round(fin / total * 100) : 0
  const saveExam = e=>{ e.preventDefault(); if(!dt){ toast("Pick your exam date.", "err"); return }
    setGoals({ ...g, exam:{ name: nm.trim() || "Exam", date: dt } })
    setCfg({ subjects: subs.split(",").map(s=>s.trim()).filter(Boolean).slice(0, 8), hours: Math.max(1, Math.min(10, +hrs || 2)) })
    toast("Plan created ✨", "ok") }
  const todayP = plan[0]
  return (
    <div className="planner">
      <form className="card plan-form" onSubmit={saveExam}>
        <h3>{g.exam ? "Edit your plan" : "Create your study plan"}</h3>
        <p className="profile-email">Tell us your exam date and subjects. We build a day-by-day plan with study, quiz and revision blocks.</p>
        <div className="plan-grid">
          <label>Exam name<input className="in" value={nm} onChange={e=>setNm(e.target.value)} placeholder="e.g. NEET 2027" /></label>
          <label>Exam date<input className="in" type="date" min={iso(Date.now())} value={dt} onChange={e=>setDt(e.target.value)} /></label>
          <label className="wide">Subjects (comma separated)<input className="in" value={subs} onChange={e=>setSubs(e.target.value)} /></label>
          <label>Study hours / day<input className="in" type="number" min="1" max="10" value={hrs} onChange={e=>setHrs(e.target.value)} /></label>
        </div>
        <button className="btn btn-p btn-sm" type="submit">{g.exam ? "Update plan" : "Generate plan"}</button>
      </form>
      {plan.length > 0 && (
        <>
          <div className="plan-sum">
            <div><b>{plan[0].left}</b><span>days left</span></div><div><b>{pct}%</b><span>plan done</span></div><div><b>{fin}/{total}</b><span>tasks</span></div>
            <div className="plan-bar"><div style={{ width: pct + "%" }} /></div>
          </div>
          <div className="plan-days">
            {plan.slice(0, 21).map((d, di)=>(
              <div key={d.key} className={"plan-day" + (di === 0 ? " today" : "")}>
                <div className="pd-head"><b>{di === 0 ? "Today" : di === 1 ? "Tomorrow" : d.date.toLocaleDateString(undefined, { weekday:"short", day:"numeric", month:"short" })}</b>{di === 0 && <span className="pd-tag">{d.left} days to go</span>}</div>
                {d.tasks.map((tk, i)=>{ const id = d.key + ":" + i; return (
                  <div key={id} className={"pd-task" + (done[id] ? " done" : "")}>
                    <label><input type="checkbox" checked={!!done[id]} onChange={()=>toggle(id)} /><span>{tk.t}</span></label>
                    <button className="btn btn-ghost btn-sm" onClick={()=>go(tk.k)}>Open</button>
                  </div>) })}
              </div>
            ))}
            {plan.length > 21 && <p className="profile-email" style={{ textAlign:"center" }}>+ {plan.length - 21} more days. They appear as the exam gets closer.</p>}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Today command center (home widget) ---------------- */
export function TodayCenter({ activity }){
  const { g, done, toggle, plan } = usePlan()
  const due = useDueCount()
  const [scores] = useLocalState("ml_scores", [])
  const [prof] = useLocalState("ml_profile", null)
  const [user] = useLocalState("ml_user", null)
  const today = (activity || []).filter(a=>dk(a.at) === dk(Date.now())).length
  const pct = Math.min(100, Math.round(today / Math.max(1, g.daily) * 100))
  const streak = streakOf(activity)
  const last = (activity || []).find(a=>a.k && a.k !== "Home")
  const hr = new Date().getHours(), greet = hr < 5 ? "Burning the midnight oil" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 21 ? "Good evening" : "Late-night study"
  const name = (user?.name || "").split(" ")[0]
  const tp = plan[0], tasks = tp ? tp.tasks.map((t, i)=>({ ...t, id: tp.key + ":" + i })) : []
  const R = 26, C = 2 * Math.PI * R
  // nudges
  const nudges = []
  const examDays = g.exam ? Math.round((new Date(g.exam.date + "T00:00:00") - new Date(new Date().toDateString())) / DAY) : null
  if(streak > 0 && today === 0) nudges.push({ i:"🔥", t:`Your ${streak}-day streak ends tonight`, a:"Save it", k:"flashcards" })
  const lastFlash = (activity || []).find(a=>a.k === "flashcards" || a.k === "srs")
  if(lastFlash && Date.now() - lastFlash.at > 3 * DAY) nudges.push({ i:"🗂️", t:`No flashcards for ${Math.floor((Date.now() - lastFlash.at) / DAY)} days`, a:"Review", k:"srs" })
  if(examDays !== null && examDays >= 0 && examDays <= 14) nudges.push({ i:"⏳", t:`${g.exam.name} in ${examDays} day${examDays === 1 ? "" : "s"}`, a:"Mock exam", k:"exam" })
  if(!g.exam) nudges.push({ i:"🗓️", t:"Set an exam date for a day-by-day plan", a:"Plan", k:"planner" })
  if(scores.length >= 3 && (+scores[scores.length - 1].pct || 0) < (+scores[scores.length - 2].pct || 0) - 15) nudges.push({ i:"📉", t:"Last quiz dipped — revisit weak spots", a:"Practise", k:"weakspots" })
  useEffect(()=>{
    try{
      if(hr >= 18 && streak > 0 && today === 0 && localStorage.getItem("ml_nudge_day") !== dk(Date.now())){
        localStorage.setItem("ml_nudge_day", dk(Date.now())); pushNotif(`Your ${streak}-day streak ends tonight. One quick quiz keeps it alive!`, "🔥")
      }
    }catch(e){}
  },[streak, today])
  const fin = tasks.filter(t=>done[t.id]).length
  return (
    <div className="today-card">
      <div className="tc-top">
        <div>
          <div className="tc-greet">{greet}{name ? ", " + name : ""} 👋</div>
          <div className="tc-sub">{prof?.goal ? "Preparing for " + prof.goal.toUpperCase() + " · " : ""}{streak ? `🔥 ${streak}-day streak` : "Start a streak today"}{due ? ` · 🔔 ${due} due` : ""}</div>
        </div>
        <div className="tc-ring" role="img" aria-label={`${today} of ${g.daily} daily actions done`}>
          <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r={R} className="tc-r0" /><circle cx="32" cy="32" r={R} className="tc-r1" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} /></svg>
          <b>{today}/{g.daily}</b>
        </div>
      </div>
      <button className="btn btn-p tc-continue" onClick={()=>go(last ? last.k : "chat")}>
        {last ? "▶ Continue where you left off" : "▶ Start studying"}<small>{FUN_META[last ? last.k : "chat"]?.title || (last ? last.k : "chat")}</small>
      </button>
      {tasks.length > 0 && (
        <div className="tc-tasks">
          <div className="brief-head"><b>Today's study plan</b><span>{fin}/{tasks.length} done</span></div>
          {tasks.map(t=>(
            <label key={t.id} className={"pd-task tc-task" + (done[t.id] ? " done" : "")}><input type="checkbox" checked={!!done[t.id]} onChange={()=>toggle(t.id)} /><span>{t.t}</span></label>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={()=>go("planner")}>Open full planner →</button>
        </div>
      )}
      {nudges.length > 0 && (
        <div className="tc-nudges" aria-label="Suggestions">
          {nudges.slice(0, 3).map(n=>(
            <button key={n.t} className="tc-nudge" onClick={()=>go(n.k)}><span>{n.i}</span><em>{n.t}</em><b>{n.a} →</b></button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- voice commands ---------------- */
const VOICE_MAP = [
  [/flash ?cards?|cards/, "flashcards"], [/notes?/, "notes"], [/quiz|test/, "quiz"], [/chat|ask|tutor/, "chat"], [/plan|planner|schedule/, "planner"],
  [/setting/, "settings"], [/library/, "library"], [/report/, "report"], [/pyq|past paper|previous year|old paper/, "pyq"], [/exam|mock/, "exam"], [/weak/, "weakspots"], [/pomodoro|timer/, "pomodoro"],
  [/home|overview|dashboard/, "Home"], [/map/, "map"], [/revi[sz]e|review|srs/, "srs"],
]
export function VoiceCommand({ onAction }){
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const [on, setOn] = useState(false)
  const rec = useRef(null)
  if(!SR) return null
  function run(text){
    const s = text.toLowerCase()
    if(/dark|light|theme|mode/.test(s) && !/open/.test(s)){ onAction("act:dark"); toast("Theme toggled.", "ok"); return }
    if(/focus|start.*(session|timer)|pomodoro start|timer start/.test(s)){ onAction("act:pomo"); return }
    if(/upload/.test(s)){ onAction("act:upload"); return }
    if(/shortcut|help/.test(s)){ onAction("act:shortcuts"); return }
    const hit = VOICE_MAP.find(([re])=>re.test(s))
    if(hit){ go(hit[1]); toast(`Opening ${hit[1] === "Home" ? "overview" : hit[1]} ✓`, "ok") }
    else toast(`Didn't catch a command in “${text}”. Try “open flashcards”.`, "err")
  }
  function toggle(){
    if(on){ rec.current && rec.current.stop(); return }
    try{
      const r = new SR(); r.lang = "en-IN"; r.interimResults = false; r.maxAlternatives = 1
      r.onresult = e=>run(e.results[0][0].transcript)
      r.onerror = e=>{ if(e.error === "not-allowed") toast("Microphone permission is blocked.", "err") }
      r.onend = ()=>setOn(false)
      rec.current = r; r.start(); setOn(true)
    }catch(e){ setOn(false) }
  }
  return <button className={"voice-cmd" + (on ? " on" : "")} aria-pressed={on} aria-label={on ? "Listening… tap to stop" : "Voice command"} title="Say: open flashcards, start focus, dark mode" onClick={toggle}>{on ? "🎙️" : "🎤"}{on && <i />}</button>
}
