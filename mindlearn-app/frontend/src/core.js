import { toast } from "./lib.jsx"
export const DAY = 86400000
export const dayKey = t => new Date(t).toDateString()

/* ---------- XP / level ---------- */
export const LEVELS = ["Newbie","Curious","Learner","Scholar","Strategist","Sage","Mastermind","Legend"]
export function calcXp(activity, scores){
  return (activity?.length || 0) * 5 + (scores?.length || 0) * 30 + (scores || []).filter(s=>(+s.pct||0) >= 80).length * 20
}
export function levelOf(xp){
  const lvl = Math.floor(Math.sqrt(xp / 60)) + 1
  const base = Math.pow(lvl - 1, 2) * 60, next = Math.pow(lvl, 2) * 60
  return { lvl, title: LEVELS[Math.min(lvl - 1, LEVELS.length - 1)], pct: Math.round((xp - base) / (next - base) * 100), toNext: next - xp }
}
export function streakOf(activity){
  const days = new Set((activity || []).map(a=>dayKey(a.at)))
  let n = 0, t = Date.now()
  if(!days.has(dayKey(t))) t -= DAY
  while(days.has(dayKey(t))){ n++; t -= DAY }
  return n
}

export function saveToNotes(title, body){
  try{
    const list = JSON.parse(localStorage.getItem("ml_mynotes") || "[]")
    list.unshift({ id: Date.now().toString(36), title: title || "Untitled", body, at: Date.now() })
    localStorage.setItem("ml_mynotes", JSON.stringify(list))
    window.dispatchEvent(new CustomEvent("ml-ls", { detail:"ml_mynotes" }))
    toast("Saved to My Notes.", "ok")
  }catch(e){ toast("Couldn't save the note.", "error") }
}
