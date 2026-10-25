import axios from "axios"

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000"

export const api = axios.create({ baseURL: API_BASE })

/* Streaming chat: POST /chat/stream (server-sent events). Resolves with { sources } when finished.
   Throws before the first delta if streaming isn't available, so the caller can fall back to /chat. */
export async function streamChat(body, onDelta, signal){
  const auth = api.defaults.headers.common["Authorization"]
  const res = await fetch(API_BASE + "/chat/stream", { method:"POST", headers:{ "Content-Type":"application/json", ...(auth ? { Authorization: auth } : {}) }, body: JSON.stringify(body), signal })
  if(!res.ok || !res.body){ const e = new Error("stream http " + res.status); e.status = res.status; try{ e.detail = (await res.json()).detail }catch(x){}; throw e }
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = "", got = false, sources = []
  for(;;){
    const { value, done } = await reader.read()
    if(done) break
    buf += dec.decode(value, { stream:true })
    let i
    while((i = buf.indexOf("\n\n")) >= 0){
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2)
      if(!line.startsWith("data:")) continue
      let ev; try{ ev = JSON.parse(line.slice(5)) }catch(e){ continue }
      if(ev.t === "delta"){ got = true; onDelta(ev.v) }
      else if(ev.t === "done"){ sources = ev.sources || [] }
      else if(ev.t === "error"){ const e = new Error(ev.v || "stream error"); e.partial = got; throw e }
    }
  }
  if(!got) throw new Error("empty stream")
  return { sources }
}

export function setAuthToken(token){
  if(token){
    api.defaults.headers.common["Authorization"] = "Bearer " + token
    axios.defaults.headers.common["Authorization"] = "Bearer " + token
  } else {
    delete api.defaults.headers.common["Authorization"]
    delete axios.defaults.headers.common["Authorization"]
  }
}

// ---------------- toasts, errors, export helpers ----------------
export function toast(msg, kind = "info"){
  window.dispatchEvent(new CustomEvent("ml-toast", { detail: { msg, kind } }))
}
api.interceptors.response.use(r=>r, err=>{
  const url = String(err?.config?.url || "")
  if(!err.response){
    if(!err.config?.silent) toast("Can't reach the server. Check your connection, or that the backend is running.", "error")
  }else if(err.response.status === 401 && !url.includes("/auth/")){
    window.dispatchEvent(new Event("ml-unauth"))
  }else if(err.response.status === 429){
    toast("Too many requests. Please wait a moment and try again.", "error")
  }else if(err.response.status >= 500){
    toast("The server had a problem. Please try again.", "error")
  }
  return Promise.reject(err)
})

