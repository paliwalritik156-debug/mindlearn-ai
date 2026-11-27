import { useEffect, useMemo, useRef, useState } from "react"
import { useLocalState, useDark, toast, sounds, applyTheme } from "./lib.jsx"

/* ---------- global theme ---------- */
export function useApplyTheme(){
  const [dark, setDark] = useDark()
  const [auto] = useLocalState("ml_theme_auto", false)
  useEffect(()=>{
    if(!auto || !window.matchMedia) return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const f = ()=>setDark(mq.matches)
    f(); mq.addEventListener("change", f)
    return ()=>mq.removeEventListener("change", f)
  },[auto])
  const [theme] = useLocalState("ml_theme", "nova")
  useEffect(()=>{ applyTheme(theme, dark) },[theme, dark])
}
export function NotifCenter(){
  const [list, setList] = useLocalState("ml_notifs", [])
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const unread = list.filter(n=>!n.read).length
  useEffect(()=>{
    if(!open) return
    const f = e=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const k = e=>{ if(e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", f); document.addEventListener("keydown", k)
    return ()=>{ document.removeEventListener("mousedown", f); document.removeEventListener("keydown", k) }
  },[open])
  function ago(t){ const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? "now" : m < 60 ? m + "m" : m < 1440 ? Math.floor(m/60) + "h" : Math.floor(m/1440) + "d" }
  return (
    <div className="bell-wrap" ref={ref}>
      <button className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}
        onClick={()=>{ setOpen(o=>!o); if(!open) setTimeout(()=>setList(l=>l.map(n=>({ ...n, read:true }))), 1200) }}>
        🔔{unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop notif-pop" role="dialog" aria-label="Notifications">
          <div className="notif-head"><b>Notifications</b>{list.length > 0 && <button onClick={()=>setList([])}>Clear all</button>}</div>
          {list.length === 0 ? <div className="bell-empty">You're all caught up.</div> : list.slice(0, 10).map(n=>(
            <div key={n.id} className={"notif-item" + (n.read ? "" : " new")}><span>{n.icon}</span><p>{n.text}</p><i>{ago(n.at)}</i></div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   LANDING: live demo, scroll story, facts, grain/mesh
   ============================================================ */
const SAMPLE_TITLE = "Photosynthesis_Notes.pdf"
const SAMPLE = [
  "Photosynthesis is the process by which plants, algae and some bacteria convert light energy into chemical energy stored in glucose.",
  "It takes place in the chloroplasts, which contain the green pigment chlorophyll.",
  "Chlorophyll absorbs mostly red and blue light and reflects green light, which is why leaves look green.",
  "The light reactions occur in the thylakoid membranes and produce ATP and NADPH while splitting water and releasing oxygen.",
  "The Calvin cycle occurs in the stroma and uses ATP and NADPH to fix carbon dioxide into glucose.",
  "Plants need light, water and carbon dioxide for photosynthesis; the stomata on leaves let carbon dioxide in.",
  "The overall equation is 6CO2 + 6H2O + light energy gives C6H12O6 + 6O2.",
]
const STOPW = new Set("the and what where when which does how why is are was were that this with from into for you your can who whom about tell me explain give a an of in on to it its do did".split(" "))
function answerFrom(q){
  const terms = q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w=>w.length > 2 && !STOPW.has(w))
  const stem = w => w.replace(/(ing|ed|es|s)$/, "")
  const scored = SAMPLE.map((s, i)=>{ const low = s.toLowerCase(); let sc = 0; terms.forEach(t=>{ if(low.includes(stem(t))) sc++ }); return { i, sc } }).filter(x=>x.sc > 0).sort((a, b)=>b.sc - a.sc || a.i - b.i)
  const top = scored.length ? Math.max(...scored.map(x=>x.sc)) : 0
  const pick = scored.filter(x=>x.sc === top).slice(0, 2).sort((a, b)=>a.i - b.i)
  if(!scored.length) return { text:"I couldn't find that in this sample document. Try asking about chlorophyll, the Calvin cycle, the light reactions, or what plants need.", src:[] }
  return { text: pick.map(x=>SAMPLE[x.i]).join(" "), src: pick.map(x=>x.i) }
}
export function LiveDemo(){
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [shown, setShown] = useState("")
  const [src, setSrc] = useState([])
  const endRef = useRef()
  const chips = ["Why are leaves green?", "Where does the Calvin cycle happen?", "What do plants need?"]
  useEffect(()=>{ const el = endRef.current; if(el) el.scrollTop = el.scrollHeight },[msgs, shown])
  function ask(q){
    q = q.trim(); if(!q || typing) return
    setInput(""); setMsgs(m=>[...m, { r:"u", t:q }]); setTyping(true); setShown("")
    const a = answerFrom(q); setSrc([])
    let i = 0
    const id = setInterval(()=>{
      i += 3; setShown(a.text.slice(0, i))
      if(i >= a.text.length){ clearInterval(id); setTyping(false); setShown(""); setMsgs(m=>[...m, { r:"a", t:a.text }]); setSrc(a.src) }
    }, 22)
  }
  return (
    <section className="section live-demo" id="try">
      <h2 className="section-title">Try it right here</h2>
      <p className="section-sub">Ask this sample document anything. Answers come from the highlighted passage.</p>
      <div className="ld-grid">
        <div className="ld-doc card" aria-label="Sample document">
          <div className="ld-docbar"><span>📄</span><b>{SAMPLE_TITLE}</b></div>
          <div className="ld-page">{SAMPLE.map((s, i)=>(<p key={i} className={src.includes(i) ? "hit" : ""}>{s}</p>))}</div>
        </div>
        <div className="ld-chat card">
          <div className="ld-msgs" ref={endRef} aria-live="polite">
            {msgs.length === 0 && !typing && <div className="ld-empty">👋 Pick a question or type your own.</div>}
            {msgs.map((m, i)=>(<div key={i} className={"ld-msg " + m.r}>{m.t}</div>))}
            {typing && <div className="ld-msg a">{shown || <span className="typing-dots"><i/><i/><i/></span>}</div>}
          </div>
          <div className="ld-chips">{chips.map(c=>(<button key={c} className="chip" onClick={()=>ask(c)}>{c}</button>))}</div>
          <form className="ld-form" onSubmit={e=>{ e.preventDefault(); ask(input) }}>
            <input className="inp" aria-label="Ask the sample document" placeholder="Ask about photosynthesis…" value={input} onChange={e=>setInput(e.target.value)} />
            <button className="btn btn-p btn-sm" type="submit" disabled={typing}>Ask</button>
          </form>
          <p className="ld-note">Sample demo, matched in your browser without AI. Upload your own PDF for the real thing.</p>
        </div>
      </div>
    </section>
  )
}

const STORY = [
  { icon:"📄", title:"Drop in any PDF", body:"Lecture notes, a textbook chapter, past papers. It's read and indexed in seconds, and a copy stays in your browser." },
  { icon:"💬", title:"Ask it anything", body:"Chat with your document in English, Hinglish or Hindi. Every answer points back to a page you can open." },
  { icon:"🧠", title:"Test yourself", body:"Quizzes, flashcards and full mock exams with timers, marking schemes and a topic-wise report." },
  { icon:"🎯", title:"Fix weak spots", body:"Your wrong answers build a map of what you don't know yet, so you practise exactly that." },
  { icon:"🔥", title:"Build the habit", body:"Daily goals, streaks, levels and spaced-repetition reminders keep you coming back." },
]
function StoryVisual({ s }){
  return (
    <div className="sv-frame" key={s}>
      <div className="sv-bar"><span/><span/><span/></div>
      {s === 0 && (<div className="sv-body"><div className="wt-file"><span>📄</span><div><b>Biology_Ch4.pdf</b><i>Indexing 48 pages…</i></div></div><div className="wt-progress"><div/></div><div className="cp-src">✓ Ready to study</div></div>)}
      {s === 1 && (<div className="sv-body"><div className="ld-msg u">Why are leaves green?</div><div className="ld-msg a">Chlorophyll reflects green light and absorbs red and blue.</div><div className="source-chip" style={{ alignSelf:"flex-start" }}>📎 Biology_Ch4.pdf · p.12</div></div>)}
      {s === 2 && (<div className="sv-body"><div className="wt-h">Where does the Calvin cycle happen?</div><div className="wt-opts"><div className="wt-opt">Thylakoid membrane</div><div className="wt-opt right">Stroma</div><div className="wt-opt">Mitochondria</div></div></div>)}
      {s === 3 && (<div className="sv-body"><div className="wt-h">Weak spots</div>{[["Light reactions", 42], ["Calvin cycle", 68], ["Pigments", 91]].map(([t, v])=>(<div key={t} className="sv-bar-row"><span>{t}</span><div><i style={{ width: v + "%" }} /></div><b>{v}%</b></div>))}</div>)}
      {s === 4 && (<div className="sv-body sv-habit"><div className="lvl-badge"><b>5</b><small>LVL</small></div><div><b>🔥 12-day streak</b><span>Daily goal 5/5 · 6 cards due</span></div></div>)}
    </div>
  )
}
export function StoryScroll(){
  const [s, setS] = useState(0)
  const refs = useRef([])
  useEffect(()=>{
    if(!("IntersectionObserver" in window)) return
    const io = new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting) setS(+e.target.dataset.i) }) }, { rootMargin:"-42% 0px -42% 0px" })
    refs.current.forEach(el=>el && io.observe(el))
    return ()=>io.disconnect()
  },[])
  return (
    <section className="section story" id="how-it-works">
      <h2 className="section-title">From PDF to exam-ready</h2>
      <div className="story-grid">
        <div className="story-steps">
          {STORY.map((x, i)=>(
            <div key={i} data-i={i} ref={el=>refs.current[i] = el} className={"story-step" + (s === i ? " on" : "")}>
              <div className="story-n">{x.icon}</div>
              <h3>{x.title}</h3>
              <p>{x.body}</p>
            </div>
          ))}
        </div>
        <div className="story-visual"><StoryVisual s={s} /><div className="story-dots">{STORY.map((_, i)=>(<i key={i} className={s === i ? "on" : ""} />))}</div></div>
      </div>
    </section>
  )
}

export function FactsStrip({ tools }){
  const facts = [[tools + "+", "study tools"], ["3", "answer languages"], ["4", "exam styles: general, NEET, JEE, UPSC"], ["PWA", "install it, works offline for saved decks"]]
  return (
    <section className="facts" aria-label="Key facts">
      {facts.map(([n, l])=>(<div key={l}><b>{n}</b><span>{l}</span></div>))}
    </section>
  )
}

export function GrainMesh(){
  return (
    <>
      <div className="mesh" aria-hidden="true"><i/><i/><i/></div>
      <div className="grain" aria-hidden="true" />
    </>
  )
}

