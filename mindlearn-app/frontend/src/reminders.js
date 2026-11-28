// Study reminders. Web push (works with the app closed) when the server supports it, otherwise a notification while the app is open.
import { api } from "./lib.jsx"
const K = "ml_reminder"
export function getReminder(){ try{ return JSON.parse(localStorage.getItem(K) || "null") || { on:false, time:"19:00" } }catch(e){ return { on:false, time:"19:00" } } }
export function setReminder(r){ try{ localStorage.setItem(K, JSON.stringify(r)); window.dispatchEvent(new CustomEvent("ml-ls", { detail:K })) }catch(e){ /* ignore */ } }
export async function enableReminder(time){
  if(!("Notification" in window)) return "unsupported"
  let p = Notification.permission
  if(p === "default") p = await Notification.requestPermission()
  if(p !== "granted") return "denied"
  setReminder({ on:true, time, lastDay:"" })
  return (await subscribePush(time)) ? "push" : "ok"
}
const b64ToU8 = b=>{ const p = "=".repeat((4 - b.length % 4) % 4), r = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c=>c.charCodeAt(0))) }
export async function subscribePush(time){
  try{
    if(!("serviceWorker" in navigator) || !("PushManager" in window)) return false
    const key = (await api.get("/push/key", { silent:true })).data?.key; if(!key) return false
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64ToU8(key) })
    await api.post("/push/subscribe", { subscription: sub.toJSON(), time, tz: new Date().getTimezoneOffset() }, { silent:true })
    return true
  }catch(e){ return false }
}
export async function unsubscribePush(){
  try{
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription()
    if(sub){ await api.post("/push/unsubscribe", { endpoint: sub.endpoint }, { silent:true }); await sub.unsubscribe() }
  }catch(e){ /* ignore */ }
}
let timer = null
export function startReminders(){
  if(timer || !("Notification" in window)) return
  const check = ()=>{
    const r = getReminder()
    if(!r.on || Notification.permission !== "granted") return
    const n = new Date(), hm = String(n.getHours()).padStart(2,"0") + ":" + String(n.getMinutes()).padStart(2,"0")
    const day = n.toDateString()
    if(hm >= r.time && r.lastDay !== day && hm <= addMin(r.time, 90)){
      setReminder({ ...r, lastDay:day })
      let due = 0; try{ due = (JSON.parse(localStorage.getItem("ml_srs") || "[]")).filter(c=>c.due <= Date.now()).length }catch(e){ /* ignore */ }
      try{ new Notification("Time to study 📚", { body: due ? `${due} flashcard${due===1?"":"s"} due — a quick review keeps your streak alive.` : "A short session keeps your streak alive.", icon:"/icon-192.png", tag:"ml-reminder" }) }catch(e){ /* ignore */ }
    }
  }
  timer = setInterval(check, 30000); check()
}
function addMin(hm, m){ const [h, mi] = hm.split(":").map(Number); const t = Math.min(23*60+59, h*60+mi+m); return String(Math.floor(t/60)).padStart(2,"0") + ":" + String(t%60).padStart(2,"0") }
