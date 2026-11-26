// Pure logic for the PYQ timed mock: marking schemes, scoring, clock.
export const SCHEMES = [
  { key: "neet", label: "NEET / JEE  (+4 / −1)", right: 4, wrong: -1 },
  { key: "plain", label: "Boards  (+1 / 0)", right: 1, wrong: 0 },
  { key: "half", label: "Competitive  (+1 / −0.25)", right: 1, wrong: -0.25 },
]
export const defaultMinutes = n=>Math.max(5, Math.round(n * 1.1))
export const fmtClock = s=>{ s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s % 60).padStart(2, "0") }
export function scorable(qs){ return (qs || []).filter(q=>q && q.answer && Array.isArray(q.options) && q.options.length >= 2) }
export function scoreMock(qs, picks, scheme, same){
  let right = 0, wrong = 0, skipped = 0
  const rows = (qs || []).map(q=>{
    const pick = picks?.[q.id]
    const status = !pick ? "skipped" : same(pick, q.answer) ? "right" : "wrong"
    if(status === "right") right++; else if(status === "wrong") wrong++; else skipped++
    return { q, pick: pick || null, status }
  })
  const score = Math.round((right * scheme.right + wrong * scheme.wrong) * 100) / 100
  const max = (qs || []).length * scheme.right
  return { right, wrong, skipped, score, max, pct: max ? Math.max(0, Math.round(score / max * 100)) : 0, rows }
}
export function topicBreakdown(rows){
  const m = {}
  rows.forEach(r=>{ const t = r.q.topic || "General"; const x = m[t] = m[t] || { topic: t, n: 0, right: 0 }; x.n++; if(r.status === "right") x.right++ })
  return Object.values(m).map(x=>({ ...x, pct: Math.round(x.right / x.n * 100) })).sort((a, b)=>a.pct - b.pct)
}