export function esc(s){ return String(s).replace(/[&<>"]/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c])) }
export function downloadFile(name, text, mime = "text/plain"){
  const blob = new Blob([text], { type: mime + ";charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000)
}
export function printDoc(title, bodyHtml){
  const w = window.open("", "_blank")
  if(!w){ toast("Allow pop-ups to save as PDF.", "error"); return false }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.65 -apple-system,Segoe UI,Arial,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#15131F}h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:26px 0 8px}.meta{color:#5C5873;font-size:12px;margin-bottom:24px}pre{white-space:pre-wrap;font:inherit;margin:0}.q{margin:14px 0;padding:10px 14px;border-left:3px solid #8B6BFF;background:#F7F6FB;break-inside:avoid}.ok{border-color:#16A34A}.bad{border-color:#DC2626}</style></head><body><h1>${esc(title)}</h1><div class="meta">MindLearn AI · ${new Date().toLocaleString()}</div>${bodyHtml}</body></html>`)
  w.document.close(); w.focus(); setTimeout(()=>w.print(), 350)
  return true
}

// upload with validation + progress (used by every upload entry point)
export const MAX_PDF_MB = 50
export async function uploadPdfs(files, onProgress){
  const list = Array.from(files || [])
  if(!list.length) throw new Error("No file selected.")
  for(const f of list){
    if(!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) throw new Error(`"${f.name}" is not a PDF. Only PDF files are supported.`)
    if(f.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`"${f.name}" is larger than ${MAX_PDF_MB} MB. Please upload a smaller file.`)
    if(f.size === 0) throw new Error(`"${f.name}" is empty.`)
  }
  const form = new FormData()
  list.forEach(f=>form.append("files", f))
  const res = await api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: e=>{ if(onProgress && e.total) onProgress(Math.round(e.loaded / e.total * 100)) },
  })
  try{ window.dispatchEvent(new Event("ml-library")) }catch(e){}
  return res?.data
}

// ---------------- cloud sync (optional: needs the backend sync router) ----------------
export const SYNC_KEYS = ["ml_scores","ml_activity","ml_weak","ml_pins","ml_deck","ml_kmap","ml_srs","ml_hl","ml_time","ml_reading","ml_achievements","ml_bms","ml_chat","ml_outlang","ml_personality","ml_theme","ml_sysprompt","ml_pomodoro","ml_doc"]
export const syncInfo = { status: "idle", at: 0 }
function setSync(status){ syncInfo.status = status; syncInfo.at = Date.now(); window.dispatchEvent(new Event("ml-sync-status")) }
export function readSyncData(){
  const out = {}
  SYNC_KEYS.forEach(k=>{ const v = localStorage.getItem(k); if(v !== null) out[k] = v })
  return out
}
export async function syncPull(){
  try{
    const { data } = await api.get("/sync/state", { silent: true })
    if(!data || !data.data) { setSync("on"); return }
    const localAt = +localStorage.getItem("ml_sync_at") || 0
    if((data.updated_at || 0) > localAt){
      Object.entries(data.data).forEach(([k, v])=>{ if(SYNC_KEYS.includes(k)){ try{ localStorage.setItem(k, v); window.dispatchEvent(new CustomEvent("ml-ls", { detail:k })) }catch(e){} } })
      localStorage.setItem("ml_sync_at", String(data.updated_at))
    }
    setSync("on")
  }catch(e){ setSync(e?.response?.status === 404 || !e?.response ? "off" : "error") }
}
let pushTimer = null
export function syncPushSoon(){
  if(syncInfo.status !== "on") return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async ()=>{
    try{
      const at = Date.now() / 1000
      await api.put("/sync/state", { data: readSyncData(), updated_at: at }, { silent: true })
      localStorage.setItem("ml_sync_at", String(at)); setSync("on")
    }catch(e){ setSync("error") }
  }, 4000)
}

// ---------------- sound fx (raw Web Audio, no files) ----------------
export function isSoundOn(){ try{ return localStorage.getItem("ml_sound") === "1" }catch(e){ return false } }
export function setSoundOn(on){ try{ localStorage.setItem("ml_sound", on ? "1" : "0") }catch(e){} }
let _ctx = null
function audio(){
  const Ctx = window.AudioContext || window.webkitAudioContext
  if(!Ctx) return null
  if(!_ctx) _ctx = new Ctx()
  if(_ctx.state === "suspended") _ctx.resume().catch(()=>{})
  return _ctx
}
// one soft note: quick attack, smooth decay, optional pitch glide
function note(freq, at = 0, dur = 0.18, type = "sine", vol = 0.05, glideTo = 0){
  if(!isSoundOn()) return
  try{
    const ctx = audio(); if(!ctx) return
    const t0 = ctx.currentTime + at
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, t0)
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(ctx.destination)
    o.start(t0); o.stop(t0 + dur + 0.02)
  }catch(e){}
}
function buzz(ms){ try{ if(window.matchMedia && window.matchMedia("(pointer: coarse)").matches && navigator.vibrate) navigator.vibrate(ms) }catch(e){} }
export const sounds = {
  click:   ()=>{ note(740, 0, 0.07, "sine", 0.035); buzz(8) },
  tick:    ()=>{ note(1250, 0, 0.035, "sine", 0.02) },
  pop:     ()=>{ note(420, 0, 0.1, "triangle", 0.05, 640); buzz(10) },
  success: ()=>{ note(523, 0, 0.16, "sine", 0.05); note(659, 0.08, 0.16, "sine", 0.05); note(784, 0.16, 0.28, "sine", 0.05); buzz([12, 40, 18]) },
  unlock:  ()=>{ try{ if(!document.documentElement.classList.contains("lite")) window.dispatchEvent(new Event("ml-confetti")) }catch(e){}; [523, 659, 784, 1047, 1319].forEach((f, k)=>note(f, k * 0.07, 0.3, "sine", 0.045)); note(262, 0, 0.6, "triangle", 0.03); buzz([15, 40, 15, 40, 30]) },
  levelup: ()=>{ try{ if(!document.documentElement.classList.contains("lite")) window.dispatchEvent(new Event("ml-confetti")) }catch(e){}; [392, 523, 659, 784].forEach((f, k)=>note(f, k * 0.09, 0.25, "triangle", 0.05)); buzz([20, 50, 30]) },
  error:   ()=>{ note(220, 0, 0.18, "sawtooth", 0.03, 150); buzz(40) },
  whoosh:  ()=>{ note(160, 0, 0.35, "sawtooth", 0.016, 900); note(500, 0.05, 0.3, "sine", 0.02, 1400) },
}

// ---------------- themes ----------------
export const THEMES = {
  nova:    { name:"Nova Violet",  v:"#8B6BFF", cy:"#2DE3F0", bg:"#050508" },
  ember:   { name:"Ember",        v:"#FB7185", cy:"#FBBF24", bg:"#0B0708" },
  forest:  { name:"Forest",       v:"#34D399", cy:"#A3E635", bg:"#06100B" },
  ocean:   { name:"Ocean",        v:"#38BDF8", cy:"#818CF8", bg:"#060B14" },
  sunset:  { name:"Sunset",       v:"#F472B6", cy:"#FB923C", bg:"#120810" },
  gold:    { name:"Royal Gold",   v:"#F5B13D", cy:"#FDE68A", bg:"#0C0905" },
  crimson: { name:"Crimson",      v:"#EF4444", cy:"#F9A8D4", bg:"#0C0506" },
  mono:    { name:"Mono",         v:"#A1A1AA", cy:"#E4E4E7", bg:"#070708" },
}
export function hexRgb(h){ const n = parseInt(h.slice(1), 16); return [(n>>16)&255, (n>>8)&255, n&255] }
export function applyTheme(key, dark){
  const t = THEMES[key] || THEMES.nova, r = document.documentElement.style
  const [vr,vg,vb] = hexRgb(t.v), [cr,cg,cb] = hexRgb(t.cy)
  r.setProperty("--v", t.v); r.setProperty("--cy", t.cy)
  r.setProperty("--v-rgb", `${vr},${vg},${vb}`); r.setProperty("--cy-rgb", `${cr},${cg},${cb}`)
  r.setProperty("--glow-v", `rgba(${vr},${vg},${vb},0.45)`); r.setProperty("--glow-cy", `rgba(${cr},${cg},${cb},0.35)`)
  if(dark) r.setProperty("--bg", t.bg); else r.removeProperty("--bg")
}

// ---------------- notification center store ----------------
export function pushNotif(text, icon = "🔔"){
  try{
    const list = JSON.parse(localStorage.getItem("ml_notifs") || "[]")
    list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, icon, at: Date.now(), read: false })
    localStorage.setItem("ml_notifs", JSON.stringify(list.slice(0, 30)))
    window.dispatchEvent(new CustomEvent("ml-ls", { detail:"ml_notifs" }))
  }catch(e){}
}

