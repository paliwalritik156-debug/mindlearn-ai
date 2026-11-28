// Study circle helpers (pure).
export const weekStart = (t = Date.now())=>{ const d = new Date(t); d.setHours(0, 0, 0, 0); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") }
/* weekly points from existing local data: 5 per activity, 30 per quiz, +20 for quiz >= 80% (same weights as XP) */
export function weekPoints(activity, scores, now = Date.now()){
  const wk0 = new Date(weekStart(now) + "T00:00:00").getTime()
  const a = (activity || []).filter(x=>x.at >= wk0).length
  const s = (scores || []).filter(x=>new Date(x.date).getTime() >= wk0)
  return a * 5 + s.length * 30 + s.filter(x=>(+x.pct || 0) >= 80).length * 20
}
export const normCode = s=>String(s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)
export const medal = i=>["🥇", "🥈", "🥉"][i] || String(i + 1)
// anonymous usage events: tool open only, never content or user id
export const evName = key=>"tool_open:" + String(key || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)
