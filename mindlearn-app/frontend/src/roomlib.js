// Study Room: a shared Pomodoro clock inside a link. Everyone who opens the link sees the same phase and countdown
// because it is computed from one shared start time (no server). It relies on each device's clock being roughly right.
export const FOCUS_OPTS = [25, 45, 50], BREAK_OPTS = [5, 10]
const b64e = s=>{ const b = new TextEncoder().encode(s); let t = ""; b.forEach(c=>t += String.fromCharCode(c)); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }
const b64d = s=>{ const t = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(t, c=>c.charCodeAt(0))) }
export const encodeRoom = r=>b64e(JSON.stringify({ n: r.host, t: r.title, s: r.start, f: r.focus, b: r.brk, c: r.cycles }))
export function decodeRoom(str){
  try{
    const j = JSON.parse(b64d(str))
    const r = { host: String(j.n || "A friend").slice(0, 30), title: String(j.t || "Study session").slice(0, 60), start: +j.s, focus: +j.f, brk: +j.b, cycles: +j.c }
    if(!(r.start > 0) || !(r.focus >= 5 && r.focus <= 120) || !(r.brk >= 1 && r.brk <= 30) || !(r.cycles >= 1 && r.cycles <= 12)) return null
    return r
  }catch(e){ return null }
}
export const roomId = ()=>{ const m = /^#\/room\/([\w-]{20,600})$/.exec(typeof location !== "undefined" ? location.hash : ""); return m ? m[1] : null }
export const roomUrl = r=>location.origin + "/#/room/" + encodeRoom(r)
/* where are we at time `now`? returns { state:"waiting"|"focus"|"break"|"done", left (sec), cycle (1-based), total } */
export function phaseAt(r, now = Date.now()){
  const el = Math.floor((now - r.start) / 1000)
  if(el < 0) return { state: "waiting", left: -el, cycle: 0, total: r.cycles }
  const f = r.focus * 60, b = r.brk * 60, per = f + b
  const total = r.cycles * per - b            // no break after the last focus block
  if(el >= total) return { state: "done", left: 0, cycle: r.cycles, total: r.cycles }
  const cycle = Math.floor(el / per), into = el % per
  return into < f ? { state: "focus", left: f - into, cycle: cycle + 1, total: r.cycles } : { state: "break", left: per - into, cycle: cycle + 1, total: r.cycles }
}
export const clock = s=>`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
