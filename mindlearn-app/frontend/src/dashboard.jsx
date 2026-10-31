import { lazy, useEffect, useMemo, useRef, useState } from "react"
import { api, sounds, THEMES, PERSONALITIES, CODE_LANGS, ACHIEVEMENTS, TYPING_TEXTS, useLocalState, useDark, useChatHistory, useBookmarks, Spin, Skeleton, CopyBtn, VoiceInput, ProgressBar, Confetti, FUN_META, SIDEBAR_GROUPS, ALL_FUNCTION_KEYS, ICON_BY_KEY, toast, pushNotif, uploadPdfs, downloadFile, printDoc, LANGS, getOutLang, langInstruction, askText, streamChat, chatJSON, chatQuestions, topicOf, recordAnswers } from "./lib.jsx"
import PyqTab from "./pyq.jsx"
import { KnowledgeMapTab, WeakSpotsTab, WeakCard, ExamTab, VoiceTab, SourceChip } from "./features.jsx"
import { savePdfs } from "./pdfstore.js"
import { V24Host, SwipeTab, ListenTab, SketchTab } from "./v24.jsx"
import Rich from "./rich.jsx"
import { DocPicker } from "./docs.jsx"
import { PlannerTab, VoiceCommand } from "./v22.jsx"
import { SpotTour } from "./v28.jsx"
import { UserAvatar, Spark, QuickCapture, SplitView, Logo, Typed, GoalPicker, getProfileGoal } from "./startup.jsx"
import { AchievementEngine, HomeWidgets, PomodoroRunner, PomodoroDock, PomodoroTab as PomoTab2, RouteBar, PALETTE_ACTIONS, pomo } from "./polish.jsx"
import { ShortcutsModal, MyNotesTab, PdfSearchTab, WeeklyReportTab, saveToNotes } from "./extras.jsx"
import { ErrorBoundary, LibraryTab, SettingsTab, BottomNav, useDueCount, ExportBar, notesToHtml, csvCell, ErrBox } from "./production.jsx"
const HeroScene = lazy(()=>import("./HeroScene.jsx"))
const AmbientBG = lazy(()=>import("./AmbientBG.jsx"))

function extractText(data){
  if(!data) return ""
  if(typeof data === "string") return data
  return data.answer || data.reply || data.response || data.notes || data.essay || data.explanation ||
         data.result || data.text || data.content || JSON.stringify(data)
}

/* ============================= FunHeader ============================= */
function FunHeader({ k }){
  const [tips, setTips] = useState(false)
  const meta = FUN_META[k]
  if(!meta) return null
  const icon = ICON_BY_KEY[k] || "✨"
  return (
    <div className="fpage-header">
      <div className="fpage-head-row">
        <div className="fpage-icon">{icon}</div>
        <div className="fpage-head-text">
          <h2>{meta.title}</h2>
          <p className="fpage-tag">{meta.tag}</p>
        </div>
        {meta.tips && <button className="btn btn-ghost btn-sm fpage-tips-btn" onClick={()=>setTips(t=>!t)}>{tips ? "Hide tips" : "💡 Tips"}</button>}
      </div>
      <p className="fpage-desc">{meta.desc}</p>
      {tips && meta.tips && (
        <ul className="fpage-tips">
          {meta.tips.map((t,i)=>(<li key={i}>{t}</li>))}
        </ul>
      )}
    </div>
  )
}

/* ============================= Reveal (scroll-in) ============================= */
function CommandPalette({ open, onClose, onSelect }){
  const [q, setQ] = useState("")
  const [idx, setIdx] = useState(0)
  const [recent] = useLocalState("ml_activity", [])
  const groupOf = useMemo(()=>{ const m = {}; SIDEBAR_GROUPS.forEach(g=>g.items.forEach(([k])=>{ m[k]=g.label })); return m },[])
  const extraItems = useMemo(()=>{
    if(!open) return []
    let notes = [], docs = []
    try{ notes = JSON.parse(localStorage.getItem("ml_mynotes") || "[]").slice(0, 6) }catch(e){}
    try{ docs = Object.entries(JSON.parse(localStorage.getItem("ml_libmeta") || "{}")).sort((a, b)=>b[1] - a[1]).slice(0, 5).map(x=>x[0]) }catch(e){}
    return [...notes.map(n=>({ k:"mynotes", title:n.title || "Untitled note", icon:"🗒️", group:"My notes", tag:"Open My Notes", extra:true })),
            ...docs.map(d=>({ k:"library", title:d, icon:"📄", group:"Documents", tag:"Open library", extra:true }))]
  },[open])
  const items = useMemo(()=>{
    const all = [{ k:"Home", title:"Overview", icon:"🏠", group:"Go to", tag:"Your dashboard home" },
      ...ALL_FUNCTION_KEYS.map(k=>({ k, title: FUN_META[k]?.title || k, icon: ICON_BY_KEY[k], group: groupOf[k], tag: FUN_META[k]?.tag })),
      ...PALETTE_ACTIONS.map(a=>({ ...a, group:"Actions" })),
      ...extraItems]
    if(q.trim()){
      const t = q.toLowerCase()
      return all.filter(it=> (it.title + " " + (it.tag||"") + " " + (it.group||"")).toLowerCase().includes(t))
    }
    const rk = [...new Set(recent.map(a=>a.k))].filter(k=>FUN_META[k]).slice(0,3)
    const rec = rk.map(k=>({ ...all.find(a=>a.k===k), group:"Recent" }))
    return [...rec, ...all.filter(a=>!rk.includes(a.k) || a.group === "Actions" || a.extra)]
  }, [q, recent, groupOf, extraItems])

  useEffect(()=>{ if(open){ setQ(""); setIdx(0) } },[open])
  useEffect(()=>{ document.querySelector(".cmdk-item.active")?.scrollIntoView({ block:"nearest" }) },[idx])

  if(!open) return null
  function onKey(e){
    if(e.key === "ArrowDown"){ e.preventDefault(); setIdx(i=>Math.min(i+1, items.length-1)) }
    else if(e.key === "ArrowUp"){ e.preventDefault(); setIdx(i=>Math.max(i-1,0)) }
    else if(e.key === "Enter"){ e.preventDefault(); if(items[idx]) onSelect(items[idx].k) }
    else if(e.key === "Escape"){ onClose() }
  }
  function mark(title){
    if(!q.trim()) return title
    const at = title.toLowerCase().indexOf(q.toLowerCase())
    if(at < 0) return title
    return <>{title.slice(0,at)}<mark>{title.slice(at, at+q.length)}</mark>{title.slice(at+q.length)}</>
  }
  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk-box" onClick={e=>e.stopPropagation()}>
        <div className="cmdk-search"><span>🔎</span>
          <input autoFocus className="cmdk-input" placeholder="Search tools, or jump to Overview…" value={q}
            onChange={e=>{setQ(e.target.value); setIdx(0)}} onKeyDown={onKey} />
          <kbd>esc</kbd>
        </div>
        <div className="cmdk-list">
          {items.map((it,i)=>(
            <div key={it.group + it.k + it.title}>
              {(i===0 || items[i-1].group !== it.group) && <div className="cmdk-group">{it.group}</div>}
              <div className={"cmdk-item" + (i===idx?" active":"")}
                onMouseEnter={()=>setIdx(i)} onClick={()=>onSelect(it.k)}>
                <span className="cmdk-icon">{it.icon}</span>
                <span className="cmdk-title">{mark(it.title)}</span>
                <span className="cmdk-tag">{it.tag}</span>
                {i===idx && <kbd>↵</kbd>}
              </div>
            </div>
          ))}
          {items.length===0 && <div className="cmdk-empty">No matches for “{q}”</div>}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>⌘1–9</kbd> quick jump</span></div>
      </div>
    </div>
  )
}

