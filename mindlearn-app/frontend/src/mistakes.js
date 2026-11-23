/* Mistake DNA + Revenge Queue: pure logic (no React, no network) so it can be unit-tested. */

export const CAUSES = [
  { key: "concept", icon: "🤷", en: "Didn't know the concept", hi: "Concept nahi aata tha" },
  { key: "silly",   icon: "😵", en: "Silly mistake",           hi: "Silly mistake" },
  { key: "rush",    icon: "⏱",  en: "Rushed / ran out of time", hi: "Jaldi me / time kam pada" },
  { key: "guess",   icon: "🎲", en: "Guessed",                 hi: "Guess kiya" },
]
export const causeLabel = (k, lang = "en")=>{ const c = CAUSES.find(x=>x.key === k); return c ? (lang === "en" ? c.en : c.hi) : "" }

export const DAY = 86400000
export const BOX_DAYS = [1, 3, 7, 14, 30]       // Leitner: how long to wait after each correct review
export const LOG_MAX = 300
export const QUEUE_MAX = 150

/* ---------- answer log (one entry per answered question) ---------- */
export function pushLog(log, e){
  const rest = (log || []).filter(x=>!(x.id === e.id && x.at === e.at))
  rest.push({ id: e.id, topic: e.topic || "General", ok: !!e.ok, cause: e.cause || null, secs: Math.max(0, Math.round(e.secs || 0)), at: e.at })
  return rest.slice(-LOG_MAX)
}
export function setLogCause(log, id, cause){
  // the newest wrong entry of this question
  const i = [...(log || [])].map((x, j)=>[x, j]).reverse().find(([x])=>x.id === id && !x.ok)?.[1]
  if(i == null) return log
  const out = log.slice(); out[i] = { ...out[i], cause }; return out
}

/* ---------- revenge queue ---------- */
export function addToQueue(queue, item, now = Date.now()){
  const q = (queue || []).slice()
  const i = q.findIndex(x=>x.id === item.id)
  if(i >= 0){
    q[i] = { ...q[i], ...item, box: 0, due: now + DAY, misses: (q[i].misses || 1) + 1, mastered: false }
  }else{
    q.push({ ...item, box: 0, due: now + DAY, misses: 1, mastered: false, twinWins: 0, added: now })
  }
  return q.slice(-QUEUE_MAX)
}
export const dueItems = (queue, now = Date.now())=>(queue || []).filter(x=>!x.mastered && x.due <= now).sort((a, b)=>a.due - b.due)
export const waitingItems = (queue, now = Date.now())=>(queue || []).filter(x=>!x.mastered && x.due > now).sort((a, b)=>a.due - b.due)
export function gradeItem(queue, id, ok, now = Date.now()){
  return (queue || []).map(x=>{
    if(x.id !== id) return x
    if(!ok) return { ...x, box: 0, due: now + DAY, misses: (x.misses || 1) + 1 }
    const box = x.box + 1
    if(box >= BOX_DAYS.length) return { ...x, box, mastered: true, due: Infinity }
    return { ...x, box, due: now + BOX_DAYS[box] * DAY }
  })
}
export const setItemField = (queue, id, patch)=>(queue || []).map(x=>x.id === id ? { ...x, ...patch } : x)
// due dates are stored as numbers; Infinity does not survive JSON, so mastered items carry due:null
export const normaliseQueue = q=>(q || []).map(x=>x.mastered ? { ...x, due: Number.isFinite(x.due) ? x.due : 0 } : x)
export function daysUntil(due, now = Date.now()){ const d = Math.ceil((due - now) / DAY); return d <= 0 ? 0 : d }

