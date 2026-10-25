// Active study-time tracker: counts seconds while the tab is visible and the user interacted in the last 60 s.
// Stored in ml_time = { days: { "YYYY-MM-DD": secs }, hours: [24 secs], tabs: { tabKey: secs } }
const K = "ml_time"
let last = Date.now(), tab = "Home", started = false
const iso = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth()+1).padStart(2,"0") + "-" + String(x.getDate()).padStart(2,"0") }
export function loadTime(){
  try{ const v = JSON.parse(localStorage.getItem(K) || "null"); if(v && v.days) return { hours: new Array(24).fill(0), tabs:{}, ...v } }catch(e){ /* ignore */ }
  return { days:{}, hours:new Array(24).fill(0), tabs:{} }
}
export function startStudyTimer(){
  if(started) return; started = true
  const bump = ()=>{ last = Date.now() }
  ;["pointerdown","keydown","scroll","touchstart"].forEach(ev=>window.addEventListener(ev, bump, { passive:true }))
  window.addEventListener("ml-tab", e=>{ tab = e.detail || "Home" })
  setInterval(()=>{
    if(document.hidden || Date.now() - last > 60000) return
    const t = loadTime(), now = new Date(), d = iso(now)
    t.days[d] = (t.days[d] || 0) + 10
    t.hours[now.getHours()] = (t.hours[now.getHours()] || 0) + 10
    t.tabs[tab] = (t.tabs[tab] || 0) + 10
    const keys = Object.keys(t.days).sort(); while(keys.length > 120) delete t.days[keys.shift()]
    try{ localStorage.setItem(K, JSON.stringify(t)); window.dispatchEvent(new CustomEvent("ml-ls", { detail:K })) }catch(e){ /* ignore */ }
  }, 10000)
}
export function weekSeries(){
  const t = loadTime(), out = []
  for(let i = 6; i >= 0; i--){ const d = new Date(Date.now() - i*86400000); out.push({ d, secs: t.days[iso(d)] || 0 }) }
  return { out, t }
}