/* ============================= Onboarding Tour ============================= */
function OnboardingTour({ onDone }){
  const steps = [
    { title:"Welcome to MindLearn", body:"Your PDF just became dozens of study tools. Let's take a 30-second tour." },
    { title:"The sidebar is home base", body:"Open the ☰ menu anytime to jump between Chat, Notes, Quiz, Code tools and more." },
    { title:"Command Palette", body:"Press ⌘K (or Ctrl+K) to jump straight to any function by typing its name." },
    { title:"You're set", body:"Pin your favorite tools with the star icon so they're always one click away." },
  ]
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(!!getProfileGoal())
  if(!picked) return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Personalise MindLearn">
      <div className="tour-card"><GoalPicker onDone={()=>setPicked(true)} onSkip={()=>setPicked(true)} /></div>
    </div>
  )
  return (
    <div className="tour-overlay">
      <div className="tour-card">
        <div className="tour-step">{i+1} / {steps.length}</div>
        <h3>{steps[i].title}</h3>
        <p>{steps[i].body}</p>
        <div className="tour-actions">
          <button className="btn btn-ghost btn-sm" onClick={onDone}>Skip</button>
          <button className="btn btn-p btn-sm" onClick={()=> i===steps.length-1 ? onDone() : setI(i+1)}>
            {i===steps.length-1 ? "Let's go" : "Next"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================= Generic AI panel (for tools without a dedicated endpoint) ============================= */
function AIPanel({ fkey, placeholder, systemHint, multiline=true }){
  const [input, setInput] = useState("")
  const [out, setOut] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  async function run(){
    if(!input.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const li = langInstruction()
      const full = `${systemHint}${li ? "\n\n" + li : ""}\n\n${input}`
      const { data } = await api.post("/chat", { message: full, question: full })
      setOut(extractText(data))
      sounds.success()
    }catch(ex){
      setErr(ex?.response?.data?.detail || "Couldn't reach the AI. Make sure a PDF is uploaded and try again.")
    }finally{ setLoading(false) }
  }

  return (
    <div className="card">
      {multiline ? (
        <textarea className="inp" rows={4} placeholder={placeholder} value={input} onChange={e=>setInput(e.target.value)} />
      ) : (
        <input className="inp" placeholder={placeholder} value={input} onChange={e=>setInput(e.target.value)} />
      )}
      <div className="row-actions">
        <VoiceInput onResult={t=>setInput(v=>v?v+" "+t:t)} />
        <button className="btn btn-p" disabled={loading} onClick={run}>{loading ? <Spin/> : "Generate"}</button>
      </div>
      {err && <ErrBox msg={err} />}
      {loading && <div className="skel-card"><Skeleton lines={4} /></div>}
      {!loading && !out && !err && <EmptyState icon="✨" title="Nothing generated yet" body="Describe what you need above and hit Generate." />}
      {!loading && out && (
        <div className="msg assistant">
          <div className="msg-body"><Rich text={out} /></div>
          <CopyBtn text={out} />
        </div>
      )}
    </div>
  )
}

/* ============================= Chat ============================= */
function Chat(){
  const [history, setHistory] = useChatHistory()
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [personality, setPersonality] = useLocalState("ml_personality", "friendly")
  const endRef = useRef()
  const freshRef = useRef("")

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:"smooth" }) }, [history, loading])
  // a question typed in the Home "Quick ask" bar arrives here
  useEffect(()=>{ try{ const v = localStorage.getItem("ml_prefill"); if(v){ localStorage.removeItem("ml_prefill"); setTimeout(()=>send(v), 150) } }catch(e){} },[])

  async function send(override){
    const raw = typeof override === "string" ? override : input
    if(!raw.trim()) return
    const userMsg = { role:"user", text: raw }
    const q = raw
    const past = history.filter(m=>!String(m.text).startsWith("⚠️")).slice(-6).map(m=>({ role: m.role, text: String(m.text).slice(0, 1200) }))
    const persona = PERSONALITIES[personality] + (langInstruction() ? " " + langInstruction() : "")
    setHistory(h=>[...h, userMsg])
    setInput(""); setLoading(true)
    let started = false
    setStreaming(true)
    try{
      let acc = ""
      const { sources } = await streamChat({ message: q, question: q, personality: persona, history: past }, d=>{
        acc += d
        if(!started){ started = true; freshRef.current = ""; setLoading(false); setHistory(h=>[...h, { role:"assistant", text: acc }]) }
        else setHistory(h=>{ const n = h.slice(); n[n.length - 1] = { ...n[n.length - 1], text: acc }; return n })
        endRef.current?.scrollIntoView({ block:"end" })
      })
      setHistory(h=>{ const n = h.slice(); n[n.length - 1] = { ...n[n.length - 1], sources }; return n })
      sounds.pop()
    }catch(se){
      if(started){
        setHistory(h=>{ const n = h.slice(); n[n.length - 1] = { ...n[n.length - 1], text: n[n.length - 1].text + "\n\n⚠️ The answer was cut off. Ask again to retry." }; return n })
      } else {
        // streaming unavailable (older backend, proxy, etc.) -> normal request
        try{
          const { data } = await api.post("/chat", { message: q, question: q, personality: persona, history: past })
          const ans = extractText(data); freshRef.current = ans
          setHistory(h=>[...h, { role:"assistant", text: ans, sources: data?.sources }])
          sounds.pop()
        }catch(ex){
          setHistory(h=>[...h, { role:"assistant", text: "⚠️ " + (ex?.response?.data?.detail || "Something went wrong reaching the AI.") }])
        }
      }
    }finally{ setLoading(false); setStreaming(false) }
  }

  return (
    <div className="card chat-card">
      <div className="chat-toolbar">
        <select className="sel" aria-label="Tutor personality" value={personality} onChange={e=>setPersonality(e.target.value)}>
          {Object.keys(PERSONALITIES).map(p=>(<option key={p} value={p}>{p}</option>))}
        </select>
        <DocPicker />
        <button className="btn btn-ghost btn-sm split-btn" onClick={()=>window.dispatchEvent(new Event("ml-split"))}>📖 Split view</button>
        {history.length>0 && <button className="btn btn-ghost btn-sm" onClick={()=>downloadFile("mindlearn-chat.md", history.map(m=>(m.role==="user" ? "**You:** " : "**MindLearn:** ") + m.text).join("\n\n"), "text/markdown")}>⬇ Export</button>}
        <button className="btn btn-ghost btn-sm" onClick={()=>setHistory([])}>Clear chat</button>
      </div>
      <div className="chat-box">
        {history.length===0 && (
          <EmptyState icon="💬" title="Ask anything about your PDF" body="Start with a suggestion or type your own question.">
            <div className="suggest-row">
              {["Summarise this document","What are the key terms?","Explain the hardest part simply"].map(t=>(
                <button key={t} className="chip" onClick={()=>setInput(t)}>{t}</button>
              ))}
            </div>
          </EmptyState>
        )}
        {history.map((m,i)=>(
          <div key={i} className={"msg " + m.role}>
            <div className="msg-body">{m.role==="assistant" ? (i===history.length-1 && m.text===freshRef.current ? <Typed text={m.text} onTick={()=>endRef.current?.scrollIntoView({ block:"end" })} /> : <Rich text={m.text} streaming={streaming && i===history.length-1} />) : m.text}</div>
            {m.role==="assistant" && <div className="msg-tools"><CopyBtn text={m.text} /><button className="btn btn-ghost btn-sm" onClick={()=>saveToNotes((history[i-1]?.text || "Chat answer").slice(0,60), m.text)}>💾 Save</button><SourceChip text={m.text} sources={m.sources} /></div>}
          </div>
        ))}
        {loading && <div className="msg assistant typing"><span className="typing-dots"><i/><i/><i/></span></div>}
        <div ref={endRef} />
      </div>
      <div className="chat-input-row">
        <input className="inp" placeholder="Ask something..." value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") send() }} />
        <VoiceInput onResult={t=>setInput(v=>v?v+" "+t:t)} />
        <button className="btn btn-p" disabled={loading} onClick={send}>Send</button>
      </div>
    </div>
  )
}

