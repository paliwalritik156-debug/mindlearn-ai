import { useEffect, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useLocalState, toast } from "./lib.jsx"
import { weekSeries } from "./studytime.js"
import { getReminder, enableReminder, setReminder } from "./reminders.js"
import { perfMode, applyPerf, isLite } from "./perf.js"

const fmtT = s => s < 60 ? (s ? "<1m" : "0m") : s < 3600 ? Math.round(s/60) + "m" : Math.floor(s/3600) + "h " + String(Math.round((s%3600)/60)).padStart(2,"0") + "m"
const hr12 = h => (h % 12 || 12) + (h < 12 ? "am" : "pm")

/* ---------- study time analytics ---------- */
export function StudyTimeCard(){
  const [, force] = useState(0)
  useEffect(()=>{ const f = e=>{ if(e.detail === "ml_time") force(n=>n+1) }; window.addEventListener("ml-ls", f); return ()=>window.removeEventListener("ml-ls", f) },[])
  const { out, t } = weekSeries()
  const total = out.reduce((a, x)=>a + x.secs, 0)
  const max = Math.max(60, ...out.map(x=>x.secs))
  const bestH = t.hours.reduce((b, v, i)=>v > t.hours[b] ? i : b, 0)
  const topTab = Object.entries(t.tabs).sort((a, b)=>b[1] - a[1])[0]
  return (
    <div className="card st-card">
      <div className="st-head"><h3>⏱️ Study time</h3><span>{fmtT(total)} this week</span></div>
      <div className="st-bars" role="img" aria-label={"Study time per day this week: " + out.map(x=>x.d.toLocaleDateString(undefined,{weekday:"short"}) + " " + fmtT(x.secs)).join(", ")}>
        {out.map((x, i)=>(
          <div key={i} className="st-col" title={fmtT(x.secs)}>
            <i style={{ height: Math.max(3, Math.round(x.secs / max * 70)) + "px" }} className={i === 6 ? "today" : ""} />
            <span>{x.d.toLocaleDateString(undefined, { weekday:"narrow" })}</span>
          </div>
        ))}
      </div>
      <p className="st-foot">{total > 0 ? <>Best hour: <b>{hr12(bestH)}</b>{topTab && <> · Most time in <b>{topTab[0]}</b></>}</> : "Time is counted while you're actively studying. Come back after a session."}</p>
    </div>
  )
}

/* ---------- settings: speed mode + reminders ---------- */
export function SettingsExtras(){
  const [perf, setPerf] = useLocalState("ml_perf", "auto")
  const [rem, setRem] = useState(getReminder())
  const supported = typeof Notification !== "undefined"
  useEffect(()=>{ applyPerf() },[perf])
  async function toggle(on){
    if(!on){ const r = { ...rem, on:false }; setReminder(r); setRem(r); return }
    const res = await enableReminder(rem.time)
    if(res === "ok"){ setRem(getReminder()); toast("Reminder on. You'll get a nudge at " + rem.time + " while MindLearn is open.", "ok") }
    else toast(res === "unsupported" ? "This browser doesn't support notifications." : "Notifications are blocked. Allow them in your browser's site settings.", "error")
  }
  function setTime(time){ const r = { ...rem, time, lastDay:"" }; setRem(r); setReminder(r) }
  return (
    <div className="card set-card">
      <h3>Performance &amp; reminders</h3>
      <div className="set-row"><span>Speed mode</span>
        <div className="lang-seg-btns">{[["auto","Auto"],["lite","Lite"],["full","Full"]].map(([k, n])=>(<button key={k} className={perf === k ? "on" : ""} aria-pressed={perf === k} onClick={()=>setPerf(k)}>{n}</button>))}</div>
      </div>
      <p className="profile-email">Lite turns off 3D, blur and confetti for older phones. Auto picks it for you{isLite() ? " (currently Lite)" : ""}.</p>
      <div className="set-row"><span>Daily study reminder</span>
        {supported ? (
          <div className="lang-seg-btns"><button className={rem.on ? "on" : ""} onClick={()=>toggle(true)}>On</button><button className={!rem.on ? "on" : ""} onClick={()=>toggle(false)}>Off</button></div>
        ) : <b>Not supported</b>}
      </div>
      {supported && rem.on && <div className="set-row"><span>Remind me at</span><input className="sel" type="time" aria-label="Reminder time" value={rem.time} onChange={e=>setTime(e.target.value)} /></div>}
      <p className="profile-email">Reminders appear only while MindLearn is open in a tab (no background push yet).</p>
    </div>
  )
}

