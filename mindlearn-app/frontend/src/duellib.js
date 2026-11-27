// Pure helpers for Duel: a 1v1 quiz that travels inside a link (no server needed).
export const DUEL_N = 5
export function duelPrompt(topic, n = DUEL_N){
  return `Create exactly ${n} multiple-choice questions to test knowledge of: "${topic}". Mix easy and medium. Each has 4 options and exactly one correct option.
Reply with ONLY JSON: [{"q":"question","o":["A","B","C","D"],"a":0}] where "a" is the index (0-3) of the correct option. No markdown, no commentary.`
}
export function parseDuelQs(v){
  const arr = Array.isArray(v) ? v : (v && Array.isArray(v.questions) ? v.questions : [])
  return arr.map(x=>{
    const o = Array.isArray(x?.o || x?.options) ? (x.o || x.options).map(s=>String(s).slice(0, 140)) : []
    let a = x?.a ?? x?.answer
    if(typeof a === "string" && /^[A-D]$/i.test(a.trim())) a = a.trim().toUpperCase().charCodeAt(0) - 65
    a = +a
    return { q: String(x?.q || x?.question || "").slice(0, 300), o: o.slice(0, 4), a }
  }).filter(x=>x.q && x.o.length === 4 && Number.isInteger(x.a) && x.a >= 0 && x.a < 4).slice(0, 10)
}
export function score(qs, picks){ return qs.reduce((n, q, i)=>n + (picks[i] === q.a ? 1 : 0), 0) }
const b64e = s=>{ const b = new TextEncoder().encode(s); let t = ""; b.forEach(c=>t += String.fromCharCode(c)); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }
const b64d = s=>{ const t = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(t, c=>c.charCodeAt(0))) }
export function encodeDuel(d){ return b64e(JSON.stringify({ t: d.title, n: d.name, q: d.qs.map(x=>[x.q, ...x.o, x.a]), s: d.score, m: d.secs })) }
export function decodeDuel(str){
  try{
    const j = JSON.parse(b64d(str))
    const qs = (j.q || []).map(r=>({ q: String(r[0]), o: r.slice(1, 5).map(String), a: +r[5] }))
    if(!qs.length || qs.some(x=>x.o.length !== 4 || !(x.a >= 0 && x.a < 4))) return null
    return { title: String(j.t || "Quiz"), name: String(j.n || "A friend").slice(0, 30), qs, score: +j.s || 0, secs: +j.m || 0 }
  }catch(e){ return null }
}
export const duelId = ()=>{ const m = /^#\/duel\/([\w-]{20,6000})$/.exec(typeof location !== "undefined" ? location.hash : ""); return m ? m[1] : null }
export const duelUrl = d=>location.origin + "/#/duel/" + encodeDuel(d)
/* winner by score, then faster time; exact tie = draw */
export function verdict(mine, theirs){
  if(mine.score !== theirs.score) return mine.score > theirs.score ? "win" : "lose"
  if(mine.secs && theirs.secs && mine.secs !== theirs.secs) return mine.secs < theirs.secs ? "win" : "lose"
  return "draw"
}
export const shareText = (name, title, s, n, secs, v)=>`⚔ MindLearn Duel: "${title}"\n${name}: ${s}/${n} in ${secs}s (${v === "win" ? "I won" : v === "lose" ? "you won" : "draw"})`
