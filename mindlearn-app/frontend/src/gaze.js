// Attention tracking (approximate). Pure logic: takes face-mesh landmarks, returns a state + running stats.
// Nothing here records or uploads video. It is a practice indicator, not proof of anything.
export const LM = { nose: 1, cheekL: 234, cheekR: 454, fore: 10, chin: 152, eyeLo: 33, eyeLi: 133, eyeRi: 362, eyeRo: 263, irisL: 468, irisR: 473 }
export const AWAY_MS = 1400        // looking away must last this long before it counts
export const CALIB_MS = 2000       // first seconds define "looking at the screen"
export const LIMITS = { yaw: 0.13, pitch: 0.11, iris: 0.14 }

const clamp = (v, a, b)=>Math.max(a, Math.min(b, v))

/** head turn / tilt / eye direction proxies from one face's landmarks (normalised coords) */
export function pose(lm){
  if(!lm || lm.length < 400) return null
  const g = i=>lm[i]
  const w = (g(LM.cheekR).x - g(LM.cheekL).x) || 1e-6
  const h = (g(LM.chin).y - g(LM.fore).y) || 1e-6
  const yaw = (g(LM.nose).x - g(LM.cheekL).x) / w - 0.5
  const pitch = (g(LM.nose).y - g(LM.fore).y) / h - 0.5
  let iris = 0
  if(lm.length > 473){
    const rel = (i, a, b)=>{ const s = (g(b).x - g(a).x) || 1e-6; return (g(i).x - g(a).x) / s - 0.5 }
    iris = (rel(LM.irisL, LM.eyeLo, LM.eyeLi) + rel(LM.irisR, LM.eyeRi, LM.eyeRo)) / 2
  }
  return { yaw, pitch, iris }
}

export class GazeTracker {
  constructor(){ this.reset() }
  reset(){
    this.t0 = null; this.last = null; this.base = null; this.cal = []
    this.awaySince = null; this.inAway = false
    this.state = "calibrating"
    this.s = { lookAwayCount: 0, awayMs: 0, noFaceMs: 0, multiCount: 0, multiMs: 0, okMs: 0, totalMs: 0, events: [] }
  }
  /** faces = array of landmark arrays; t = ms timestamp */
  update(faces, t){
    if(this.t0 == null) this.t0 = t
    const dt = this.last == null ? 0 : clamp(t - this.last, 0, 1000)
    this.last = t
    let st
    const n = faces ? faces.length : 0
    if(n === 0){ st = "noface"; this.awaySince = null; this.inAway = false }
    else if(n > 1){
      st = "multi"; this.awaySince = null; this.inAway = false
      if(this.state !== "multi"){ this.s.multiCount++; this.s.events.push({ t: t - this.t0, type: "multi" }) }
    } else {
      const p = pose(faces[0])
      if(!p){ st = "noface" }
      else if(!this.base){
        this.cal.push(p)
        if(t - this.t0 >= CALIB_MS && this.cal.length >= 5){
          const m = k=>this.cal.reduce((a, c)=>a + c[k], 0) / this.cal.length
          this.base = { yaw: m("yaw"), pitch: m("pitch"), iris: m("iris") }
        }
        st = "calibrating"
      } else {
        const dy = Math.abs(p.yaw - this.base.yaw), dp = Math.abs(p.pitch - this.base.pitch), di = Math.abs(p.iris - this.base.iris)
        const off = dy > LIMITS.yaw || dp > LIMITS.pitch || di > LIMITS.iris
        if(off){
          if(this.awaySince == null) this.awaySince = t
          if(t - this.awaySince >= AWAY_MS){
            st = "away"
            if(!this.inAway){ this.inAway = true; this.s.lookAwayCount++; this.s.events.push({ t: t - this.t0, type: "away" }) }
          } else st = this.state === "away" ? "away" : "ok"
        } else { this.awaySince = null; this.inAway = false; st = "ok" }
      }
    }
    if(st === "calibrating"){ /* not counted */ }
    else {
      this.s.totalMs += dt
      if(st === "ok") this.s.okMs += dt
      else if(st === "away") this.s.awayMs += dt
      else if(st === "noface") this.s.noFaceMs += dt
      else if(st === "multi") this.s.multiMs += dt
    }
    this.state = st
    return st
  }
  summary(){
    const s = this.s
    const focus = s.totalMs > 0 ? Math.round(s.okMs / s.totalMs * 100) : null
    return { focus, lookAwayCount: s.lookAwayCount, awaySecs: Math.round(s.awayMs / 1000), noFaceSecs: Math.round(s.noFaceMs / 1000), multiCount: s.multiCount, multiSecs: Math.round(s.multiMs / 1000), trackedSecs: Math.round(s.totalMs / 1000), calibrated: !!this.base }
  }
}

export function attentionVerdict(sm){
  if(!sm || !sm.calibrated || sm.trackedSecs < 8) return { level: "na", text: "Tracking ke liye data kam tha (camera ya roshni check karo)." }
  const flags = sm.lookAwayCount + sm.multiCount
  if(sm.multiCount > 0) return { level: "warn", text: "Frame me ek se zyada chehre dikhe. Real exam jaisa mahaul rakhne ke liye akele practise karo." }
  if(sm.focus >= 85 && flags <= 2) return { level: "good", text: "Bahut accha eye contact. Tum screen pe focused rahe." }
  if(sm.focus >= 65) return { level: "mid", text: "Theek tha. Kuch baar nazar hati. Camera/screen ki taraf dekhne ki aadat banao." }
  return { level: "warn", text: "Kaafi der nazar screen se hati rahi. Ho sakta hai notes ya doosri screen dekh rahe the, ya bas soch rahe the." }
}

export function chipText(state){
  return { calibrating: "Calibrating… screen ki taraf dekho", ok: "👀 Focused", away: "⚠ Nazar hat gayi", noface: "🙈 Chehra nahi dikh raha", multi: "👥 Ek se zyada chehre", off: "" }[state] || ""
}