export const PERSONALITIES = {
  friendly:  "You are a warm, encouraging tutor who explains patiently and celebrates small wins.",
  strict:    "You are a no-nonsense, rigorous tutor who expects precision and challenges the student.",
  funny:     "You are a witty tutor who uses humor and playful analogies to make concepts stick.",
  socratic:  "You are a Socratic tutor who answers mostly with guiding questions rather than direct answers.",
  concise:   "You are a tutor who gives the shortest possible correct answer, no fluff.",
}

export const CODE_LANGS = ["Python","JavaScript","Java","C++","C","Go","Rust","TypeScript","SQL"]

export const ACHIEVEMENTS = [
  { id:"first_upload", label:"First Upload", desc:"Uploaded your first PDF", icon:"📄" },
  { id:"first_quiz", label:"Quiz Rookie", desc:"Completed your first quiz", icon:"🎯" },
  { id:"streak_3", label:"On a Roll", desc:"3-day study streak", icon:"🔥" },
  { id:"flash_10", label:"Flash Master", desc:"Generated 10 flashcard sets", icon:"🗂️" },
  { id:"chat_50", label:"Chatterbox", desc:"Sent 50 chat messages", icon:"💬" },
  { id:"night_owl", label:"Night Owl", desc:"Studied after midnight", icon:"🦉" },
  { id:"quiz_5", label:"Quiz Regular", desc:"Completed 5 quizzes", icon:"🧠" },
  { id:"quiz_ace", label:"Ace", desc:"Scored 90% or more on a quiz", icon:"🏅" },
  { id:"week_streak", label:"Unstoppable", desc:"7-day study streak", icon:"⚡" },
  { id:"notes_3", label:"Note Taker", desc:"Saved 3 notes to My Notes", icon:"🗒️" },
  { id:"pomo_5", label:"Deep Focus", desc:"Finished 5 focus sessions", icon:"⏱️" },
  { id:"exam_1", label:"Exam Warrior", desc:"Finished a mock exam", icon:"📝" },
  { id:"lvl_5", label:"Level 5", desc:"Reached level 5", icon:"🚀" },
]

export const QUOTES = [
  "The expert in anything was once a beginner.",
  "Small steps every day beat big leaps once in a while.",
  "Your future self is watching you right now through memories.",
  "Done is better than perfect — ship the first draft.",
  "Confusion is the sign you're about to understand something.",
]

export const TYPING_TEXTS = [
  "The quick brown fox jumps over the lazy dog while studying for finals.",
  "Consistency beats intensity when it comes to long-term learning.",
  "Neural networks learn patterns the same way you learn from flashcards.",
]

// ---------------- hooks ----------------
import { useEffect, useState, useRef } from "react"

export function useLocalState(key, initial){
  const [val, setVal] = useState(()=>{
    try{
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    }catch(e){ return initial }
  })
  useEffect(()=>{
    try{
      const str = JSON.stringify(val)
      const cur = localStorage.getItem(key)
      if(cur === null && str === JSON.stringify(initial)) return
      if(cur !== str){
        localStorage.setItem(key, str)
        window.dispatchEvent(new CustomEvent("ml-ls", { detail: key }))
      }
    }catch(e){}
  },[key, val])
  // keep other components using the same key in sync (and apply cloud-sync / restore updates)
  useEffect(()=>{
    const f = e=>{
      if(e.detail !== key) return
      try{
        const raw = localStorage.getItem(key)
        const v = raw ? JSON.parse(raw) : initial
        setVal(old => JSON.stringify(old) === JSON.stringify(v) ? old : v)
      }catch(err){}
    }
    window.addEventListener("ml-ls", f)
    return ()=>window.removeEventListener("ml-ls", f)
  },[key])
  return [val, setVal]
}

