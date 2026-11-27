import { useMemo } from "react"
import { useLocalState, weakStats, toast } from "./lib.jsx"
import { daysLeft, phaseOf, PHASES, buildPlan, readiness, streak, dayKey, countdownLabel, DAY_MS } from "./coach.js"
import { dueItems } from "./mistakes.js"

const EXAMS = ["NEET", "JEE", "Boards", "UPSC", "GATE", "CAT", "Other"]
const go = k=>window.dispatchEvent(new CustomEvent("ml-goto", { detail: k }))

export default function CoachTab(){
  const [cfg, setCfg] = useLocalState("ml_coach", { exam: "NEET", date: "", hours: 4 })
  const [log, setLog] = useLocalState("ml_coach_log", {})
  const now = Date.now()
  const d = daysLeft(cfg.date, now)
  const ph = phaseOf(d)
  const data = useMemo(()=>{
    let q = [], mocks = []
    try{ q = JSON.parse(localStorage.getItem("ml_revenge") || "[]") }catch(e){}
    try{ mocks = JSON.parse(localStorage.getItem("ml_pyq_mocks") || "[]") }catch(e){}
    const weak = weakStats()
    const due = dueItems(q).length
    const last = mocks.length ? Math.floor((now - mocks[mocks.length - 1].at) / DAY_MS) : null
    return { q, mocks, weak, due, last }
  }, [log, cfg])
  const plan = useMemo(()=>buildPlan({ days: d, hours: cfg.hours, due: data.due, weak: data.weak, mocks: data.mocks, lastMockDaysAgo: data.last }), [d, cfg.hours, data])
  const today = dayKey(now)
  const doneToday = log[today]?.done || []
  const ready = readiness({ weak: data.weak, mocks: data.mocks, due: data.due, queued: data.q.filter(x=>!x.mastered).length })
  const st = streak(log, now)
  const toggle = id=>{
    const set = new Set(doneToday); set.has(id) ? set.delete(id) : set.add(id)
    setLog(l=>({ ...l, [today]: { done: [...set] } }))
    if(!doneToday.includes(id) && doneToday.length + 1 === plan.filter(t=>t.go !== null || true).length) toast("Aaj ka plan complete 🎉")
  }
  const mins = plan.reduce((a, t)=>a + t.min, 0)
  const pct = plan.length ? Math.round(doneToday.filter(id=>plan.some(t=>t.id === id)).length / plan.length * 100) : 0
  return (
    <div className="coach">
      <div className="card coach-set">
        <label>Exam<select value={cfg.exam} onChange={e=>setCfg({ ...cfg, exam: e.target.value })}>{EXAMS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Exam date<input type="date" value={cfg.date} onChange={e=>setCfg({ ...cfg, date: e.target.value })} /></label>
        <label>Hours / day: <b>{cfg.hours}</b><input type="range" min="1" max="12" step="0.5" value={cfg.hours} onChange={e=>setCfg({ ...cfg, hours: +e.target.value })} /></label>
      </div>
      {d == null && <div className="card coach-empty">📅 Apni exam date daalo, MindLearn roz ka plan bana dega.</div>}
      {d != null && (
        <>
          <div className="card coach-hero" data-phase={ph.key}>
            <div className="coach-days"><b>{d < 0 ? "—" : d}</b><span>{d < 0 ? "exam over" : d === 1 ? "day left" : "days left"}</span></div>
            <div className="coach-info">
              <h3>{countdownLabel(d, cfg.exam)}</h3>
              <p><span className="chip">{ph.icon} {ph.label} phase</span> {ph.hint}</p>
              <div className="coach-phases">{["build", "practice", "revise", "final"].map(k=><i key={k} className={k === ph.key ? "on" : ""} title={PHASES[k].label}>{PHASES[k].icon}</i>)}</div>
            </div>
            <div className="coach-stats">
              <div><b>{ready == null ? "—" : ready}</b><span>Readiness index*</span></div>
              <div><b>🔥 {st}</b><span>day streak</span></div>
            </div>
          </div>
          {plan.length > 0 && (
            <div className="card coach-plan">
              <div className="coach-plan-head"><h3>Aaj ka plan</h3><span>{mins} min · {pct}% done</span></div>
              <div className="coach-bar"><i style={{ width: pct + "%" }} /></div>
              {plan.map(t=>(
                <div key={t.id} className={"coach-task" + (doneToday.includes(t.id) ? " done" : "")}>
                  <input type="checkbox" checked={doneToday.includes(t.id)} onChange={()=>toggle(t.id)} aria-label={t.text} />
                  <span className="ct-i">{t.icon}</span>
                  <span className="ct-t">{t.text}</span>
                  <span className="ct-m">{t.min} min</span>
                  {t.go && <button type="button" className="btn-sm" onClick={()=>go(t.go)}>Go →</button>}
                </div>
              ))}
            </div>
          )}
          <p className="coach-note">* Readiness index = your quiz accuracy, last 3 mock scores and Revenge Queue progress, mixed. Ye prediction ya rank nahi hai, sirf ek guide hai. Plan simple rules se bana hai (days left, due mistakes, weak topics, hours/day).</p>
        </>
      )}
    </div>
  )
}