/* ============================= Notes ============================= */
function Notes(){
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  async function gen(){
    setLoading(true); setErr("")
    try{
      if(getOutLang() !== "en"){
        setNotes(await askText("Create clear, well-structured study notes from the uploaded document, organised by topic with short bullet points. " + langInstruction()))
      }else{
        const { data } = await api.post("/notes", {})
        setNotes(extractText(data))
      }
    }catch(ex){ setErr(ex?.response?.data?.detail || "Couldn't generate notes.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <button className="btn btn-p" disabled={loading} onClick={gen}>{loading ? <Spin/> : "Generate Notes"}</button> <button className="btn btn-ghost btn-sm split-btn" onClick={()=>window.dispatchEvent(new Event("ml-split"))}>📖 Split view</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <div className="skel-card"><Skeleton lines={6}/></div>}
      {!loading && !notes && !err && <EmptyState icon="📝" title="No notes yet" body="Generate structured study notes from your uploaded PDF." />}
      {!loading && notes && (
        <>
          <div className="msg assistant"><div className="msg-body"><Rich text={notes} /></div><CopyBtn text={notes}/></div>
          <ExportBar items={[["⬇ Markdown", ()=>downloadFile("mindlearn-notes.md", notes, "text/markdown")], ["🖨 Save as PDF", ()=>printDoc("Study notes", notesToHtml(notes))], ["💾 Save to My Notes", ()=>saveToNotes("Study notes · " + new Date().toLocaleDateString(), notes)]]} />
        </>
      )}
    </div>
  )
}

/* ============================= Shared: empty state, score ring ============================= */
function EmptyState({ icon="✨", title, body, children }){
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {body && <div className="empty-body">{body}</div>}
      {children}
    </div>
  )
}

function ScoreRing({ pct }){
  const [v, setV] = useState(0)
  useEffect(()=>{ const t = setTimeout(()=>setV(pct), 80); return ()=>clearTimeout(t) },[pct])
  const R = 52, C = 2*Math.PI*R
  return (
    <div className="score-ring">
      <svg viewBox="0 0 120 120" width="132" height="132">
        <defs><linearGradient id="srg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2DE3F0"/><stop offset="1" stopColor="#8B6BFF"/></linearGradient></defs>
        <circle cx="60" cy="60" r={R} className="sr-track" />
        <circle cx="60" cy="60" r={R} className="sr-fill" strokeDasharray={C} strokeDashoffset={C*(1 - v/100)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="sr-num">{pct}<small>%</small></div>
    </div>
  )
}

/* ============================= Flashcards ============================= */
function Flashcards(){
  const [cards, setCards] = useState([])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [known, setKnown] = useState({})
  const [deck, setDeck] = useLocalState("ml_deck", [])
  const impRef = useRef()
  function importDeck(file){
    if(!file) return
    const r = new FileReader()
    r.onload = ()=>{ try{ const j = JSON.parse(r.result); const arr = (j.cards || j).filter(c=>c && c.q); if(!arr.length) throw 0; setCards(arr); setDeck(arr); setI(0); setKnown({}); toast(`Imported ${arr.length} cards.`, "ok") }catch(e){ toast("That file isn't a valid deck.", "error") } }
    r.readAsText(file)
  }

  async function gen(){
    setLoading(true); setErr(""); setCards([]); setI(0); setFlipped(false); setKnown({})
    try{
      let arr
      if(getOutLang() !== "en"){
        const d = await chatJSON("Make 10 flashcards from the uploaded document. " + langInstruction() + " (keep JSON keys in English). Respond with ONLY valid JSON: {\"cards\":[{\"q\":\"...\",\"a\":\"...\"}]}")
        arr = Array.isArray(d) ? d : (d.cards || d.flashcards)
      }else{
        const { data } = await api.post("/flashcards", {})
        arr = data.flashcards || data.cards || data.result
      }
      if(typeof arr === "string"){
        arr = arr.split(/\n+/).filter(Boolean).map(line=>{
          const [q,a] = line.split(/[:|-]{1}/).map(s=>s?.trim())
          return { q: q || line, a: a || "" }
        })
      }
      const okArr = (Array.isArray(arr) ? arr : []).map(c=>({ q: c.q || c.term || c.question || c.front || "", a: c.a || c.definition || c.answer || c.back || "" })).filter(c=>c.q)
      setCards(okArr)
      if(okArr.length) setDeck(okArr)
    }catch(ex){ setErr(ex?.response?.data?.detail || ex.message || "Couldn't generate flashcards.") }
    finally{ setLoading(false) }
  }

  const go = (d)=>{ setI(v=>Math.min(Math.max(v+d,0), cards.length-1)); setFlipped(false) }
  useEffect(()=>{
    if(!cards.length) return
    function onKey(e){
      if(/input|textarea|select/i.test(e.target.tagName)) return
      if(e.key==="ArrowRight") go(1)
      else if(e.key==="ArrowLeft") go(-1)
      else if(e.key===" "){ e.preventDefault(); setFlipped(f=>!f) }
    }
    window.addEventListener("keydown", onKey)
    return ()=>window.removeEventListener("keydown", onKey)
  },[cards.length])

  function mark(v){
    setKnown(k=>({...k,[i]:v}))
    if(i < cards.length-1) go(1)
  }
  function shuffle(){
    setCards(c=>[...c].sort(()=>Math.random()-0.5)); setI(0); setFlipped(false); setKnown({})
  }

  const card = cards[i]
  const knownCount = Object.values(known).filter(Boolean).length
  return (
    <div className="card">
      <div className="tool-actions">
        <button className="btn btn-p" disabled={loading} onClick={gen}>{loading ? <Spin/> : (cards.length ? "Regenerate" : "Generate Flashcards")}</button>
        {cards.length>0 && <button className="btn btn-ghost" onClick={shuffle}>🔀 Shuffle</button>}
        {cards.length>0 && <button className="btn btn-ghost" onClick={()=>downloadFile("mindlearn-flashcards.txt", cards.map(c=>String(c.q||"").replace(/\t|\n/g," ") + "\t" + String(c.a||"").replace(/\t|\n/g," ")).join("\n"))} title="Tab-separated: import into Anki or Quizlet">⬇ Anki</button>}
        {cards.length>0 && <button className="btn btn-ghost" onClick={()=>downloadFile("mindlearn-deck.json", JSON.stringify({ app:"mindlearn-deck", cards }, null, 1), "application/json")} title="Share this deck with a friend">⬇ Share</button>}
        <button className="btn btn-ghost" onClick={()=>impRef.current?.click()}>⬆ Import</button><input ref={impRef} type="file" accept="application/json" hidden onChange={e=>{ importDeck(e.target.files[0]); e.target.value="" }} />
        {cards.length>0 && <button className="btn btn-ghost" onClick={()=>downloadFile("mindlearn-flashcards.csv", "Question,Answer\n" + cards.map(c=>csvCell(c.q)+","+csvCell(c.a)).join("\n"), "text/csv")}>⬇ CSV</button>}
      </div>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <div className="skel-card"><Skeleton lines={3}/></div>}
      {!loading && !card && !err && (
        <EmptyState icon="🗂️" title="No flashcards yet" body="Generate a deck from your uploaded PDF, then flip through it with ← → and Space.">
          {deck.length > 0 && <button className="btn btn-ghost btn-sm" style={{marginTop:14}} onClick={()=>{ setCards(deck); setI(0); setKnown({}) }}>📦 Open last deck ({deck.length} cards, works offline)</button>}
        </EmptyState>
      )}
      {!loading && card && (
        <div className="fc-wrap">
          <div className="fc-progress"><div style={{ width: ((i+1)/cards.length*100)+"%" }}/></div>
          <div className="fc-meta"><span>Card {i+1} of {cards.length}</span><span>✓ {knownCount} known</span></div>
          <div className={"fc" + (flipped?" flipped":"")} onClick={()=>setFlipped(f=>!f)} key={i}>
            <div className="fc-face fc-front"><small>Question</small>{card.q}</div>
            <div className="fc-face fc-back"><small>Answer</small>{card.a}</div>
          </div>
          <div className="fc-nav">
            <button className="btn btn-ghost btn-sm" onClick={()=>go(-1)} aria-label="Previous">◀</button>
            <button className="btn btn-ghost btn-sm fc-again" onClick={()=>mark(false)}>↻ Review again</button>
            <button className="btn btn-p btn-sm" onClick={()=>mark(true)}>✓ Got it</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>go(1)} aria-label="Next">▶</button>
          </div>
          <div className="fc-hint">Tip: <kbd>←</kbd> <kbd>→</kbd> to move · <kbd>Space</kbd> to flip</div>
        </div>
      )}
    </div>
  )
}