export function useDark(){
  const [dark, setDark] = useLocalState("ml_dark", true)
  useEffect(()=>{
    document.documentElement.classList.toggle("light", !dark)
  },[dark])
  return [dark, setDark]
}

export function useChatHistory(){
  return useLocalState("ml_chat", [])
}
export function useBookmarks(){
  return useLocalState("ml_bms", [])
}

// ---------------- small shared UI ----------------
export function Spin(){
  return <span className="spin-dot" aria-label="loading">⏳</span>
}

export function Skeleton({ lines=3 }){
  return (
    <div className="skeleton-wrap">
      {Array.from({length:lines}).map((_,i)=>(
        <div key={i} className="skeleton-line" style={{ width: `${86 - i*14}%` }} />
      ))}
    </div>
  )
}

export function CopyBtn({ text }){
  const [done, setDone] = useState(false)
  return (
    <button className="btn btn-ghost btn-sm" onClick={()=>{
      navigator.clipboard?.writeText(text || "")
      setDone(true); setTimeout(()=>setDone(false), 1200)
    }}>{done ? "Copied" : "Copy"}</button>
  )
}

export function VoiceInput({ onResult }){
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const start = ()=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if(!SR){ alert("Voice input isn't supported in this browser."); return }
    const rec = new SR()
    rec.lang = "en-US"
    rec.onresult = (e)=>{ onResult(e.results[0][0].transcript); setListening(false) }
    rec.onerror = ()=> setListening(false)
    rec.onend = ()=> setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }
  return (
    <button type="button" className={"voice-btn" + (listening ? " active" : "")} onClick={start} title="Voice input">
      {listening ? "🎙️" : "🎤"}
    </button>
  )
}

export function ProgressBar({ value=0, max=100, label }){
  const pct = Math.min(100, Math.round((value/max)*100))
  return (
    <div className="prog">
      {label && <div className="prog-label">{label}</div>}
      <div className="prog-track"><div className="prog-fill" style={{ width: pct+"%" }} /></div>
    </div>
  )
}

export function Confetti({ fire }){
  const [pieces, setPieces] = useState([])
  useEffect(()=>{
    if(!fire) return
    const arr = Array.from({length:40}).map((_,i)=>({
      id:i, left: Math.random()*100, bg: ["#7C5CFC","#22D3EE","#F472B6","#F5B13D"][i%4],
      delay: Math.random()*0.4, dur: 1.4 + Math.random()*0.8
    }))
    setPieces(arr)
    const t = setTimeout(()=>setPieces([]), 2400)
    return ()=>clearTimeout(t)
  },[fire])
  if(!pieces.length) return null
  return (
    <div className="confetti-wrap">
      {pieces.map(p=>(
        <span key={p.id} className="confetti-piece" style={{ left:p.left+"%", background:p.bg, animationDelay:p.delay+"s", animationDuration:p.dur+"s" }} />
      ))}
    </div>
  )
}

export function NotificationBell({ items=[] }){
  const [open, setOpen] = useState(false)
  return (
    <div className="bell-wrap">
      <button className="icon-btn" onClick={()=>setOpen(o=>!o)}>🔔{items.length>0 && <span className="bell-dot" />}</button>
      {open && (
        <div className="bell-pop">
          {items.length===0 ? <div className="bell-empty">No notifications yet</div> :
            items.slice(0,6).map((it,i)=>(<div key={i} className="bell-item">{it}</div>))}
        </div>
      )}
    </div>
  )
}

// ---------------- answer language (English / Hinglish / Hindi) ----------------
export const LANGS = {
  en:       { label:"English",  short:"EN",  prompt:"",  rec:"en-IN", tts:"en-IN" },
  hinglish: { label:"Hinglish", short:"Hinglish", prompt:"Hinglish: Hindi written in Roman (English) letters, naturally mixed with common English and technical terms, like a friendly Indian teacher would explain.", rec:"en-IN", tts:"en-IN" },
  hi:       { label:"हिन्दी",    short:"हिन्दी", prompt:"Hindi in Devanagari script, keeping key technical terms in English in brackets when helpful.", rec:"hi-IN", tts:"hi-IN" },
}
export function getOutLang(){
  try{ const v = JSON.parse(localStorage.getItem("ml_outlang") || '"en"'); return LANGS[v] ? v : "en" }catch(e){ return "en" }
}
export function langInstruction(){
  const l = LANGS[getOutLang()]
  return l.prompt ? "Write your answer in " + l.prompt : ""
}