/* ---------- Mistake DNA ---------- */
const mean = a=>a.length ? a.reduce((s, x)=>s + x, 0) / a.length : 0
export function mistakeDna(log, lang = "en"){
  const L = (log || [])
  const wrong = L.filter(x=>!x.ok), right = L.filter(x=>x.ok)
  const caused = wrong.filter(x=>x.cause)
  const byCause = CAUSES.map(c=>{ const count = caused.filter(x=>x.cause === c.key).length; return { key: c.key, icon: c.icon, count, pct: caused.length ? count / caused.length : 0 } }).sort((a, b)=>b.count - a.count)
  const avgRight = Math.round(mean(right.map(x=>x.secs).filter(Boolean)))
  const avgWrong = Math.round(mean(wrong.map(x=>x.secs).filter(Boolean)))
  const topics = {}
  L.forEach(x=>{ const t = topics[x.topic] = topics[x.topic] || { topic: x.topic, total: 0, wrong: 0, causes: {} }; t.total++; if(!x.ok){ t.wrong++; if(x.cause) t.causes[x.cause] = (t.causes[x.cause] || 0) + 1 } })
  const topTopics = Object.values(topics).filter(t=>t.wrong > 0).map(t=>({ topic: t.topic, wrong: t.wrong, total: t.total, cause: Object.entries(t.causes).sort((a, b)=>b[1] - a[1])[0]?.[0] || null })).sort((a, b)=>b.wrong - a.wrong).slice(0, 5)
  const enough = L.length >= 5 && wrong.length >= 2
  const hi = lang !== "en"
  const advice = []
  const dom = byCause[0]
  if(enough && caused.length >= 2 && dom.pct >= 0.4){
    const pc = Math.round(dom.pct * 100)
    const T = {
      concept: hi ? `Tumhari ${pc}% galtiyan concept gap ki hain. Sawal solve karne se pehle us topic ki theory dobara padho, phir PYQ karo.` : `${pc}% of your misses are concept gaps. Re-read the theory of those topics first, then do PYQs again.`,
      silly:   hi ? `Tumhari ${pc}% galtiyan silly mistakes hain, matlab concept aata hai. Zyada padhne se nahi, dheere solve karne se sudhrega: sawal aur options do baar padho, units aur negative sign check karo.` : `${pc}% of your misses are silly mistakes, so you know the concept. More reading won't fix it; slowing down will: read the question and options twice, check units and signs.`,
      rush:    hi ? `Tumhari ${pc}% galtiyan jaldi me hui hain. Har sawal ke liye ek time limit tay karo; atak jao to skip karke baad me wapas aao.` : `${pc}% of your misses come from rushing or running out of time. Set a per-question time limit and skip-and-return when stuck.`,
      guess:   hi ? `Tumhari ${pc}% galtiyan guess ki hain. Guess karne se pehle kam se kam 1-2 galat options kaato (elimination).` : `${pc}% of your misses were guesses. Eliminate at least one or two options before guessing.`,
    }
    advice.push(T[dom.key])
  }
  if(enough && avgRight && avgWrong){
    if(avgWrong < avgRight * 0.6) advice.push(hi ? `Galat jawab sirf ${avgWrong}s me diye gaye, sahi wale ${avgRight}s me. Tum jin sawalon me galti karte ho unhe bahut jaldi nipta rahe ho.` : `Your wrong answers took ${avgWrong}s on average vs ${avgRight}s for right ones. You're answering the ones you miss too fast.`)
    else if(avgWrong > avgRight * 1.5) advice.push(hi ? `Galat sawalon par ${avgWrong}s lag rahe hain, sahi par ${avgRight}s. Atak jao to jaldi skip karna seekho.` : `You spend ${avgWrong}s on questions you get wrong vs ${avgRight}s on right ones. Learn to skip early when stuck.`)
  }
  const worst = topTopics.find(t=>t.wrong >= 2)
  if(enough && worst) advice.push(hi ? `Sabse bada leak: ${worst.topic} (${worst.wrong} galtiyan${worst.cause ? ", zyadatar " + causeLabel(worst.cause, "hi") : ""}).` : `Biggest leak: ${worst.topic} (${worst.wrong} misses${worst.cause ? ", mostly " + causeLabel(worst.cause, "en").toLowerCase() : ""}).`)
  return { n: L.length, wrong: wrong.length, accuracy: L.length ? Math.round(right.length / L.length * 100) : 0, byCause, avgRight, avgWrong, topTopics, advice, enough, tagged: caused.length }
}