/* ============================= Quiz ============================= */
function Quiz({ loader, autoStart = false } = {}){
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [err, setErr] = useState("")
  const [scores, setScores] = useLocalState("ml_scores", [])
  const [fire, setFire] = useState(false)

  async function gen(){
    setLoading(true); setErr(""); setQuestions([]); setAnswers({}); setSubmitted(false)
    try{
      let qs
      if(loader) qs = await loader()
      else if(getOutLang() !== "en") qs = await chatQuestions({ count:5 })
      else { const { data } = await api.post("/quiz", {}); qs = data.questions || data.quiz || [] }
      setQuestions(Array.isArray(qs) ? qs : [])
    }catch(ex){ setErr(ex?.response?.data?.detail || ex.message || "Couldn't generate quiz.") }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ if(autoStart) gen() },[])
  const n = questions.length
  const answered = Object.keys(answers).length
  const correct = questions.reduce((c,q,i)=> c + ((answers[i] === q.answer || answers[i] === q.correct) ? 1 : 0), 0)
  const pct = n ? Math.round((correct/n)*100) : 0

  function submit(){
    setSubmitted(true)
    setScores(s=>[...s, { date: new Date().toISOString(), pct }])
    recordAnswers(questions.map((q,i)=>({ topic: topicOf(q), ok: answers[i] === (q.answer || q.correct), q: q.question || q.q })))
    if(pct >= 70){ setFire(true); sounds.success(); setTimeout(()=>setFire(false), 2000) }
    setTimeout(()=>document.querySelector(".result-card")?.scrollIntoView({ behavior:"smooth", block:"center" }), 120)
  }
  const verdict = pct >= 90 ? "Outstanding!" : pct >= 70 ? "Nicely done" : pct >= 40 ? "Getting there" : "Keep practicing"

  return (
    <div className="card">
      <Confetti fire={fire} />
      <div className="tool-actions">
        <button className="btn btn-p" disabled={loading} onClick={gen}>{loading ? <Spin/> : (n ? "New Quiz" : "Generate Quiz")}</button>
      </div>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <div className="skel-card"><Skeleton lines={5}/></div>}
      {!loading && n===0 && !err && (
        <EmptyState icon="🎯" title="Ready when you are" body="Generate a quiz from your PDF. Your score is saved to your progress charts." />
      )}
      {!loading && n>0 && !submitted && (
        <div className="quiz-progress">
          <div className="qp-bar"><div style={{ width: (answered/n*100)+"%" }}/></div>
          <span>{answered}/{n} answered</span>
        </div>
      )}
      {!loading && questions.map((q,i)=>(
        <div key={i} className="qcard" style={{"--i":i}}>
          <div className="q-text"><span className="q-num">{i+1}</span>{q.question || q.q}</div>
          {(q.options || q.choices || []).map((opt,j)=>(
            <label key={j} className={"qopt" + (submitted ? (opt===(q.answer||q.correct) ? " correct" : (answers[i]===opt ? " wrong":"")) : (answers[i]===opt ? " selected" : ""))}>
              <input type="radio" name={"q"+i} checked={answers[i]===opt} disabled={submitted}
                onChange={()=>setAnswers(a=>({...a,[i]:opt}))} />
              <span className="qopt-key">{String.fromCharCode(65+j)}</span>{opt}
              {submitted && opt===(q.answer||q.correct) && <span className="qopt-mark">✓</span>}
              {submitted && answers[i]===opt && opt!==(q.answer||q.correct) && <span className="qopt-mark">✕</span>}
            </label>
          ))}
          {submitted && q.explanation && <div className="q-why"><b>{answers[i]===(q.answer||q.correct) ? "✓ " : "💡 "}Why:</b> {q.explanation}</div>}
        </div>
      ))}
      {!loading && n>0 && !submitted && (
        <button className="btn btn-p" style={{marginTop:14}} disabled={answered<n} onClick={submit}>{answered<n ? `Answer all questions (${n-answered} left)` : "Submit Quiz"}</button>
      )}
      {submitted && (
        <div className="result-card">
          <ScoreRing pct={pct} />
          <div className="result-text">
            <h3>{verdict}</h3>
            <p>{correct} of {n} correct</p>
            <button className="btn btn-p btn-sm" onClick={gen}>Try a new quiz</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================= YouTube Notes ============================= */
function YouTube(){
  const [url, setUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  async function gen(){
    if(!url.trim()) return
    setLoading(true); setErr(""); setNotes("")
    try{
      const { data } = await api.post("/youtube", { url, video_url: url })
      setNotes(extractText(data))
    }catch(ex){ setErr(ex?.response?.data?.detail || "Couldn't process that video.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <input className="inp" placeholder="Paste a YouTube link..." value={url} onChange={e=>setUrl(e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Summarize Video"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={6}/>}
      {!loading && notes && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body" style={{whiteSpace:"pre-wrap"}}>{notes}</div><CopyBtn text={notes}/></div>}
    </div>
  )
}

/* ============================= Essay ============================= */
function Essay(){
  const [topic, setTopic] = useState("")
  const [words, setWords] = useState(500)
  const [essay, setEssay] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  async function gen(){
    if(!topic.trim()) return
    setLoading(true); setErr(""); setEssay("")
    try{
      const { data } = await api.post("/essay", { topic, words, word_count: words })
      setEssay(extractText(data))
    }catch(ex){ setErr(ex?.response?.data?.detail || "Couldn't write the essay.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <input className="inp" placeholder="Essay topic..." value={topic} onChange={e=>setTopic(e.target.value)} />
      <input className="inp" type="number" style={{marginTop:8}} value={words} onChange={e=>setWords(+e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Write Essay"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={8}/>}
      {!loading && essay && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body" style={{whiteSpace:"pre-wrap"}}>{essay}</div><CopyBtn text={essay}/></div>}
    </div>
  )
}

/* ============================= ELI5 ============================= */
function ELI5(){
  const [topic, setTopic] = useState("")
  const [out, setOut] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  async function gen(){
    if(!topic.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const { data } = await api.post("/eli5", { topic, text: topic })
      setOut(extractText(data))
    }catch(ex){ setErr(ex?.response?.data?.detail || "Couldn't simplify that.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <textarea className="inp" rows={3} placeholder="Paste the confusing part..." value={topic} onChange={e=>setTopic(e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Explain Simply"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={4}/>}
      {!loading && out && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body">{out}</div><CopyBtn text={out}/></div>}
    </div>
  )
}

/* ============================= Debate ============================= */
function SelfDebate(){
  const [topic, setTopic] = useState("")
  const [out, setOut] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  async function gen(){
    if(!topic.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const { data } = await api.post("/debate", { topic })
      setOut(extractText(data))
    }catch(ex){ setErr(ex?.response?.data?.detail || "Couldn't generate the debate.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <input className="inp" placeholder="A claim or topic to debate..." value={topic} onChange={e=>setTopic(e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Generate Both Sides"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={6}/>}
      {!loading && out && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body" style={{whiteSpace:"pre-wrap"}}>{out}</div><CopyBtn text={out}/></div>}
    </div>
  )
}

/* ============================= Achievements ============================= */
function AchievementsPanel(){
  const [unlocked] = useLocalState("ml_achievements", ["first_upload"])
  return (
    <div className="card">
      <div className="achievement-grid">
        {ACHIEVEMENTS.map(a=>(
          <div key={a.id} className={"achievement" + (unlocked.includes(a.id) ? " unlocked" : "")}>
            <div className="ach-icon">{a.icon}</div>
            <div className="ach-label">{a.label}</div>
            <div className="ach-desc">{a.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================= Compare ============================= */
function CompareTab(){
  const [a, setA] = useState(""); const [b, setB] = useState("")
  const [out, setOut] = useState(""); const [loading, setLoading] = useState(false); const [err,setErr]=useState("")
  async function gen(){
    if(!a.trim() || !b.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const prompt = `Compare these two concepts from the document in a structured table with dimensions like definition, key traits, and use-case: "${a}" vs "${b}".`
      const { data } = await api.post("/chat", { message: prompt, question: prompt })
      setOut(extractText(data))
    }catch(ex){ setErr("Couldn't generate the comparison.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <input className="inp" placeholder="Concept A" value={a} onChange={e=>setA(e.target.value)} />
      <input className="inp" style={{marginTop:8}} placeholder="Concept B" value={b} onChange={e=>setB(e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Compare"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={5}/>}
      {!loading && out && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body" style={{whiteSpace:"pre-wrap"}}>{out}</div><CopyBtn text={out}/></div>}
    </div>
  )
}

/* ============================= Pomodoro ============================= */
function PomodoroTab(){
  const [seconds, setSeconds] = useState(25*60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useLocalState("ml_pomodoro", 0)
  useEffect(()=>{
    if(!running) return
    if(seconds<=0){ setRunning(false); setSessions(s=>s+1); sounds.success(); return }
    const t = setInterval(()=>setSeconds(s=>s-1), 1000)
    return ()=>clearInterval(t)
  },[running, seconds])
  const mm = String(Math.floor(seconds/60)).padStart(2,"0")
  const ss = String(seconds%60).padStart(2,"0")
  return (
    <div className="card" style={{textAlign:"center"}}>
      <div className="timer-display">{mm}:{ss}</div>
      <div className="row-actions" style={{justifyContent:"center"}}>
        <button className="btn btn-p" onClick={()=>setRunning(r=>!r)}>{running ? "Pause" : "Start"}</button>
        <button className="btn btn-ghost" onClick={()=>{ setRunning(false); setSeconds(25*60) }}>Reset</button>
      </div>
      <p className="profile-email">Completed sessions: {sessions}</p>
    </div>
  )
}

/* ============================= Vocab Quiz ============================= */
function VocabQuizTab(){ return <AIPanel fkey="vocabquiz" placeholder="Type 'start' to get a vocabulary quiz from your document." systemHint="Generate a short vocabulary quiz (5 terms with definitions to match) from the uploaded document, based on this request:" /> }

/* ============================= Concept Map ============================= */
function ConceptMapTab(){ return <AIPanel fkey="map" placeholder="Describe which topic to map out, or type 'overview'." systemHint="Build a hierarchical concept map (as indented text) connecting the main ideas in the uploaded document, based on:" /> }

/* ============================= Study Plan ============================= */
function StudyPlanTab(){
  const [days, setDays] = useState(7)
  const [hours, setHours] = useState(2)
  const [out, setOut] = useState(""); const [loading, setLoading] = useState(false); const [err,setErr]=useState("")
  async function gen(){
    setLoading(true); setErr(""); setOut("")
    try{
      const prompt = `Create a day-by-day study plan for ${days} days, ${hours} hours/day, based on the uploaded document.`
      const { data } = await api.post("/chat", { message: prompt, question: prompt })
      setOut(extractText(data))
    }catch(ex){ setErr("Couldn't generate the plan.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <div className="row-actions">
        <label>Days <input className="inp" type="number" value={days} onChange={e=>setDays(+e.target.value)} style={{width:80}} /></label>
        <label>Hrs/day <input className="inp" type="number" value={hours} onChange={e=>setHours(+e.target.value)} style={{width:80}} /></label>
      </div>
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Build Plan"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={6}/>}
      {!loading && out && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body" style={{whiteSpace:"pre-wrap"}}>{out}</div><CopyBtn text={out}/></div>}
    </div>
  )
}

/* ============================= Mock Interview ============================= */
function MockInterviewTab(){ return <AIPanel fkey="interview" placeholder="What role or subject should the interview focus on?" systemHint="Act as an interviewer and ask 5 interview-style questions based on the uploaded document, for this focus:" /> }

/* ============================= Theme Picker ============================= */
function ThemePicker(){
  const [theme, setTheme] = useLocalState("ml_theme", "nova")
  return (
    <div className="card">
      <div className="theme-grid">
        {Object.entries(THEMES).map(([k,t])=>(
          <button key={k} className={"theme-swatch" + (theme===k ? " active":"")} onClick={()=>setTheme(k)}
            style={{ background:`linear-gradient(135deg, ${t.v}, ${t.cy})` }}>
            {t.name}
          </button>
        ))}
      </div>
      <p className="profile-email" style={{marginTop:12}}>The accent colour applies across the whole app. The 3D scenes keep their original colours.</p>
    </div>
  )
}

/* ============================= Leaderboard ============================= */
function LeaderboardTab(){
  const [scores] = useLocalState("ml_scores", [])
  const avg = scores.length ? Math.round(scores.reduce((a,s)=>a+s.pct,0)/scores.length) : 0
  return (
    <div className="card">
      <div className="stat-row">
        <div className="stat-card"><b>{scores.length}</b><span>Quizzes taken</span></div>
        <div className="stat-card"><b>{avg}%</b><span>Average score</span></div>
        <div className="stat-card"><b>{scores.length ? scores[scores.length-1].pct : 0}%</b><span>Last score</span></div>
      </div>
      <div style={{marginTop:14}}>
        {scores.slice().reverse().slice(0,10).map((s,i)=>(
          <ProgressBar key={i} value={s.pct} max={100} label={new Date(s.date).toLocaleDateString()} />
        ))}
        {scores.length===0 && <div className="empty-hint">No quiz scores yet — try the Quiz tool first.</div>}
      </div>
    </div>
  )
}

/* ============================= Custom Prompt ============================= */
function CustomPromptTab(){
  const [prompt, setPrompt] = useLocalState("ml_sysprompt", "")
  return (
    <div className="card">
      <textarea className="inp" rows={5} placeholder="e.g. Always answer using bullet points and keep it under 100 words." value={prompt} onChange={e=>setPrompt(e.target.value)} />
      <p className="profile-email" style={{marginTop:8}}>This instruction is saved locally and sent along with your chat questions.</p>
    </div>
  )
}

/* ============================= Typing Test ============================= */
function TypingTestTab(){
  const text = useMemo(()=> TYPING_TEXTS[Math.floor(Math.random()*TYPING_TEXTS.length)], [])
  const [typed, setTyped] = useState("")
  const [start, setStart] = useState(null)
  const [wpm, setWpm] = useState(null)
  function onChange(v){
    if(!start) setStart(Date.now())
    setTyped(v)
    if(v.trim() === text.trim()){
      const mins = (Date.now()-start)/60000
      const words = text.split(" ").length
      setWpm(Math.round(words/Math.max(mins,0.01)))
    }
  }
  return (
    <div className="card">
      <p className="typing-sample">{text}</p>
      <textarea className="inp" rows={3} value={typed} onChange={e=>onChange(e.target.value)} placeholder="Start typing..." />
      {wpm && <div className="result-banner">{wpm} WPM — nice!</div>}
      <button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>{ setTyped(""); setStart(null); setWpm(null) }}>Reset</button>
    </div>
  )
}

/* ============================= Mnemonics ============================= */
function MnemonicsTab(){ return <AIPanel fkey="mnemonics" placeholder="Paste the list you need to remember (comma or line separated)..." systemHint="Create a memorable mnemonic (acronym or phrase) for this list, explaining how each letter maps to an item:" /> }

/* ============================= Difficulty Rater ============================= */
function DifficultyRater(){ return <AIPanel fkey="difficulty" placeholder="Which topic from your document should be rated?" systemHint="Rate how difficult this topic is likely to be to master (Easy/Medium/Hard) and explain why in 2-3 sentences, based on the uploaded document:" multiline={false} /> }

/* ============================= Spaced Repetition ============================= */
function SpacedRepetitionTab(){
  const [cards, setCards] = useLocalState("ml_srs", [])
  const [loading, setLoading] = useState(false)
  async function gen(){
    setLoading(true)
    try{
      const { data } = await api.post("/flashcards", {})
      let arr = data.flashcards || data.cards || []
      if(typeof arr === "string") arr = arr.split(/\n+/).filter(Boolean).map(l=>({ q:l, a:"" }))
      setCards(arr.map(c=>({ q: c.q || c.term || c.question || "", a: c.a || c.definition || c.answer || "", interval:1, due: Date.now() })).filter(c=>c.q))
    }catch(ex){} finally{ setLoading(false) }
  }
  const due = cards.filter(c=>c.due <= Date.now())
  function rate(idx, good){
    setCards(cs=>cs.map((c,i)=>{
      if(i!==idx) return c
      const interval = good ? Math.max(1, c.interval*2) : 1
      return { ...c, interval, due: Date.now() + interval*86400000 }
    }))
  }
  return (
    <div className="card">
      <button className="btn btn-p" disabled={loading} onClick={gen}>{loading ? <Spin/> : "Build Review Deck"}</button>
      <p className="profile-email" style={{marginTop:8}}>{due.length} card(s) due for review today.</p>
      {due.slice(0,1).map((c, i)=>{
        const idx = cards.indexOf(c)
        return (
          <div key={idx} className="card" style={{marginTop:10}}>
            <div className="q-text">{c.q}</div>
            <div className="profile-email">{c.a}</div>
            <div className="row-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>rate(idx,false)}>Forgot</button>
              <button className="btn btn-p btn-sm" onClick={()=>rate(idx,true)}>Remembered</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ============================= Reading Tracker ============================= */
function ReadingTrackerTab(){
  const [pct, setPct] = useLocalState("ml_reading", 0)
  return (
    <div className="card">
      <ProgressBar value={pct} max={100} label="Document progress" />
      <input type="range" min={0} max={100} value={pct} onChange={e=>setPct(+e.target.value)} style={{width:"100%", marginTop:10}} />
      <p className="profile-email">{pct}% studied so far.</p>
    </div>
  )
}

/* ============================= Multi-PDF Chat ============================= */
function MultiPDFChat(){
  const [files, setFiles] = useState([])
  const [input, setInput] = useState("")
  const [out, setOut] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  async function upload(e){
    const fl = Array.from(e.target.files || [])
    setFiles(fl)
    const form = new FormData()
    fl.forEach(f=>form.append("files", f))
    try{ await api.post("/upload", form, { headers:{ "Content-Type":"multipart/form-data" } }) }
    catch(ex){ setErr("Upload failed — make sure you're signed in.") }
  }
  async function ask(){
    if(!input.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const { data } = await api.post("/chat", { message: input, question: input })
      setOut(extractText(data))
    }catch(ex){ setErr("Couldn't get an answer.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <input type="file" multiple accept="application/pdf" onChange={upload} />
      <div className="profile-email" style={{marginTop:6}}>{files.length} file(s) loaded</div>
      <input className="inp" style={{marginTop:10}} placeholder="Ask across all your documents..." value={input} onChange={e=>setInput(e.target.value)} />
      <button className="btn btn-p" style={{marginTop:10}} disabled={loading} onClick={ask}>{loading ? <Spin/> : "Ask"}</button>
      {err && <ErrBox msg={err} />}
      {loading && <Skeleton lines={4}/>}
      {!loading && out && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body">{out}</div><CopyBtn text={out}/></div>}
    </div>
  )
}

/* ============================= Code tools ============================= */
function CodeGeneratorTab(){
  const [lang, setLang] = useLocalState("ml_lang", "Python")
  const [desc, setDesc] = useState("")
  const [out, setOut] = useState(""); const [loading, setLoading] = useState(false); const [err,setErr]=useState("")
  async function gen(){
    if(!desc.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const prompt = `Write ${lang} code for: ${desc}. Return only the code with brief comments.`
      const { data } = await api.post("/chat", { message: prompt, question: prompt })
      setOut(extractText(data))
    }catch(ex){ setErr("Couldn't generate code.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <select className="sel" value={lang} onChange={e=>setLang(e.target.value)}>
        {CODE_LANGS.map(l=>(<option key={l}>{l}</option>))}
      </select>
      <textarea className="inp" rows={3} style={{marginTop:8}} placeholder="Describe what the code should do..." value={desc} onChange={e=>setDesc(e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Generate Code"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={6}/>}
      {!loading && out && <pre className="code-block">{out}<CopyBtn text={out}/></pre>}
    </div>
  )
}

function CodeDebuggerTab(){
  const [code, setCode] = useState(""); const [errMsg, setErrMsg] = useState("")
  const [out, setOut] = useState(""); const [loading, setLoading] = useState(false); const [err,setErr]=useState("")
  async function gen(){
    if(!code.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const prompt = `Find and fix the bug in this code. Error message: "${errMsg}".\n\nCode:\n${code}`
      const { data } = await api.post("/chat", { message: prompt, question: prompt })
      setOut(extractText(data))
    }catch(ex){ setErr("Couldn't debug that.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <textarea className="inp" rows={6} placeholder="Paste your code..." value={code} onChange={e=>setCode(e.target.value)} />
      <input className="inp" style={{marginTop:8}} placeholder="Error message (optional)" value={errMsg} onChange={e=>setErrMsg(e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Debug Code"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={6}/>}
      {!loading && out && <pre className="code-block">{out}<CopyBtn text={out}/></pre>}
    </div>
  )
}

function CodeReviewerTab(){
  const [code, setCode] = useState("")
  const [out, setOut] = useState(""); const [loading, setLoading] = useState(false); const [err,setErr]=useState("")
  async function gen(){
    if(!code.trim()) return
    setLoading(true); setErr(""); setOut("")
    try{
      const prompt = `Review this code for bugs, style, and best practices. List issues by severity.\n\n${code}`
      const { data } = await api.post("/chat", { message: prompt, question: prompt })
      setOut(extractText(data))
    }catch(ex){ setErr("Couldn't review that.") }
    finally{ setLoading(false) }
  }
  return (
    <div className="card">
      <textarea className="inp" rows={6} placeholder="Paste your code..." value={code} onChange={e=>setCode(e.target.value)} />
      <button className="btn btn-p" disabled={loading} onClick={gen} style={{marginTop:10}}>{loading ? <Spin/> : "Review Code"}</button>
      {err && <ErrBox msg={err} onRetry={gen} />}
      {loading && <Skeleton lines={6}/>}
      {!loading && out && <div className="msg assistant" style={{marginTop:10}}><div className="msg-body" style={{whiteSpace:"pre-wrap"}}>{out}</div><CopyBtn text={out}/></div>}
    </div>
  )
}

function AlgorithmVisualizerTab(){ return <AIPanel fkey="algorithm" placeholder="Name an algorithm (e.g. 'binary search', 'quicksort')..." systemHint="Explain this algorithm step-by-step in plain language, including its time complexity:" multiline={false} /> }

function CodeQuizTab(){ return <AIPanel fkey="codequiz" placeholder="Which language or topic should the code quiz cover?" systemHint="Generate 3 short code-output-prediction quiz questions (with answers hidden below a spoiler line) for:" multiline={false} /> }

function ImageGenTab(){ return <AIPanel fkey="image" placeholder="Describe the concept to visualize..." systemHint="Describe, in vivid structured detail, a diagram or visual breakdown explaining this concept from the document:" multiline={false} /> }

function BookmarksTab(){
  const [bms] = useBookmarks()
  return (
    <div className="card">
      {bms.length===0 && <div className="empty-hint">No bookmarks yet — use the Copy/Bookmark actions across the app.</div>}
      {bms.map((b,i)=>(
        <div key={i} className="msg assistant" style={{marginBottom:10}}>
          <div className="msg-body" style={{whiteSpace:"pre-wrap"}}>{b.text || b}</div>
        </div>
      ))}
    </div>
  )
}

/* ============================= Map tabs → components ============================= */
function getTabComponent(key){
  const map = {
    chat: Chat, notes: Notes, flashcards: Flashcards, quiz: Quiz, youtube: YouTube, essay: Essay, eli5: ELI5,
    achievements: AchievementsPanel, compare: CompareTab, image: ImageGenTab, pomodoro: PomoTab2,
    vocabquiz: VocabQuizTab, map: ConceptMapTab, bookmarks: BookmarksTab, studyplan: StudyPlanTab,
    interview: MockInterviewTab, theme: ThemePicker, scores: LeaderboardTab, prompt: CustomPromptTab,
    typing: TypingTestTab, mnemonics: MnemonicsTab, difficulty: DifficultyRater, srs: SpacedRepetitionTab,
    debate: SelfDebate, reading: ReadingTrackerTab, multipdf: MultiPDFChat, codegen: CodeGeneratorTab,
    debugger: CodeDebuggerTab, reviewer: CodeReviewerTab, algorithm: AlgorithmVisualizerTab, codequiz: CodeQuizTab,
    pyq: PyqTab, knowledge: ()=><KnowledgeMapTab Quiz={Quiz}/>, weakspots: ()=><WeakSpotsTab Quiz={Quiz}/>, exam: ExamTab, voice: VoiceTab, library: LibraryTab, settings: SettingsTab, mynotes: MyNotesTab, pdfsearch: PdfSearchTab, report: WeeklyReportTab, planner: PlannerTab, swipe: SwipeTab, listen: ListenTab, sketch: SketchTab,
  }
  return map[key] || (()=> <div className="card">Coming soon.</div>)
}

const kbd = fn => e=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); fn(e) } }
function Tilt({ children, className="", strength=10 }){
  const ref = useRef()
  function onMove(e){
    const el = ref.current
    if(!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left)/r.width - 0.5
    const py = (e.clientY - r.top)/r.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${px*strength}deg) rotateX(${-py*strength}deg) translateY(-4px)`
  }
  function onLeave(){
    const el = ref.current
    if(el) el.style.transform = ""
  }
  return (
    <div ref={ref} className={"tilt " + className} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  )
}

/* ============================= Marquee strip ============================= */

function LangSeg(){
  const [lang, setLang] = useLocalState("ml_outlang", "en")
  return (
    <div className="lang-seg" role="group" aria-label="Answer language">
      <div className="lang-seg-label">Answer language</div>
      <div className="lang-seg-btns">
        {Object.entries(LANGS).map(([k,v])=>(
          <button key={k} className={lang===k ? "on" : ""} onClick={()=>setLang(k)}>{v.short}</button>
        ))}
      </div>
    </div>
  )
}

const SPLITTABS = ["chat", "notes", "mynotes"]
function Dashboard({ user, onLogout, onProfile }){
  const [tab, setTab] = useLocalState("ml_tab", "Home")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pins, setPins] = useLocalState("ml_pins", [])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [onboarded, setOnboarded] = useLocalState("ml_onboarded", false)
  const [activity, setActivity] = useLocalState("ml_activity", [])
  const [doc, setDoc] = useLocalState("ml_doc", null)
  const [collapsed, setCollapsed] = useLocalState("ml_side_collapsed", false)
  const [focus, setFocus] = useState(false)
  const [split, setSplit] = useState(false)
  useEffect(()=>{ const f = ()=>setSplit(v=>!v); window.addEventListener("ml-split", f); return ()=>window.removeEventListener("ml-split", f) },[])
  const [, setDark] = useDark()
  const [, setOutLang] = useLocalState("ml_outlang", "en")

  useEffect(()=>{
    function onKey(e){
      if(e.shiftKey && e.key==="F" && !/input|textarea|select/i.test(e.target.tagName)){ e.preventDefault(); setFocus(f=>!f) }
      if((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); setPaletteOpen(o=>!o) }
      if((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)){
        const flat = SIDEBAR_GROUPS.flatMap(g=>g.items.map(i=>i[0]))
        const idx = +e.key - 1
        if(flat[idx]){ e.preventDefault(); goTo(flat[idx]) }
      }
    }
    window.addEventListener("keydown", onKey)
    return ()=>window.removeEventListener("keydown", onKey)
  },[])
  useEffect(()=>{ window.scrollTo({ top:0 }); window.dispatchEvent(new CustomEvent("ml-tab", { detail:tab })) },[tab])
  useEffect(()=>{ const f = e=>goTo(e.detail); window.addEventListener("ml-goto", f); return ()=>window.removeEventListener("ml-goto", f) },[])
  useEffect(()=>{ const f = ()=>setSidebarOpen(o=>!o); window.addEventListener("ml-menu", f); return ()=>window.removeEventListener("ml-menu", f) },[])

  function runAction(k){
    setPaletteOpen(false)
    if(k === "act:dark") setDark(d=>!d)
    else if(k === "act:focus") setFocus(f=>!f)
    else if(k === "act:upload"){ setTab("Home"); setTimeout(()=>document.querySelector(".home-upload input[type=file]")?.click(), 120) }
    else if(k === "act:pomo"){ pomo.setMode("focus", 1500); pomo.start(); toast("Focus session started. Good luck! 🎯", "ok") }
    else if(k.startsWith("act:lang-")){ setOutLang(k.slice(9)); toast("Answer language updated.", "ok") }
    else if(k === "act:tour") window.dispatchEvent(new Event("ml-spot"))
    else if(k === "act:wrapped") window.dispatchEvent(new Event("ml-wrapped"))
    else if(k === "act:share") window.dispatchEvent(new CustomEvent("ml-sharecard", { detail:"week" }))
    else if(k === "act:shortcuts") window.dispatchEvent(new Event("ml-shortcuts"))
    else if(k === "act:backup") goTo("settings")
    else if(k === "act:logout") onLogout()
  }
  function goTo(k){
    if(String(k).startsWith("act:")) return runAction(k)
    setTab(k); setSidebarOpen(false); setPaletteOpen(false)
    if(k !== "Home") setActivity(a=>[{ k, at: Date.now() }, ...a].slice(0,300))
  }
  function togglePin(k){
    setPins(p=> p.includes(k) ? p.filter(x=>x!==k) : [...p, k])
  }

  const due = useDueCount()
  useEffect(()=>{
    if(due > 0 && localStorage.getItem("ml_due_day") !== new Date().toDateString()){
      localStorage.setItem("ml_due_day", new Date().toDateString())
      pushNotif(`${due} flashcard${due === 1 ? "" : "s"} due for review today.`, "🔔")
    }
  },[due])
  const Comp = tab !== "Home" ? getTabComponent(tab) : null
  const initial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase()

  return (
    <div className={"dash-root" + (collapsed ? " collapsed" : "") + (focus ? " focus" : "")}>
      <VoiceCommand onAction={runAction} />
      <V24Host />
      <SpotTour />
      {sidebarOpen && <div className="dash-sidebar-backdrop" onClick={()=>setSidebarOpen(false)} />}
      <aside className={"dash-sidebar" + (sidebarOpen ? " open" : "")}>
        <div className="side-brand" onClick={()=>goTo("Home")}>
          <span className="side-logo"><Logo size={24} id="sg" /></span>
          <span className="side-brand-name">MindLearn <i>AI</i></span>
        </div>
        <button className="side-collapse" aria-label="Collapse sidebar" title={collapsed ? "Expand" : "Collapse"} onClick={()=>setCollapsed(c=>!c)}>{collapsed ? "»" : "«"}</button>
        <LangSeg />
        <button className="side-search" onClick={()=>setPaletteOpen(true)}>
          <span className="si-label">🔎 Search tools…</span><span className="si-icon-only">🔎</span><kbd>⌘K</kbd>
        </button>
        <div role="button" tabIndex={0} onKeyDown={kbd(()=>goTo("Home"))} className={"sidebar-item side-home" + (tab==="Home"?" active":"")} onClick={()=>goTo("Home")}>
          <span className="sidebar-icon">🏠</span><span className="si-label">Overview</span>
        </div>
        {pins.length>0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-label"><span className="si-label">⭐ Favorites</span></div>
            {pins.map(k=>(
              <div key={k} role="button" tabIndex={0} onKeyDown={kbd(()=>goTo(k))} className={"sidebar-item" + (tab===k?" active":"")} onClick={()=>goTo(k)}>
                <span className="sidebar-icon">{ICON_BY_KEY[k]}</span><span className="si-label">{FUN_META[k]?.title}</span>
              </div>
            ))}
          </div>
        )}
        {SIDEBAR_GROUPS.map(g=>(
          <div className="sidebar-group" key={g.label}>
            <div className="sidebar-group-label"><span className="si-label">{g.label}</span></div>
            {g.items.map(([k,icon])=>(
              <div key={k} className={"sidebar-item" + (tab===k?" active":"")} onClick={()=>goTo(k)}>
                <button className="si-main" aria-current={tab===k?"page":undefined} aria-label={FUN_META[k]?.title}>
                  <span className="sidebar-icon" title={FUN_META[k]?.title} aria-hidden="true">{icon}</span><span className="si-label">{FUN_META[k]?.title}</span>
                  {k==="srs" && due>0 && <em className="si-badge">{due}</em>}
                </button>
                <button className="pin-btn" aria-label={(pins.includes(k)?"Unpin ":"Pin ") + (FUN_META[k]?.title || k)} onClick={(e)=>{ e.stopPropagation(); togglePin(k) }}>{pins.includes(k)?"★":"☆"}</button>
              </div>
            ))}
          </div>
        ))}
        <div className="side-user">
          <button className="side-user-main" onClick={onProfile}>
            <UserAvatar initial={initial} />
            <span className="side-user-text"><b>{user?.name || "Student"}</b><i>{doc ? "📄 " + doc : "No document yet"}</i></span>
          </button>
          <button className="side-logout" title="Log out" aria-label="Log out" onClick={onLogout}>⏻</button>
        </div>
      </aside>

      <main className="dash-main" id="main-content" tabIndex={-1}>
        <RouteBar k={tab} />
        {tab === "Home" ? (
          <HomeOverview user={user} activity={activity} goTo={goTo} pins={pins} togglePin={togglePin} doc={doc} setDoc={setDoc} openSearch={()=>setPaletteOpen(true)} />
        ) : (
          <div className={"fpage" + (split && SPLITTABS.includes(tab) ? " split" : "")} key={tab}>
            <div className="fpage-bar"><button className="btn btn-ghost btn-sm" onClick={()=>goTo("Home")}>← Overview</button><button className="btn btn-ghost btn-sm" onClick={()=>setFocus(f=>!f)} title="Shift+F">{focus ? "Exit focus" : "⛶ Focus"}</button></div>
            <FunHeader k={tab} />
            {split && SPLITTABS.includes(tab) ? (
              <div className="split-grid"><ErrorBoundary resetKey={tab}><Comp /></ErrorBoundary><SplitView onClose={()=>setSplit(false)} /></div>
            ) : (Comp && <div key={tab} className="tab-fade"><ErrorBoundary resetKey={tab}><Comp /></ErrorBoundary></div>)}
          </div>
        )}
      </main>

      <ShortcutsModal />
      <QuickCapture />
      {!focus && <BottomNav tab={tab} goTo={goTo} />}
      <CommandPalette open={paletteOpen} onClose={()=>setPaletteOpen(false)} onSelect={goTo} />
      <AchievementEngine activity={activity} />
      <PomodoroRunner />
      <PomodoroDock goTo={goTo} />
      {!onboarded && <OnboardingTour onDone={()=>{ setOnboarded(true); try{ if(!localStorage.getItem("ml_spot_done")) setTimeout(()=>window.dispatchEvent(new Event("ml-spot")), 500) }catch(e){} }} />}
    </div>
  )
}

function timeAgo(ts){
  const m = Math.floor((Date.now() - ts)/60000)
  if(m < 1) return "just now"
  if(m < 60) return m + " min ago"
  const h = Math.floor(m/60)
  if(h < 24) return h + " h ago"
  return Math.floor(h/24) + " d ago"
}

function lastDays(n){
  const out = []
  for(let d=n-1; d>=0; d--){ const t = new Date(); t.setHours(0,0,0,0); t.setDate(t.getDate()-d); out.push(t) }
  return out
}

function WeekBars({ activity }){
  const days = lastDays(7)
  const counts = days.map(d=>activity.filter(a=>new Date(a.at).toDateString()===d.toDateString()).length)
  const total = counts.reduce((a,b)=>a+b,0)
  const max = Math.max(1, ...counts)
  return (
    <div className="chart-card">
      <div className="chart-head"><h4>This week</h4><span>{total} {total===1?"action":"actions"}</span></div>
      <div className="bars">
        {days.map((d,i)=>(
          <div className="bar-col" key={i} title={d.toLocaleDateString()+": "+counts[i]}>
            <div className="bar-track"><div className="bar-fill" style={{ height: (counts[i]/max*100)+"%", animationDelay:(i*60)+"ms" }}/></div>
            <span className={i===6?"today":""}>{d.toLocaleDateString(undefined,{ weekday:"narrow" })}</span>
          </div>
        ))}
      </div>
      {total===0 && <div className="chart-empty">Open a tool to start your week.</div>}
    </div>
  )
}

function ScoreLine({ scores }){
  const pts = scores.slice(-10).map(s=>Math.max(0, Math.min(100, +s.pct || 0)))
  const W = 300, H = 90
  const xy = pts.map((v,i)=>[ pts.length>1 ? 8 + i*(W-16)/(pts.length-1) : W/2, H-8 - v/100*(H-16) ])
  const line = xy.map(p=>p.join(",")).join(" ")
  const last = pts[pts.length-1]
  return (
    <div className="chart-card">
      <div className="chart-head"><h4>Quiz scores</h4><span>{pts.length ? "Latest " + last + "%" : "No quizzes yet"}</span></div>
      {pts.length >= 2 ? (
        <svg className="score-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="slg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8B6BFF"/><stop offset="1" stopColor="#2DE3F0"/></linearGradient>
            <linearGradient id="sla" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8B6BFF" stopOpacity="0.35"/><stop offset="1" stopColor="#8B6BFF" stopOpacity="0"/></linearGradient>
          </defs>
          {[25,50,75].map(g=><line key={g} x1="0" x2={W} y1={H-8-g/100*(H-16)} y2={H-8-g/100*(H-16)} className="sl-grid"/>)}
          <polygon points={`${xy[0][0]},${H} ${line} ${xy[xy.length-1][0]},${H}`} fill="url(#sla)" />
          <polyline points={line} fill="none" stroke="url(#slg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="sl-line"/>
          {xy.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={i===xy.length-1?4:2.5} className="sl-dot"/>)}
        </svg>
      ) : (
        <div className="chart-empty">{pts.length===1 ? "One quiz done. Take another to see your trend." : "Take a quiz and your score trend shows up here."}</div>
      )}
    </div>
  )
}

function StreakCard({ activity }){
  const days = lastDays(14)
  const active = days.map(d=>activity.some(a=>new Date(a.at).toDateString()===d.toDateString()))
  let streak = 0
  for(let i=active.length-1; i>=0; i--){
    if(active[i]) streak++
    else if(i===active.length-1) continue
    else break
  }
  return (
    <div className="chart-card">
      <div className="chart-head"><h4>Streak</h4><span>🔥 {streak} {streak===1?"day":"days"}</span></div>
      <div className="streak-grid">
        {days.map((d,i)=>(<i key={i} className={active[i] ? "on" : ""} title={d.toLocaleDateString()} />))}
      </div>
      <div className="chart-foot">Last 14 days</div>
    </div>
  )
}

function HomeUpload({ setDoc }){
  const [state, setState] = useState("idle")
  const [pct, setPct] = useState(0)
  const [drag, setDrag] = useState(false)
  const ref = useRef()
  async function up(files){
    if(!files || !files.length) return
    setState("up"); setPct(0)
    try{
      await uploadPdfs(files, setPct)
      savePdfs(files)
      const names = Array.from(files).map(f=>f.name)
      setDoc(names.length>1 ? names[0] + " +" + (names.length-1) : names[0])
      setState("ok"); sounds.success(); toast("PDF ready. Your tools now use it.", "ok")
      setTimeout(()=>setState("idle"), 3500)
    }catch(ex){
      setState("idle")
      toast(ex?.response?.data?.detail || ex?.message || "Upload failed.", "error")
    }
  }
  return (
    <div className={"home-upload" + (drag ? " drag" : "") + " " + state} role="button" tabIndex={0} aria-label="Upload a PDF"
      onKeyDown={e=>{ if((e.key==="Enter" || e.key===" ") && state!=="up"){ e.preventDefault(); ref.current?.click() } }}
      onDragOver={e=>{ e.preventDefault(); setDrag(true) }} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{ e.preventDefault(); setDrag(false); up(e.dataTransfer.files) }}
      onClick={()=>state!=="up" && ref.current?.click()}>
      <input ref={ref} type="file" accept="application/pdf" multiple hidden onChange={e=>{ up(e.target.files); e.target.value="" }} />
      <span className="hu-icon">{state==="ok" ? "✅" : "📄"}</span>
      <div className="hu-text">
        <b>{state==="up" ? (pct < 100 ? `Uploading… ${pct}%` : "Processing your PDF…") : state==="ok" ? "PDF ready. Your tools now use it." : "Upload a new PDF"}</b>
        <span>{state==="idle" ? "Drop a file here or click to browse (PDF, up to 50 MB). It becomes the document your tools use." : ""}</span>
        {state==="up" && <div className="hu-bar"><div style={{ width: pct + "%" }}/></div>}
      </div>
      {state==="up" ? <Spin/> : <span className="btn btn-ghost btn-sm hu-btn">Browse</span>}
    </div>
  )
}

function HomeOverview({ user, activity, goTo, pins, togglePin, doc, setDoc, openSearch }){
  const [scores] = useLocalState("ml_scores", [])
  const [q, setQ] = useState("")
  const [grp, setGrp] = useState("All")
  const hr = new Date().getHours()
  const greet = hr < 5 ? "Burning the midnight oil" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening"
  const first = user?.name ? user.name.split(" ")[0] : ""
  const avg = scores.length ? Math.round(scores.reduce((a,s)=>a+(+s.pct||0),0)/scores.length) : null
  const days = new Set(activity.map(a=>new Date(a.at).toDateString())).size
  const recentKeys = [...new Set(activity.map(a=>a.k))].filter(k=>FUN_META[k]).slice(0,4)
  const jump = recentKeys.length ? recentKeys : ["chat","notes","quiz","flashcards"]
  const last = recentKeys[0]
  const tools = SIDEBAR_GROUPS.flatMap(g=>g.items.map(([k,icon])=>({ k, icon, group:g.label })))
    .filter(t=>(grp==="All" || t.group===grp) && (!q || (FUN_META[t.k]?.title + " " + FUN_META[t.k]?.tag).toLowerCase().includes(q.toLowerCase())))

  return (
    <div className="home-overview">
      <div className="home-hero-card">
        <div className="home-hero-glow"></div>
        <div className="home-hero-text">
          <div className="home-eyebrow">{new Date().toLocaleDateString(undefined,{ weekday:"long", day:"numeric", month:"short" })}</div>
          <h2>{greet}{first ? <>, <span className="grad-text">{first}</span></> : ""}.</h2>
          <p className="home-hero-sub">{doc ? <>Studying <b>{doc}</b>. Pick a tool and go.</> : "Pick a tool below, or press ⌘K to jump anywhere."}</p>
          <div className="home-hero-actions">
            {last
              ? <button className="btn btn-p" onClick={()=>goTo(last)}>Continue · {FUN_META[last].title}</button>
              : <button className="btn btn-p" onClick={()=>goTo("chat")}>Start with Chat</button>}
            <button className="btn btn-ghost" onClick={openSearch}>🔎 Search tools <kbd>⌘K</kbd></button>
          </div>
        </div>
        <div className="home-orb" aria-hidden="true"><i/><i/><span/></div>
      </div>

      <div className="stat-row">
        <div className="stat-card stat-card-big"><b>{ALL_FUNCTION_KEYS.length - 2}</b><span>Tools available</span></div>
        <div className="stat-card"><b>{scores.length}</b><span>Quizzes taken</span><Spark data={scores.slice(-8).map((x, i)=>i + 1)} /></div>
        <div className="stat-card"><b>{avg === null ? "—" : avg + "%"}</b><span>Average score</span><Spark data={scores.slice(-8).map(x=>+x.pct || 0)} /></div>
        <div className="stat-card"><b>{days}</b><span>Active {days===1?"day":"days"}</span><Spark data={Array.from({ length:14 }, (_, i)=>activity.filter(a=>new Date(a.at).toDateString() === new Date(Date.now() - (13 - i) * 86400000).toDateString()).length)} /></div>
      </div>

      <HomeUpload setDoc={setDoc} />
      <HomeWidgets activity={activity} goTo={goTo} />

      <div className="home-section-head"><h3>Your progress</h3></div>
      <div className="chart-grid">
        <WeekBars activity={activity} />
        <ScoreLine scores={scores} />
        <StreakCard activity={activity} />
        <WeakCard goTo={goTo} />
      </div>

      <div className="home-section-head"><h3>Smart Lab <span className="new-badge">NEW</span></h3></div>
      <div className="lab-grid">
        {[["knowledge","Explore your PDF as a 3D galaxy of ideas."],["weakspots","Radar of the topics you keep missing."],["exam","Timed paper with negative marking."],["voice","Talk to your tutor, hands-free."]].map(([k,d])=>(
          <div key={k} className="lab-card" role="button" tabIndex={0} onKeyDown={kbd(()=>goTo(k))} onClick={()=>goTo(k)}>
            <span className="lab-icon">{ICON_BY_KEY[k]}</span>
            <div><b>{FUN_META[k].title}</b><span>{d}</span></div>
          </div>
        ))}
      </div>

      <div className="home-section-head"><h3>{recentKeys.length ? "Jump back in" : "Start here"}</h3></div>
      <div className="quick-grid">
        {jump.map(k=>(
          <Tilt key={k} className="quick-card" strength={6}>
            <div onClick={()=>goTo(k)} style={{cursor:"pointer"}}>
              <div className="quick-icon">{ICON_BY_KEY[k]}</div>
              <div className="quick-title">{FUN_META[k].title}</div>
              <div className="quick-tag">{FUN_META[k].tag}</div>
            </div>
          </Tilt>
        ))}
      </div>

      <div className="home-section-head" style={{marginTop:34}}>
        <h3>All tools</h3>
        <input className="inp tool-search" placeholder="Filter tools…" value={q} onChange={e=>setQ(e.target.value)} />
      </div>
      <div className="chip-row">
        {["All", ...SIDEBAR_GROUPS.map(g=>g.label)].map(g=>(
          <button key={g} className={"chip" + (grp===g ? " on" : "")} onClick={()=>setGrp(g)}>{g}</button>
        ))}
      </div>
      <div className="tool-grid">
        {tools.map((t,i)=>(
          <div key={t.k} className="tool-card" style={{"--i": Math.min(i, 14)}} onClick={()=>goTo(t.k)}>
            <div className="tool-card-top">
              <span className="tool-icon">{t.icon}</span>
              <button className={"tool-pin" + (pins.includes(t.k) ? " on" : "")} aria-label={(pins.includes(t.k) ? "Unpin " : "Pin ") + (FUN_META[t.k]?.title || t.k)} onClick={e=>{ e.stopPropagation(); togglePin(t.k) }}>{pins.includes(t.k) ? "★" : "☆"}</button>
            </div>
            <button className="tool-main"><span className="tool-title">{FUN_META[t.k]?.title}</span><span className="tool-tag">{FUN_META[t.k]?.tag}</span></button>
          </div>
        ))}
        {tools.length === 0 && <div className="tool-empty">No tools match “{q}”.</div>}
      </div>

      {activity.length>0 && (
        <>
          <div className="home-section-head" style={{marginTop:34}}><h3>Recent activity</h3></div>
          <div className="timeline">
            {activity.slice(0,6).map((a,i)=>(
              <div key={i} className="tl-item" role="button" tabIndex={0} onKeyDown={kbd(()=>goTo(a.k))} onClick={()=>goTo(a.k)}>
                <span className="tl-dot"/>
                <span className="tl-icon">{ICON_BY_KEY[a.k]}</span>
                <span className="tl-name">{FUN_META[a.k]?.title || a.k}</span>
                <span className="activity-time">{timeAgo(a.at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ============================= App root ============================= */

export default Dashboard
