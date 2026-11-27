// Pure logic for the Exam Countdown Coach. No prediction claims: a plan + a simple readiness index.
export const DAY_MS = 86400000
export const startOfDay = t=>{ const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
export const dayKey = t=>{ const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") }
export function daysLeft(dateStr, now = Date.now()){
  if(!dateStr) return null
  const p = String(dateStr).split("-").map(Number)
  if(p.length !== 3 || p.some(isNaN)) return null
  return Math.round((new Date(p[0], p[1] - 1, p[2]).getTime() - startOfDay(now)) / DAY_MS)
}
export const PHASES = {
  build:    { key: "build",    label: "Build",    icon: "🧱", hint: "Cover the syllabus, make notes, learn the basics." },
  practice: { key: "practice", label: "Practice", icon: "🎯", hint: "Questions, PYQs and mocks. Fix weak topics." },
  revise:   { key: "revise",   label: "Revise",   icon: "🔁", hint: "Revision, formulas, Revenge Queue. No new topics." },
  final:    { key: "final",    label: "Final",    icon: "🔥", hint: "Light revision, rest, sleep. Trust your prep." },
  done:     { key: "done",     label: "Exam over", icon: "🏁", hint: "Set a new date to start the next goal." },
}
export function phaseOf(d){
  if(d == null) return null
  if(d < 0) return PHASES.done
  if(d <= 3) return PHASES.final
  if(d <= 14) return PHASES.revise
  if(d <= 60) return PHASES.practice
  return PHASES.build
}
// share of the day's minutes for each activity, per phase
const MIX = {
  build:    { learn: .45, practice: .25, weak: .15, revenge: .10, mock: 0, rest: .05 },
  practice: { learn: .15, practice: .35, weak: .20, revenge: .15, mock: .15, rest: 0 },
  revise:   { learn: .05, practice: .25, weak: .20, revenge: .25, mock: .20, rest: .05 },
  final:    { learn: 0, practice: .15, weak: .20, revenge: .35, mock: .10, rest: .20 },
}
const round5 = m=>Math.max(5, Math.round(m / 5) * 5)
/* inputs: { days, hours, due (revenge count), weak [{topic,acc,attempts}], mocks [{pct,at}], lastMockDaysAgo } */
export function buildPlan({ days, hours = 3, due = 0, weak = [], mocks = [], lastMockDaysAgo = null }){
  const ph = phaseOf(days)
  if(!ph || ph.key === "done") return []
  const total = Math.round(Math.max(0.5, Math.min(14, +hours || 3)) * 60)
  const mix = MIX[ph.key]
  const w = weak.filter(x=>x.attempts >= 2 && x.acc < 70)
  const tasks = []
  const add = (id, icon, text, share, go, fixed)=>{ const m = fixed || round5(total * share); if(share > 0 || fixed) tasks.push({ id, icon, text, min: m, go }) }
  // revenge queue: scale to due count (~1.5 min each), capped by its share
  if(due > 0){
    const cap = Math.max(10, round5(total * (mix.revenge + .1)))
    add("revenge", "⚔", `Clear Revenge Queue (${due} due)`, 1, "pyq", Math.min(cap, round5(due * 1.5)))
  } else if(mix.revenge >= .25){ add("revenge", "⚔", "Revenge Queue check (nothing due, quick glance)", 0, "pyq", 10) }
  if(w.length) add("weak", "🧩", `Fix weak topic: ${w[0].topic} (${w[0].acc}%)` + (w[1] ? ` + ${w[1].topic}` : ""), mix.weak, "weakspots")
  else if(mix.weak) add("weak", "🧩", "Practise your weakest topics (do a quiz first so MindLearn can find them)", mix.weak, "quiz")
  const mockDue = ph.key !== "build" && (lastMockDaysAgo == null || lastMockDaysAgo >= (ph.key === "final" ? 3 : ph.key === "revise" ? 3 : 7))
  if(mockDue) add("mock", "⏱", "Timed mock (PYQ paper, strict clock) + review mistakes", Math.max(mix.mock, .2), "pyq")
  add("practice", "📝", ph.key === "build" ? "Topic questions after each chapter" : "PYQ / MCQ practice set", mix.practice, "pyq")
  add("learn", "📖", ph.key === "final" ? "Quick formula / flashcard skim" : ph.key === "revise" ? "Revise notes + flashcards" : "New chapter / concept study", mix.learn, ph.key === "build" ? "chat" : "flashcards")
  if(mix.rest) add("rest", "🌿", "Break, walk, sleep on time", mix.rest, null)
  // fit into the budget: scale down proportionally if over
  const sum = tasks.reduce((a, t)=>a + t.min, 0)
  if(sum > total){ const k = total / sum; tasks.forEach(t=>{ t.min = Math.max(5, round5(t.min * k)) }) }
  return tasks
}
/* simple, transparent readiness index 0-100: accuracy 50%, mock avg 30%, revenge cleared 20%. Not a prediction. */
export function readiness({ weak = [], mocks = [], due = 0, queued = 0 }){
  const att = weak.reduce((a, x)=>a + x.attempts, 0), cor = weak.reduce((a, x)=>a + x.correct, 0)
  const acc = att >= 10 ? cor / att * 100 : null
  const recent = mocks.slice(-3)
  const mk = recent.length ? recent.reduce((a, m)=>a + (+m.pct || 0), 0) / recent.length : null
  const rv = queued > 0 ? Math.max(0, 100 - due / queued * 100) : null
  const parts = [[acc, .5], [mk, .3], [rv, .2]].filter(p=>p[0] != null)
  if(!parts.length) return null
  const wsum = parts.reduce((a, p)=>a + p[1], 0)
  return Math.round(parts.reduce((a, p)=>a + p[0] * p[1], 0) / wsum)
}
/* log: { "YYYY-MM-DD": { done:[taskIds] } } */
export function streak(log, now = Date.now()){
  let n = 0, t = startOfDay(now)
  if(!(log?.[dayKey(t)]?.done?.length)) t -= DAY_MS   // today not started yet doesn't break streak
  while(log?.[dayKey(t)]?.done?.length){ n++; t -= DAY_MS }
  return n
}
export function countdownLabel(d, exam = "Exam"){
  if(d == null) return ""
  if(d < 0) return `${exam} over`
  if(d === 0) return `${exam} is today`
  return `${exam} in ${d} day${d > 1 ? "s" : ""}`
}