/* ---------- spotlight tour ---------- */
const STEPS = [
  { sel:".dash-menu-fab, .dash-sidebar", title:"All your tools", body:"Chat, quizzes, flashcards, planner and more live in the sidebar. On phones tap ☰." },
  { sel:".home-upload, .hw", title:"Start here", body:"Upload a PDF or ask a quick question. Your home screen shows what to do next." },
  { sel:".fun-header, .dash-main h2", title:"Your workspace", body:"Each tool opens here. Press ⌘K / Ctrl+K to jump to any tool by name." },
  { sel:".bottom-nav, .dash-sidebar", title:"Jump around fast", body:"Pin favourites with the ⭐ so they're one tap away. That's it, happy studying!" },
]
export function SpotTour(){
  const [on, setOn] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  useEffect(()=>{ const f = ()=>{ setI(0); setOn(true) }; window.addEventListener("ml-spot", f); return ()=>window.removeEventListener("ml-spot", f) },[])
  useLayoutEffect(()=>{
    if(!on) return
    const place = ()=>{
      const el = [...document.querySelectorAll(STEPS[i].sel)].find(e=>e.getBoundingClientRect().width > 0)
      if(el){ el.scrollIntoView({ block:"nearest" }); const r = el.getBoundingClientRect(); setRect({ x:r.left - 6, y:r.top - 6, w:r.width + 12, h:r.height + 12 }) } else setRect(null)
    }
    place(); window.addEventListener("resize", place); const id = setInterval(place, 500)
    return ()=>{ window.removeEventListener("resize", place); clearInterval(id) }
  },[on, i])
  useEffect(()=>{ if(!on) return; const k = e=>{ if(e.key === "Escape") done() }; window.addEventListener("keydown", k); return ()=>window.removeEventListener("keydown", k) },[on])
  function done(){ try{ localStorage.setItem("ml_spot_done", "1") }catch(e){ /* ignore */ }; setOn(false) }
  if(!on) return null
  const s = STEPS[i]
  const vh = window.innerHeight, vw = window.innerWidth
  const below = !rect || rect.y + rect.h + 190 < vh
  const style = rect ? { top: below ? rect.y + rect.h + 12 : Math.max(12, rect.y - 176), left: Math.min(Math.max(12, rect.x), vw - 312) } : { top:"40%", left:"calc(50% - 150px)" }
  return createPortal(
    <div className="spot-root" role="dialog" aria-modal="true" aria-label="Guided tour">
      {rect ? <div className="spot-hole" style={{ left:rect.x, top:rect.y, width:rect.w, height:rect.h }} /> : <div className="spot-dim" />}
      <div className="spot-pop" style={style}>
        <div className="tour-step">{i + 1} / {STEPS.length}</div>
        <h3>{s.title}</h3><p>{s.body}</p>
        <div className="tour-actions">
          <button className="btn btn-ghost btn-sm" onClick={done}>Skip</button>
          {i > 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setI(i - 1)}>Back</button>}
          <button className="btn btn-p btn-sm" onClick={()=>i === STEPS.length - 1 ? done() : setI(i + 1)}>{i === STEPS.length - 1 ? "Done" : "Next"}</button>
        </div>
      </div>
    </div>, document.body)
}