// ---------------- generic AI helpers (all go through the existing /chat endpoint) ----------------
export function extractAnswer(data){
  if(typeof data === "string") return data
  return data?.answer || data?.reply || data?.response || data?.notes || data?.essay || data?.result || data?.text || data?.content || JSON.stringify(data)
}
export async function askText(prompt, extra = {}){
  const { data } = await api.post("/chat", { message: prompt, question: prompt, ...extra })
  return extractAnswer(data)
}
export function parseJSONLoose(text){
  if(!text) return null
  let t = String(text).replace(/```(?:json)?/gi, "").trim()
  const starts = [t.indexOf("{"), t.indexOf("[")].filter(i=>i>=0)
  if(!starts.length) return null
  const a = Math.min(...starts)
  const open = t[a], close = open === "{" ? "}" : "]"
  const b = t.lastIndexOf(close)
  if(b <= a) return null
  try{ return JSON.parse(t.slice(a, b+1)) }catch(e){
    try{ return JSON.parse(t.slice(a, b+1).replace(/,\s*([}\]])/g, "$1")) }catch(e2){ return null }
  }
}
export async function chatJSON(prompt){
  const text = await askText(prompt)
  const data = parseJSONLoose(text)
  if(!data) throw new Error("The AI reply wasn't in the expected format. Please try again.")
  return data
}
function normalizeQuestions(arr){
  const out = []
  ;(arr || []).forEach(q=>{
    const question = q.question || q.q
    let options = (q.options || q.choices || []).map(o=> typeof o === "string" ? o : (o?.text || o?.label || String(o)))
    if(!question || options.length < 2) return
    let ans = q.answer ?? q.correct ?? q.correct_answer
    if(typeof ans === "number") ans = options[ans]
    else if(typeof ans === "string"){
      const trimmed = ans.trim()
      const hit = options.find(o=>o.trim().toLowerCase() === trimmed.toLowerCase())
      if(hit) ans = hit
      else if(/^[A-Da-d][).:]?$/.test(trimmed)) ans = options[trimmed.toUpperCase().charCodeAt(0) - 65]
      else ans = options.find(o=>trimmed.toLowerCase().includes(o.trim().toLowerCase()) || o.trim().toLowerCase().includes(trimmed.toLowerCase()))
    }
    if(!ans) return
    out.push({ question, options, answer: ans, topic: q.topic || q.category || "", explanation: q.explanation || q.why || "" })
  })
  return out
}
export async function chatQuestions({ count=5, topics=[], style="" } = {}){
  const li = langInstruction()
  const prompt = `Using ONLY the uploaded document, write ${count} multiple-choice questions` +
    (topics.length ? ` focusing on these topics: ${topics.join(", ")}` : "") + "." +
    (style ? ` Style: ${style}.` : "") + (li ? ` ${li} (questions, options and explanations; keep the JSON keys in English).` : "") +
    `\nRespond with ONLY valid JSON, no markdown fences, exactly in this shape:\n` +
    `{"questions":[{"question":"...","options":["...","...","...","..."],"answer":"<must be exactly one of the options>","topic":"2-3 word topic","explanation":"one short sentence"}]}`
  const data = await chatJSON(prompt)
  const qs = normalizeQuestions(Array.isArray(data) ? data : (data.questions || data.quiz))
  if(!qs.length) throw new Error("Couldn't build questions from the AI reply. Please try again.")
  return qs
}

// ---------------- weak-spot tracking (saved locally) ----------------
const STOP = new Set(["which","would","there","their","about","these","those","where","after","before","being","between","following","correct","statement","question","answer","document","according","described","primary","main","does","what","when","with","from","that","this","have","into","than","then","also","most","best","true","false","choose"])
export function topicOf(q){
  const t = q.topic || q.category || q.subject
  if(t && String(t).trim()) return String(t).trim().slice(0, 40)
  const words = String(q.question || q.q || "").replace(/[^A-Za-z0-9ऀ-ॿ\s-]/g, " ").split(/\s+/).filter(w=>w.length > 4 && !STOP.has(w.toLowerCase()))
  words.sort((a,b)=>b.length - a.length)
  return words[0] ? words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase() : "General"
}
export function readWeak(){
  try{ return JSON.parse(localStorage.getItem("ml_weak") || "[]") }catch(e){ return [] }
}
export function recordAnswers(items){
  try{
    const next = [...readWeak(), ...items.map(i=>({ t:i.topic, ok:!!i.ok, q:String(i.q || "").slice(0,140), at:Date.now() }))].slice(-600)
    localStorage.setItem("ml_weak", JSON.stringify(next))
    window.dispatchEvent(new CustomEvent("ml-ls", { detail:"ml_weak" }))
  }catch(e){}
}
export function weakStats(){
  const m = {}
  readWeak().forEach(a=>{ const k = a.t || "General"; (m[k] = m[k] || { topic:k, attempts:0, correct:0 }); m[k].attempts++; if(a.ok) m[k].correct++ })
  return Object.values(m).map(x=>({ ...x, acc: Math.round(x.correct/x.attempts*100) })).sort((a,b)=>a.acc - b.acc || b.attempts - a.attempts)
}

// ---------------- FUN_META: title / tagline / description / tips for all 31 functions ----------------
export const FUN_META = {
  chat:        { title:"Chat with your PDF", tag:"Your document, now with a voice (and opinions).", desc:"Ask anything about the uploaded material and get grounded, cited answers in plain language.", tips:["Ask follow-up questions — the chat remembers context.","Try a personality mode for a different teaching style.","Use voice input when your hands are busy with notes."] },
  notes:       { title:"Smart Notes", tag:"Because highlighting everything is not a strategy.", desc:"Generates clean, structured notes from your document, organized by topic.", tips:["Export notes to keep studying offline.","Regenerate with a different detail level if it's too short or long.","Bookmark the notes you'll want to revisit before exams."] },
  flashcards:  { title:"Flashcards", tag:"Bite-sized brain snacks.", desc:"Auto-generates flashcards from the key concepts in your material.", tips:["Flip through fast once, then slow down on the ones you miss.","Combine with Spaced Repetition for long-term retention.","Rate difficulty so future sets focus on your weak spots."] },
  quiz:        { title:"Quiz Generator", tag:"Prove it.", desc:"Creates multiple-choice quizzes to test what actually stuck.", tips:["Review wrong answers immediately, not at the end.","Track your score over time in Progress.","Try Auto-Quiz for a timed challenge mode."] },
  youtube:     { title:"YouTube Notes", tag:"Turn any lecture video into readable notes.", desc:"Paste a YouTube link and get a clean summary with timestamps.", tips:["Works best on talking-head lectures, not music videos.","Long videos may take a little longer to process.","Copy key timestamps to jump back into the video."] },
  essay:       { title:"Essay Writer", tag:"A first draft, not a ghostwriter.", desc:"Drafts a structured essay outline and content based on your topic and source material.", tips:["Give a clear topic and word count for better structure.","Use it as a starting draft, then make it yours.","Ask for a specific tone — academic, persuasive, casual."] },
  eli5:        { title:"Explain Like I'm 5", tag:"For when the textbook forgot you're human.", desc:"Breaks down complex sections into simple, intuitive explanations.", tips:["Paste the exact confusing paragraph for a sharper answer.","Ask for an analogy if the explanation still feels abstract.","Great right before a quiz to sanity-check your understanding."] },
  achievements:{ title:"Achievements", tag:"Gold stars, but for adults.", desc:"Tracks milestones in your study journey and unlocks badges as you go.", tips:["Check back after each study session — badges unlock quietly.","Streaks reset at midnight, so don't skip a day.","Share your badge wall for a little accountability."] },
  compare:     { title:"Compare Concepts", tag:"Side-by-side, no fence-sitting.", desc:"Compares two concepts from your material across key dimensions.", tips:["Be specific with both concept names for a sharper table.","Use it to prep for 'compare and contrast' exam questions.","Copy the table straight into your notes."] },
  image:       { title:"Visual Explainer", tag:"A picture's worth 1000 flashcards.", desc:"Generates a descriptive visual breakdown or diagram-style explanation of a concept.", tips:["Works best for processes, cycles, and structures.","Ask for a step-by-step version if the diagram is too dense.","Pair with Notes for a complete study page."] },
  pomodoro:    { title:"Focus Timer", tag:"25 minutes of no excuses.", desc:"A built-in Pomodoro timer to structure your study sessions.", tips:["Stick to 25-minute focus blocks with 5-minute breaks.","Mute notifications during a focus block.","Log completed sessions to build your streak."] },
  vocabquiz:   { title:"Vocabulary Quiz", tag:"Big words, demystified.", desc:"Tests you on key terms and definitions pulled straight from your document.", tips:["Say the definition out loud before checking the answer.","Revisit terms you miss twice in the same session.","Great for jargon-heavy subjects like law or medicine."] },
  map:         { title:"Concept Map", tag:"Your syllabus, untangled.", desc:"Builds a hierarchical map connecting the main ideas in your material.", tips:["Start from the center node and work outward.","Use it to spot gaps before writing an essay.","Export as notes to review linearly later."] },
  bookmarks:   { title:"Bookmarks", tag:"Your personal highlight reel.", desc:"Save any AI response across the app to revisit later.", tips:["Bookmark mid-session, not just at the end — you'll forget.","Search bookmarks by keyword when exam week hits.","Clear old ones each term to keep it useful."] },
  studyplan:   { title:"Study Planner", tag:"A calendar that actually wants you to succeed.", desc:"Generates a day-by-day study plan based on your deadline and material.", tips:["Be honest about how many hours a day you actually have.","Leave the last day as a light review day, not a new topic.","Re-generate the plan if you fall behind — that's normal."] },
  interview:   { title:"Mock Interview", tag:"Practice the sweaty-palms part in private.", desc:"Simulates interview-style questions based on your subject material.", tips:["Answer out loud, not just in your head.","Ask for harder follow-ups once you're comfortable.","Review your weakest answers before the real thing."] },
  theme:       { title:"Theme Picker", tag:"Because beige is a crime.", desc:"Switch the app's color theme to match your mood or focus level.", tips:["Cooler tones can feel calmer for long sessions.","Your choice is saved automatically for next time.","High-contrast themes help in bright rooms."] },
  scores:      { title:"Leaderboard", tag:"Friendly competition, mostly with yourself.", desc:"Tracks your quiz scores over time so you can see real progress.", tips:["Compare this week's average to last week's.","A dip isn't failure — it usually means harder material.","Screenshot milestones to stay motivated."] },
  prompt:      { title:"Custom AI Prompt", tag:"Tell the tutor how to tutor.", desc:"Set a custom system instruction that shapes how the AI responds across the app.", tips:["Keep it short and specific — one clear instruction works best.","Reset to default if answers start feeling off.","Great for matching your professor's exact terminology."] },
  typing:      { title:"Typing Trainer", tag:"Type faster than your thoughts can wander.", desc:"A short typing-speed drill using study-relevant sentences.", tips:["Accuracy matters more than raw speed at first.","Do a quick round as a warm-up before a study session.","Retry the same passage to see direct improvement."] },
  mnemonics:   { title:"Mnemonics Generator", tag:"Memory tricks your brain didn't know it needed.", desc:"Creates memorable acronyms or phrases for hard-to-remember lists.", tips:["Works best on ordered lists — steps, stages, categories.","Say the mnemonic out loud a few times to lock it in.","Silly ones stick better than serious ones — don't overthink it."] },
  difficulty:  { title:"Difficulty Rater", tag:"Brutally honest, so you don't have to guess.", desc:"Rates how difficult a topic is likely to be for you based on your material.", tips:["Use it to decide what to study first, not last.","Re-rate after a study session to track real improvement.","Harder-rated topics deserve more spaced repetition."] },
  srs:         { title:"Spaced Repetition", tag:"Remember it in June, not just tomorrow.", desc:"Schedules flashcard reviews at increasing intervals for long-term memory.", tips:["Review on the day it's due — delaying resets the benefit.","Be honest when rating how well you remembered a card.","This is the single best tool here for exam-season retention."] },
  debate:      { title:"Self-Debate", tag:"Argue with yourself, constructively.", desc:"Generates both sides of an argument from your material to sharpen critical thinking.", tips:["Try arguing the side you disagree with first.","Use it to stress-test your own essay thesis.","Great prep for discussion-based seminars."] },
  reading:     { title:"Reading Tracker", tag:"So your PDF doesn't just sit there judging you.", desc:"Tracks how much of your document you've actually studied.", tips:["Update progress after each session, not just at the end.","Use it to pace yourself against a deadline.","Pair with Study Planner for a realistic schedule."] },
  multipdf:    { title:"Multi-PDF Chat", tag:"One conversation, all your readings.", desc:"Chat across multiple uploaded documents at once.", tips:["Name your files clearly so answers can cite the right one.","Ask comparison questions across sources for essays.","Upload related chapters together for the best context."] },
  codegen:     { title:"Code Generator", tag:"From pseudocode to actual code, minus the tears.", desc:"Generates working code snippets based on your description or material.", tips:["Specify the language up front for cleaner output.","Ask for comments if you need to understand it, not just run it.","Test generated code before submitting it anywhere important."] },
  debugger:    { title:"Code Debugger", tag:"Your rubber duck, but it talks back.", desc:"Finds and explains bugs in pasted code, with a suggested fix.", tips:["Paste the exact error message along with the code.","Ask 'why' if the fix doesn't make sense yet.","Keep a backup of your code before applying suggested fixes."] },
  reviewer:    { title:"Code Reviewer", tag:"The honest teammate everyone needs.", desc:"Reviews code for style, bugs, and best practices.", tips:["Ask for a severity ranking if the feedback list is long.","Apply one suggestion at a time, not all at once.","Use it before submitting assignments, not after grading."] },
  algorithm:   { title:"Algorithm Visualizer", tag:"Watch the logic, don't just read it.", desc:"Explains an algorithm step-by-step in plain language.", tips:["Ask for the time complexity if it's not mentioned.","Trace through a tiny example by hand alongside the explanation.","Great prep for whiteboard-style interview questions."] },
  knowledge:   { title:"3D Knowledge Map", tag:"Your PDF as a galaxy of ideas.", desc:"Turns the main concepts in your document into an interactive 3D map. Drag to rotate, click any idea to explain it, quiz yourself or make flashcards.", tips:["Drag to orbit, scroll or pinch to zoom.","Click a concept, then use Explain, Quiz me or Flashcards.","Rebuild the map after uploading a new PDF."] },
  weakspots:   { title:"Weak-Spot Radar", tag:"Know exactly where you slip.", desc:"Tracks which topics you get wrong across quizzes and exams, shows them on a radar, and builds a practice quiz from your weakest topics.", tips:["Take a few quizzes first so there is data to analyse.","Topics are auto-detected from each question.","Practice weak spots a little every day."] },
  exam:        { title:"Exam Simulator", tag:"A real paper, a real clock.", desc:"Generates a timed paper from your PDF with negative marking, a question navigator and a full report at the end.", tips:["Pick the style closest to your exam.","Mark tricky questions for review and come back to them.","Read the report: topic breakdown shows what to revise."] },
  swipe:       { title:"Swipe Cards", tag:"Review flashcards Tinder-style.", desc:"Swipe right when you remember, left when you don't. Your review schedule updates automatically.", tips:["Tap the card to flip it.","Use ← → and Space on a keyboard.","Cards you forget come back tomorrow."] },
  listen:      { title:"Listen Mode", tag:"Turn notes into audio.", desc:"Hear your notes or flashcards read aloud with speed control and a sleep timer.", tips:["Tap any sentence to jump to it.","Pick a Hindi or Indian-English voice.","Set a sleep timer for bedtime revision."] },
  sketch:      { title:"Sketchpad", tag:"Draw diagrams and formulas.", desc:"Sketch with your finger, mouse or pen. Save drawings and download them as images.", tips:["Turn on the grid for neat diagrams.","Use the eraser for quick fixes.","Saved sketches stay on this device."] },
  planner:     { title:"Study Planner", tag:"A day-by-day plan to your exam.", desc:"Enter your exam date and subjects and get a daily plan with study, quiz and revision blocks. Tick tasks off as you go.", tips:["Today's tasks also show on Home.","Change subjects or hours any time.","Plan adapts to the days you have left."] },
  mynotes:     { title:"My Notes", tag:"Your own notes, always saved.", desc:"Write, edit and organise your notes. Save AI notes and answers here with one click.", tips:["Notes autosave as you type.","Use “Save to My Notes” in Smart Notes and Chat.","Export any note as Markdown or PDF."] },
  pdfsearch:   { title:"Search in PDF", tag:"Ctrl+F, but for every PDF you own.", desc:"Find any word or phrase across all your uploaded PDFs and jump straight to the page.", tips:["Results are ranked by how many of your words match.","Click a result to open the page with highlights.","Needs an internet connection the first time to read PDFs."] },
  report:      { title:"Weekly Report", tag:"How your week actually went.", desc:"A snapshot of your study activity, scores and weak topics. Save it as a PDF.", tips:["Check it every Sunday.","Weak topics come from your quizzes and exams.","Save as PDF to share with a teacher or friend."] },
  library:     { title:"Document Library", tag:"Every PDF you've uploaded, one click away.", desc:"Switch the active document without re-uploading, or remove files you no longer need.", tips:["The active document is used by Chat, Notes and Quiz.","Files are stored in this browser only.","Remove old PDFs to free up space."] },
  settings:    { title:"Settings", tag:"Make it yours.", desc:"Language, theme, sound, backups and privacy in one place.", tips:["Download a backup before switching devices.","Answer language also applies to notes and quizzes.","Deleting local data does not delete your account."] },
  voice:       { title:"Voice Tutor", tag:"Just talk. It talks back.", desc:"Ask questions out loud and hear the answer, hands-free. Works in English, Hinglish or Hindi.", tips:["Use Chrome, Edge or Safari for speech recognition.","Turn on hands-free to keep the conversation going.","Switch the answer language from the sidebar."] },
  codequiz:    { title:"Code Quiz", tag:"Debug this... before it debugs you.", desc:"Quizzes you on code snippets, output prediction, and common bugs.", tips:["Predict the output before revealing the answer.","Focus on the language you're weakest in first.","Re-attempt missed questions after a short break."] },
}

export const SIDEBAR_GROUPS = [
  { label:"Study", items:[
    ["chat","💬"],["notes","📝"],["flashcards","🗂️"],["eli5","🧸"],["map","🕸️"],["multipdf","📚"],["mnemonics","🧠"],["bookmarks","🔖"],
  ]},
  { label:"Practice", items:[
    ["quiz","🎯"],["vocabquiz","🔤"],["srs","🔁"],["interview","🎤"],["debate","⚖️"],["difficulty","📊"],["typing","⌨️"],
  ]},
  { label:"Code", items:[
    ["codegen","🤖"],["debugger","🐞"],["reviewer","🔍"],["algorithm","📈"],["codequiz","💻"],
  ]},
  { label:"Tools", items:[
    ["youtube","📺"],["essay","✍️"],["compare","⚔️"],["image","🖼️"],["studyplan","🗓️"],["pomodoro","⏱️"],["prompt","⚙️"],["theme","🎨"],["reading","📖"],
  ]},
  { label:"Smart Lab", items:[
    ["knowledge","🌌"],["weakspots","🎯"],["exam","📝"],["voice","🎙️"],
  ]},
  { label:"Progress", items:[
    ["achievements","🏆"],["scores","📈"],
  ]},
  { label:"Workspace", items:[
    ["planner","🧭"],["swipe","👆"],["listen","🎧"],["sketch","✏️"],["mynotes","🗒️"],["pdfsearch","🔎"],["report","📊"],["library","📚"],["settings","⚙️"],
  ]},
]

export const ALL_FUNCTION_KEYS = SIDEBAR_GROUPS.flatMap(g=>g.items.map(i=>i[0]))
export const ICON_BY_KEY = Object.fromEntries(SIDEBAR_GROUPS.flatMap(g=>g.items))
