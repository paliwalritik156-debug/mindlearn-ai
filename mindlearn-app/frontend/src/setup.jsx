import { useState } from "react"
import { useLocalState, toast } from "./lib.jsx"
import { EXAM_PRESETS, wizardResult } from "./v54lib.js"

/* One-time welcome setup: exam, date, daily hours -> fills Exam Coach and daily goal. */
export default function SetupWizard({ onDone }){
  const [, setCoach] = useLocalState("ml_coach", { exam: "NEET", date: "", hours: 4 })
  const [, setGoals] = useLocalState("ml_goals", { daily: 5, exam: null })
  const [, setDone] = useLocalState("ml_setup_done", false)
  const [exam, setExam] = useState("NEET")
  const [date, setDate] = useState("")
  const [hours, setHours] = useState(4)
  const today = new Date().toISOString().slice(0, 10)
  const save = ()=>{
    const r = wizardResult({ exam, date, hours })
    setCoach(r.coach); setGoals(g=>({ ...g, ...r.goals })); setDone(true)
    toast(date ? "Setup ho gaya! Exam Coach me tumhara plan ready hai ⏳" : "Setup ho gaya!", "success"); onDone?.(date ? "coach" : null)
  }
  const skip = ()=>{ setDone(true); onDone?.(null) }
  return (
    <div className="wizard-bg" role="dialog" aria-modal="true" aria-label="Welcome setup" data-testid="wizard">
      <div className="card wizard">
        <h2>Welcome! 👋 Do minute me set up karte hain</h2>
        <p>Tumhari padhai ke hisaab se MindLearn plan banayega. Baad me kabhi bhi badal sakte ho.</p>
        <label>Kis exam ki taiyari?<div className="room-opts">{Object.keys(EXAM_PRESETS).map(x=><button type="button" key={x} className={"chip" + (exam === x ? " on" : "")} onClick={()=>{ setExam(x); setHours(EXAM_PRESETS[x]) }}>{x}</button>)}</div></label>
        <label>Exam ki date (pata ho to)<input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)} /></label>
        <label>Roz kitne ghante padh paoge: <b>{hours}</b><input type="range" min="1" max="12" step="0.5" value={hours} onChange={e=>setHours(+e.target.value)} /></label>
        <div className="duel-actions"><button type="button" className="btn btn-p" onClick={save}>Save and start</button><button type="button" className="btn" onClick={skip}>Skip for now</button></div>
      </div>
    </div>
  )
}
