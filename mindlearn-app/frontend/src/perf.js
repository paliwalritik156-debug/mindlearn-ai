// Low-end / lite mode: auto-detect weak devices; user can override (ml_perf = auto | lite | full).
export function detectWeak(){
  try{
    const n = navigator
    if(n.connection?.saveData) return true
    if(n.hardwareConcurrency && n.hardwareConcurrency <= 4) return true
    if(n.deviceMemory && n.deviceMemory <= 4) return true
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true
  }catch(e){ /* ignore */ }
  return false
}
export function perfMode(){
  let pref = "auto"
  try{ const v = JSON.parse(localStorage.getItem("ml_perf") || '"auto"'); if(v === "lite" || v === "full") pref = v }catch(e){ /* ignore */ }
  return pref
}
export function isLite(){
  const p = perfMode()
  return p === "lite" || (p === "auto" && detectWeak())
}
export function applyPerf(){
  const on = isLite()
  document.documentElement.classList.toggle("lite", on)
  return on
}
