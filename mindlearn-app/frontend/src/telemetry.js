// Optional analytics + error reporting. Does nothing unless the env vars are set.
import { SITE } from "./config.js"
let started = false
export function track(name, props){
  try{ if(window.plausible) window.plausible(name, props ? { props } : undefined) }catch(e){ /* ignore */ }
}
const API = import.meta.env.VITE_API_BASE || "http://localhost:8000"
const seen = new Set()
function reportToServer(err, where){
  // our own backend keeps a small error log (visible on the admin page). Max 8 distinct errors per visit.
  try{
    if(!API || seen.size >= 8) return
    const message = String(err?.message || err).slice(0, 300)
    if(seen.has(message)) return
    seen.add(message)
    fetch(API + "/log/error", { method:"POST", headers:{ "Content-Type":"application/json" }, keepalive:true,
      body: JSON.stringify({ message, stack: String(err?.stack || "").slice(0, 2000), page: (where ? where + " " : "") + location.hash }) }).catch(()=>{})
  }catch(e){ /* ignore */ }
}
export function reportError(err, where){
  reportToServer(err, where)
  if(!SITE.errorEndpoint) return
  try{
    const body = JSON.stringify({ message: String(err?.message || err), stack: String(err?.stack || "").slice(0, 2000), where: where || "", url: location.href, ua: navigator.userAgent, t: Date.now() })
    if(navigator.sendBeacon) navigator.sendBeacon(SITE.errorEndpoint, new Blob([body], { type:"text/plain" }))
    else fetch(SITE.errorEndpoint, { method:"POST", body, keepalive:true }).catch(()=>{})
  }catch(e){ /* ignore */ }
}
export function startTelemetry(){
  if(started) return; started = true
  if(SITE.plausibleDomain){
    const s = document.createElement("script")
    s.defer = true; s.setAttribute("data-domain", SITE.plausibleDomain); s.src = "https://plausible.io/js/script.js"
    document.head.appendChild(s)
    window.plausible = window.plausible || function(){ (window.plausible.q = window.plausible.q || []).push(arguments) }
  }
  window.addEventListener("error", ev=>reportError(ev.error || ev.message, "window.onerror"))
  window.addEventListener("unhandledrejection", ev=>reportError(ev.reason, "unhandledrejection"))
}
