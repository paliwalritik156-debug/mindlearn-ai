import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
const MapCanvas = lazy(()=>import("./mapcanvas.jsx"))
import {
  api, sounds, useLocalState, Spin, Skeleton, LANGS, getOutLang, langInstruction, askText, chatJSON, chatQuestions,
  topicOf, recordAnswers, readWeak, weakStats, ICON_BY_KEY, FUN_META, printDoc, esc,
} from "./lib.jsx"
import { useLocalState as useLS, toast as toastMsg } from "./lib.jsx"
import { saveToNotes } from "./core.js"
import { hasPdfs, findBest, getBuffer, loadPdfJs, pdfNames, keywordsOf } from "./pdfstore.js"

function Empty({ icon, title, body, children }){
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {body && <div className="empty-body">{body}</div>}
      {children}
    </div>
  )
}

/* ============================================================
   Source viewer: shows the page of the PDF that best matches an answer, with the passage highlighted
   ============================================================ */
export function PdfViewer({ pdf, page: startPage, keywords = [], onClose }){
  const canvasRef = useRef()
  const docRef = useRef(null)
  const [page, setPage] = useState(startPage)
  const [pages, setPages] = useState(0)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(true)
  // user highlights + per-page notes (stored locally): ml_hl = { [pdf]: { [page]: { rects:[{x,y,w,h,text}], note } } }
  const [hl, setHl] = useLS("ml_hl", {})
  const [hlMode, setHlMode] = useState(false)
  const [drag, setDrag] = useState(null)
  const itemsRef = useRef({ items:[], vp:null, scale:1, pdfjs:null })
  const pageData = (hl[pdf] && hl[pdf][page]) || { rects:[], note:"" }
  const setPageData = fn => setHl(all=>{ const cur = (all[pdf] && all[pdf][page]) || { rects:[], note:"" }; return { ...all, [pdf]: { ...(all[pdf] || {}), [page]: fn(cur) } } })
  function pt(e){ const r = e.currentTarget.getBoundingClientRect(); return { x:Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y:Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) } }
  function textIn(rc){
    const { items, vp, scale, pdfjs } = itemsRef.current
    if(!vp || !pdfjs) return ""
    const X0 = rc.x * vp.width, X1 = (rc.x + rc.w) * vp.width, Y0 = rc.y * vp.height, Y1 = (rc.y + rc.h) * vp.height
    const hit = []
    for(const it of items){
      const t = pdfjs.Util.transform(vp.transform, it.transform), h = Math.hypot(t[2], t[3])
      const x0 = t[4], x1 = t[4] + it.width * scale, y0 = t[5] - h, y1 = t[5]
      if(x1 >= X0 && x0 <= X1 && y1 >= Y0 && y0 <= Y1) hit.push({ s:it.str, y:Math.round(t[5] / 4), x:t[4] })
    }
    hit.sort((a, b)=>a.y - b.y || a.x - b.x)
    return hit.map(h=>h.s).join(" ").replace(/\s+/g, " ").trim()
  }
  function onDown(e){ if(!hlMode) return; e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); const p = pt(e); setDrag({ x0:p.x, y0:p.y, x1:p.x, y1:p.y }) }
  function onMove(e){ if(drag){ const p = pt(e); setDrag(d=>({ ...d, x1:p.x, y1:p.y })) } }
  function onUp(){
    if(!drag) return
    const rc = { x:Math.min(drag.x0, drag.x1), y:Math.min(drag.y0, drag.y1), w:Math.abs(drag.x1 - drag.x0), h:Math.abs(drag.y1 - drag.y0) }
    setDrag(null)
    if(rc.w < 0.01 || rc.h < 0.008) return
    const text = textIn(rc).slice(0, 600)
    setPageData(c=>({ ...c, rects:[...c.rects, { ...rc, text }] }))
  }
  const rmRect = i => setPageData(c=>({ ...c, rects:c.rects.filter((_, j)=>j !== i) }))
  function toCard(r){
    if(!r.text){ toastMsg("No text found in that highlight (scanned page?).", "error"); return }
    try{
      const list = JSON.parse(localStorage.getItem("ml_srs") || "[]")
      const words = r.text.split(" "); const q = (words.length > 10 ? words.slice(0, 10).join(" ") + "…" : r.text) + "  (p." + page + ")"
      list.push({ q:"Recall: " + q, a:r.text, interval:1, due:Date.now() })
      localStorage.setItem("ml_srs", JSON.stringify(list)); window.dispatchEvent(new CustomEvent("ml-ls", { detail:"ml_srs" }))
      toastMsg("Flashcard added to your review deck.", "ok")
    }catch(e){ toastMsg("Couldn't add the flashcard.", "error") }
  }
  function toNotes(){
    const body = pageData.rects.map(r=>"• " + r.text).filter(Boolean).join("\n") + (pageData.note ? "\n\nMy note: " + pageData.note : "")
    if(!body.trim()){ toastMsg("Nothing to save on this page yet.", "error"); return }
    saveToNotes(pdf + " · page " + page, body)
  }

  async function draw(n){
    const doc = docRef.current, pdfjs = await loadPdfJs()
    if(!doc || !canvasRef.current) return
    setBusy(true)
    const pg = await doc.getPage(n)
    const v0 = pg.getViewport({ scale: 1 })
    const w = Math.min(820, window.innerWidth - 56)
    const scale = w / v0.width
    const vp = pg.getViewport({ scale })
    const c = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr)
    c.style.width = vp.width + "px"; c.style.height = vp.height + "px"
    const ctx = c.getContext("2d")
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    await pg.render({ canvasContext: ctx, viewport: vp }).promise
    // highlight the densest run of keyword hits
    const tc = await pg.getTextContent()
    const items = tc.items.filter(i=>i.str && i.str.trim())
    itemsRef.current = { items, vp, scale, pdfjs }
    const kw = keywords.map(k=>k.toLowerCase())
    const hit = items.map(i=> kw.reduce((c2,k)=> c2 + (i.str.toLowerCase().includes(k) ? 1 : 0), 0))
    const WIN = 14
    let bestAt = -1, bestSum = 0, sum = 0
    for(let i = 0; i < items.length; i++){
      sum += hit[i]
      if(i >= WIN) sum -= hit[i - WIN]
      if(sum > bestSum){ bestSum = sum; bestAt = i }
    }
    if(bestAt >= 0){
      ctx.fillStyle = "rgba(255, 196, 40, 0.38)"
      for(let i = Math.max(0, bestAt - WIN + 1); i <= bestAt; i++){
        if(!hit[i]) continue
        const it = items[i]
        const t = pdfjs.Util.transform(vp.transform, it.transform)
        const h = Math.hypot(t[2], t[3])
        ctx.fillRect(t[4] - 1, t[5] - h * 0.9, it.width * scale + 2, h * 1.15)
      }
    }
    setBusy(false)
  }

  useEffect(()=>{
    let dead = false
    ;(async()=>{
      try{
        const pdfjs = await loadPdfJs()
        const buf = await getBuffer(pdf)
        docRef.current = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise
        if(dead) return
        setPages(docRef.current.numPages)
        await draw(page)
      }catch(e){ try{ console.error("pdf open failed", e) }catch(_){}; if(!dead){ setErr("Couldn't open this PDF. Check your internet connection and try again."); setBusy(false) } }
    })()
    return ()=>{ dead = true }
  },[pdf])
  useEffect(()=>{ if(docRef.current) draw(page).catch(()=>{}) },[page])
  useEffect(()=>{
    const onKey = e=>{ if(e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return ()=>window.removeEventListener("keydown", onKey)
  },[])

  return (
    <div className="pdfv-overlay" onClick={onClose}>
      <div className="pdfv" onClick={e=>e.stopPropagation()}>
        <div className="pdfv-bar">
          <b>📄 {pdf}</b>
          <span className="pdfv-nav">
            <button className="btn btn-ghost btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>◀</button>
            <span>Page {page}{pages ? " / " + pages : ""}</span>
            <button className="btn btn-ghost btn-sm" disabled={!pages || page>=pages} onClick={()=>setPage(p=>p+1)}>▶</button>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="pdfv-body">
          {err ? <div className="form-err">{err}</div> : (
            <div className="pdfv-page">
              <canvas ref={canvasRef} className={busy ? "busy" : ""} />
              <div className={"pdfv-hl" + (hlMode ? " on" : "")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} data-testid="hl-layer">
                {pageData.rects.map((r, i)=>(<i key={i} className="hl-box" style={{ left:r.x*100+"%", top:r.y*100+"%", width:r.w*100+"%", height:r.h*100+"%" }} />))}
                {drag && <i className="hl-box drag" style={{ left:Math.min(drag.x0, drag.x1)*100+"%", top:Math.min(drag.y0, drag.y1)*100+"%", width:Math.abs(drag.x1-drag.x0)*100+"%", height:Math.abs(drag.y1-drag.y0)*100+"%" }} />}
              </div>
            </div>
          )}
          {busy && !err && <div className="pdfv-loading"><Spin/></div>}
        </div>
        {!err && <div className="pdfv-tools">
          <button className={"btn btn-sm " + (hlMode ? "btn-p" : "btn-ghost")} aria-pressed={hlMode} onClick={()=>setHlMode(m=>!m)}>🖍 {hlMode ? "Highlighting: drag on the page" : "Highlight"}</button>
          <button className="btn btn-ghost btn-sm" onClick={toNotes}>📝 Save page to notes</button>
          <textarea className="pdfv-note" aria-label={"Note for page " + page} placeholder={"Your note for page " + page + "…"} value={pageData.note} onChange={e=>setPageData(c=>({ ...c, note:e.target.value }))} rows={2} />
          {pageData.rects.length > 0 && (
            <ul className="pdfv-hls">
              {pageData.rects.map((r, i)=>(
                <li key={i}><span>{r.text || "(no text found)"}</span><button className="btn btn-ghost btn-sm" onClick={()=>toCard(r)}>＋ Flashcard</button><button className="btn btn-ghost btn-sm" aria-label="Remove highlight" onClick={()=>rmRect(i)}>✕</button></li>
              ))}
            </ul>
          )}
        </div>}
        <div className="pdfv-foot">Yellow = closest matching passage (approximate). Your own highlights are saved on this device.</div>
      </div>
    </div>
  )
}

export function SourceChip({ text, sources }){
  const [guess, setGuess] = useState(null)
  const [open, setOpen] = useState(false)
  const exact = (sources || []).find(s=>s && s.page)
  useEffect(()=>{
    if(exact || !hasPdfs() || !text || text.startsWith("⚠️")) return
    let dead = false
    findBest(text).then(h=>{ if(!dead) setGuess(h) }).catch(()=>{})
    return ()=>{ dead = true }
  },[text, !!exact])
  // exact page reported by the server wins over the client-side guess
  const names = hasPdfs() ? pdfNames() : []
  const hit = exact && names.length ? { pdf: names.includes(exact.file) ? exact.file : names[0], page: exact.page, keywords: keywordsOf(text || "") } : guess
  if(!hit) return null
  return (
    <>
      <button className="source-chip" onClick={()=>setOpen(true)} title="Open the closest matching page of your PDF">📎 {hit.pdf} · p.{hit.page}</button>
      {open && <PdfViewer pdf={hit.pdf} page={hit.page} keywords={hit.keywords} onClose={()=>setOpen(false)} />}
    </>
  )
}

/* ============================================================
   3D Knowledge Map
   ============================================================ */

export function KnowledgeMapTab({ Quiz }){
  const [data, setData] = useLocalState("ml_kmap", null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [sel, setSel] = useState(null)
  const [explain, setExplain] = useState("")
  const [busy, setBusy] = useState("")
  const [cards, setCards] = useState(null)
  const [quizOn, setQuizOn] = useState(false)
  const concepts = data?.concepts || []
  const cur = concepts.find(c=>c.name === sel)

  useEffect(()=>{ setExplain(""); setCards(null); setQuizOn(false) },[sel])

  async function build(){
    setLoading(true); setErr(""); setSel(null)
    try{
      const li = langInstruction()
      const d = await chatJSON(
        `From the uploaded document, pick the 12 most important concepts and how they connect. ${li ? li + " (names and summaries; keep JSON keys in English). " : ""}` +
        `Respond with ONLY valid JSON, no markdown fences, exactly in this shape: {"concepts":[{"name":"short concept name (1-3 words)","summary":"one sentence","related":["name of another concept in this list"]}]}`)
      const raw = Array.isArray(d) ? d : (d.concepts || [])
      const seen = new Set(), list = []
      raw.forEach(c=>{
        const name = String(c.name || "").trim()
        if(name && !seen.has(name.toLowerCase()) && list.length < 16){ seen.add(name.toLowerCase()); list.push({ name, summary: c.summary || "", related: Array.isArray(c.related) ? c.related : [] }) }
      })
      if(list.length < 2) throw new Error("Couldn't find enough concepts. Make sure a PDF is uploaded, then try again.")
      setData({ concepts: list, at: Date.now() })
      sounds.success()
    }catch(ex){ setErr(ex?.response?.data?.detail || ex.message || "Couldn't build the map.") }
    finally{ setLoading(false) }
  }
  async function doExplain(){
    setBusy("explain"); setExplain("")
    try{ setExplain(await askText(`Explain "${cur.name}" from the uploaded document simply, with one concrete example. ${langInstruction()}`)) }
    catch(ex){ setExplain("⚠️ " + (ex?.response?.data?.detail || "Couldn't reach the AI.")) }
    finally{ setBusy("") }
  }
  async function doCards(){
    setBusy("cards"); setCards(null)
    try{
      const li = langInstruction()
      const d = await chatJSON(`Make 4 flashcards about "${cur.name}" from the uploaded document. ${li ? li + " (keep JSON keys in English). " : ""}Respond with ONLY valid JSON: {"cards":[{"q":"...","a":"..."}]}`)
      setCards((Array.isArray(d) ? d : d.cards || d.flashcards || []).slice(0,6))
    }catch(ex){ setCards([]); setErr(ex.message) }
    finally{ setBusy("") }
  }

  return (
    <div className="card">
      <div className="tool-actions">
        <button className="btn btn-p" disabled={loading} onClick={build}>{loading ? <Spin/> : (concepts.length ? "Rebuild map" : "Build my map")}</button>
        {concepts.length > 0 && <span className="kmap-hint">Drag to rotate · scroll to zoom · click an idea</span>}
      </div>
      {err && <div className="form-err">{err}</div>}
      {loading && <div className="skel-card"><Skeleton lines={4}/></div>}
      {!loading && concepts.length === 0 && !err && (
        <Empty icon="🌌" title="Your map is empty" body="Upload a PDF, then build a 3D map of its main ideas." />
      )}
      {!loading && concepts.length > 0 && (
        <>
          <div className="kmap-wrap">
            <Suspense fallback={<div className="map-loading"><Spin/></div>}><MapCanvas concepts={concepts} selected={sel} onSelect={setSel} /></Suspense>
          </div>
          <div className="kmap-panel">
            {!cur ? <div className="kmap-pick">Pick a concept to explain it, quiz yourself or make flashcards.</div> : (
              <>
                <div className="kmap-title"><span>{cur.name}</span></div>
                {cur.summary && <p className="kmap-sum">{cur.summary}</p>}
                <div className="chip-row">
                  {cur.related.filter(r=>concepts.some(c=>c.name.toLowerCase() === String(r).toLowerCase())).map(r=>(
                    <button key={r} className="chip" onClick={()=>setSel(concepts.find(c=>c.name.toLowerCase() === String(r).toLowerCase()).name)}>↔ {r}</button>
                  ))}
                </div>
                <div className="tool-actions">
                  <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={doExplain}>{busy==="explain" ? <Spin/> : "💡 Explain"}</button>
                  <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={()=>setQuizOn(true)}>🎯 Quiz me</button>
                  <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={doCards}>{busy==="cards" ? <Spin/> : "🗂️ Flashcards"}</button>
                </div>
                {explain && <div className="msg assistant" style={{marginTop:12}}><div className="msg-body">{explain}</div></div>}
                {cards && cards.length > 0 && <MiniCards cards={cards} />}
                {quizOn && <div style={{marginTop:12}}><Quiz key={cur.name} autoStart loader={()=>chatQuestions({ count:4, topics:[cur.name] })} /></div>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MiniCards({ cards }){
  const [open, setOpen] = useState({})
  return (
    <div className="mini-cards">
      {cards.map((c,i)=>(
        <button key={i} className={"mini-card"+(open[i]?" open":"")} onClick={()=>setOpen(o=>({...o,[i]:!o[i]}))}>
          <small>{open[i] ? "Answer" : "Question"}</small>{open[i] ? c.a : c.q}
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   Weak-spot radar
   ============================================================ */
function Radar({ items }){
  const n = items.length
  const S = 440, C = S/2, R = 100
  const ang = i=> -Math.PI/2 + (i/n) * Math.PI*2
  const pt = (i, f)=> [C + Math.cos(ang(i))*R*f, C + Math.sin(ang(i))*R*f]
  const poly = items.map((it,i)=>pt(i, Math.max(0.04, it.acc/100)).join(",")).join(" ")
  return (
    <svg className="radar" viewBox={`0 0 ${S} ${S}`}>
      <defs><linearGradient id="rdg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2DE3F0" stopOpacity="0.55"/><stop offset="1" stopColor="#8B6BFF" stopOpacity="0.55"/></linearGradient></defs>
      {[0.25,0.5,0.75,1].map(f=>(
        <polygon key={f} className="rd-ring" points={items.map((_,i)=>pt(i,f).join(",")).join(" ")} />
      ))}
      {items.map((_,i)=>{ const [x,y] = pt(i,1); return <line key={i} className="rd-axis" x1={C} y1={C} x2={x} y2={y} /> })}
      <polygon className="rd-shape" points={poly} fill="url(#rdg)" />
      {items.map((it,i)=>{ const [x,y] = pt(i, Math.max(0.04, it.acc/100)); return <circle key={i} className="rd-dot" cx={x} cy={y} r="3.5" /> })}
      {items.map((it,i)=>{
        const [x,y] = pt(i, 1.14); const a = ang(i)
        const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle"
        const label = it.topic.length > 13 ? it.topic.slice(0,12) + "…" : it.topic
        return <text key={i} className="rd-label" x={x} y={y - 6} textAnchor={anchor} dominantBaseline="middle">{label}<tspan x={x} dy="14" className="rd-acc">{it.acc}%</tspan></text>
      })}
    </svg>
  )
}

export function WeakSpotsTab({ Quiz }){
  const [tick, setTick] = useState(0)
  const stats = useMemo(()=>weakStats(), [tick])
  const [practice, setPractice] = useState(0)
  const weak = stats.filter(s=>s.acc < 70)
  const top = [...stats].sort((a,b)=>b.attempts - a.attempts).slice(0, 6)
  const total = stats.reduce((a,s)=>a+s.attempts, 0)

  if(stats.length === 0) return (
    <div className="card">
      <Empty icon="🎯" title="No data yet" body="Take a quiz or an exam and your weak topics will show up here, with a radar and a practice set.">
        <div className="tool-actions" style={{justifyContent:"center", marginTop:14}}>
          <button className="btn btn-p" onClick={()=>window.dispatchEvent(new CustomEvent("ml-goto", { detail:"quiz" }))}>Take a quiz</button>
        </div>
      </Empty>
    </div>
  )
  return (
    <div className="card">
      <div className="weak-grid">
        <div className="weak-radar">
          {top.length >= 3 ? <Radar items={top} /> : (
            <div className="weak-bars">{top.map(t=>(
              <div key={t.topic} className="wb-row"><span>{t.topic}</span><div className="wb-track"><div style={{ width: t.acc + "%" }}/></div><b>{t.acc}%</b></div>
            ))}</div>
          )}
          <div className="chart-foot">{total} answers across {stats.length} topics · topics are auto-detected</div>
        </div>
        <div className="weak-list">
          <h4>{weak.length ? "Needs work" : "Looking strong"}</h4>
          {weak.length === 0 && <p className="chart-empty" style={{textAlign:"left", padding:0}}>Every topic is at 70% or above. Keep going!</p>}
          {weak.slice(0, 6).map(w=>(
            <div key={w.topic} className="wb-row"><span>{w.topic}</span><div className="wb-track bad"><div style={{ width: w.acc + "%" }}/></div><b>{w.acc}%</b><small>{w.correct}/{w.attempts}</small></div>
          ))}
          <div className="tool-actions" style={{marginTop:14}}>
            <button className="btn btn-p" disabled={!weak.length} onClick={()=>setPractice(p=>p+1)}>🎯 Practice weak spots</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>{ if(confirm("Clear all weak-spot data?")){ localStorage.removeItem("ml_weak"); setTick(t=>t+1); setPractice(0) } }}>Reset</button>
          </div>
        </div>
      </div>
      {practice > 0 && (
        <div style={{marginTop:16}}>
          <Quiz key={practice} autoStart loader={()=>chatQuestions({ count:5, topics: weak.slice(0,3).map(w=>w.topic) })} />
        </div>
      )}
    </div>
  )
}

export function WeakCard({ goTo }){
  const stats = weakStats()
  const weak = stats.filter(s=>s.acc < 70).slice(0, 3)
  return (
    <div className="chart-card">
      <div className="chart-head"><h4>Weak spots</h4><span>{stats.length ? stats.length + " topics" : "no data yet"}</span></div>
      {stats.length === 0 ? <div className="chart-empty">Take a quiz and your weak topics appear here.</div> : (
        <div className="weak-mini">
          {weak.length === 0 && <div className="chart-empty">All topics at 70% or above 🎉</div>}
          {weak.map(w=>(<div key={w.topic} className="wb-row"><span>{w.topic}</span><div className="wb-track bad"><div style={{ width: w.acc + "%" }}/></div><b>{w.acc}%</b></div>))}
        </div>
      )}
      <button className="btn btn-ghost btn-sm" style={{marginTop:"auto"}} onClick={()=>goTo("weakspots")}>Open radar →</button>
    </div>
  )
}

/* ============================================================
   Exam simulator
   ============================================================ */
const EXAM_STYLES = {
  general: { label:"General  (+1 / 0)",            right:1, wrong:0,     hint:"" },
  neet:    { label:"NEET style  (+4 / −1)",         right:4, wrong:-1,    hint:"NEET style: concept and application based, with statement-type options." },
  jee:     { label:"JEE Main style  (+4 / −1)",     right:4, wrong:-1,    hint:"JEE Main style: conceptual reasoning and problem solving." },
  upsc:    { label:"UPSC Prelims style  (+2 / −0.67)", right:2, wrong:-0.67, hint:"UPSC Prelims style: statement-based, 'which of the above' options." },
}
const fmt = s=>String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0")

function Ring({ pct }){
  const [v, setV] = useState(0)
  useEffect(()=>{ const t = setTimeout(()=>setV(pct), 80); return ()=>clearTimeout(t) },[pct])
  const R = 52, C = 2*Math.PI*R
  return (
    <div className="score-ring">
      <svg viewBox="0 0 120 120" width="132" height="132">
        <defs><linearGradient id="srg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2DE3F0"/><stop offset="1" stopColor="#8B6BFF"/></linearGradient></defs>
        <circle cx="60" cy="60" r={R} className="sr-track" />
        <circle cx="60" cy="60" r={R} className="sr-fill" style={{ stroke:"url(#srg2)" }} strokeDasharray={C} strokeDashoffset={C*(1 - v/100)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="sr-num">{pct}<small>%</small></div>
    </div>
  )
}

export function ExamTab(){
  const [phase, setPhase] = useState("setup")
  const [style, setStyle] = useState(()=>{ try{ const g = JSON.parse(localStorage.getItem("ml_profile") || "null")?.goal; return ({ neet:"neet", jee:"jee", upsc:"upsc" })[g] || "neet" }catch(e){ return "neet" } })
  const [count, setCount] = useState(10)
  const [mins, setMins] = useState(10)
  const [qs, setQs] = useState([])
  const [ans, setAns] = useState({})
  const [mark, setMark] = useState({})
  const [cur, setCur] = useState(0)
  const [left, setLeft] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState("")
  const [report, setReport] = useState(null)
  const startRef = useRef(0)
  const doneRef = useRef(false)
  const st = EXAM_STYLES[style]

  async function start(){
    setPhase("loading"); setErr("")
    try{
      const batches = []
      for(let left2 = count; left2 > 0; left2 -= 10) batches.push(Math.min(10, left2))
      const res = await Promise.all(batches.map(c=>chatQuestions({ count:c, style: st.hint })))
      const seen = new Set(), list = []
      res.flat().forEach(q=>{ const k = q.question.toLowerCase(); if(!seen.has(k)){ seen.add(k); list.push(q) } })
      setQs(list.slice(0, count)); setAns({}); setMark({}); setCur(0); setConfirm(false)
      setLeft(mins*60); startRef.current = Date.now(); doneRef.current = false
      setPhase("run")
    }catch(ex){ setErr(ex?.response?.data?.detail || ex.message || "Couldn't build the paper."); setPhase("setup") }
  }

  useEffect(()=>{
    if(phase !== "run") return
    const id = setInterval(()=>setLeft(l=>l-1), 1000)
    return ()=>clearInterval(id)
  },[phase])
  useEffect(()=>{ if(phase === "run" && left <= 0) submit() },[left, phase])

  function submit(){
    if(doneRef.current) return
    doneRef.current = true
    let right = 0, wrong = 0, skipped = 0
    const topics = {}
    qs.forEach((q,i)=>{
      const t = topicOf(q); topics[t] = topics[t] || { topic:t, ok:0, n:0 }; topics[t].n++
      if(ans[i] === undefined) skipped++
      else if(ans[i] === q.answer){ right++; topics[t].ok++ }
      else wrong++
    })
    const score = right*st.right + wrong*st.wrong
    const max = qs.length * st.right
    const pct = Math.max(0, Math.round(score/max*100))
    recordAnswers(qs.map((q,i)=>({ topic: topicOf(q), ok: ans[i] === q.answer, q: q.question })).filter((_,i)=>ans[i] !== undefined))
    try{ const sc = JSON.parse(localStorage.getItem("ml_scores") || "[]"); sc.push({ date: new Date().toISOString(), pct }); localStorage.setItem("ml_scores", JSON.stringify(sc)); window.dispatchEvent(new CustomEvent("ml-ls", { detail:"ml_scores" })) }catch(e){}
    setReport({ right, wrong, skipped, score: Math.round(score*100)/100, max, pct, used: Math.min(mins*60, Math.round((Date.now() - startRef.current)/1000)), topics: Object.values(topics) })
    setPhase("report"); sounds.success()
  }

  if(phase === "setup" || phase === "loading") return (
    <div className="card">
      <div className="exam-setup">
        <label>Exam style<select className="sel" value={style} onChange={e=>setStyle(e.target.value)}>{Object.entries(EXAM_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
        <label>Questions<select className="sel" value={count} onChange={e=>{ setCount(+e.target.value); setMins(+e.target.value) }}>{[10,15,20].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <label>Time limit<select className="sel" value={mins} onChange={e=>setMins(+e.target.value)}>{[5,10,15,20,30,45,60].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>
      </div>
      <div className="tool-actions" style={{marginTop:16}}>
        <button className="btn btn-p" disabled={phase==="loading"} onClick={start}>{phase==="loading" ? <Spin/> : "Start exam"}</button>
        <span className="kmap-hint">Marking: +{st.right} right, {st.wrong} wrong, 0 skipped</span>
      </div>
      {err && <div className="form-err">{err}</div>}
      {phase==="loading" && <div className="skel-card"><Skeleton lines={5}/><div className="kmap-hint" style={{marginTop:10}}>Building your paper from the PDF…</div></div>}
      {phase==="setup" && !err && <Empty icon="📝" title="Ready for a mock paper?" body="The clock starts as soon as the paper is ready. You can mark questions for review and jump around with the navigator." />}
    </div>
  )

  if(phase === "run"){
    const q = qs[cur]
    const answered = Object.keys(ans).length
    const low = left <= 60
    return (
      <div className="card exam-run">
        <div className="exam-top">
          <div className={"exam-timer" + (low ? " low" : "")}>⏱ {fmt(Math.max(0,left))}</div>
          <div className="exam-count">{answered}/{qs.length} answered</div>
          <button className={"btn btn-sm " + (confirm ? "btn-p" : "btn-ghost")} onClick={()=>{ if(confirm) submit(); else { setConfirm(true); setTimeout(()=>setConfirm(false), 4000) } }}>
            {confirm ? (answered<qs.length ? `Submit (${qs.length-answered} unanswered)?` : "Confirm submit") : "Submit"}
          </button>
        </div>
        <div className="exam-nav">
          {qs.map((_,i)=>(
            <button key={i} className={"exam-dot" + (i===cur?" cur":"") + (ans[i]!==undefined?" done":"") + (mark[i]?" mark":"")} onClick={()=>setCur(i)}>{i+1}</button>
          ))}
        </div>
        <div className="qcard" key={cur}>
          <div className="q-text"><span className="q-num">{cur+1}</span>{q.question}</div>
          {q.options.map((o,j)=>(
            <label key={j} className={"qopt" + (ans[cur]===o ? " selected" : "")}>
              <input type="radio" name="exam" checked={ans[cur]===o} onChange={()=>setAns(a=>({...a,[cur]:o}))} />
              <span className="qopt-key">{String.fromCharCode(65+j)}</span>{o}
            </label>
          ))}
        </div>
        <div className="exam-foot">
          <button className="btn btn-ghost btn-sm" disabled={cur===0} onClick={()=>setCur(c=>c-1)}>◀ Prev</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setAns(a=>{ const n = {...a}; delete n[cur]; return n })}>Clear</button>
          <button className={"btn btn-ghost btn-sm" + (mark[cur] ? " flagged" : "")} onClick={()=>setMark(m=>({...m,[cur]:!m[cur]}))}>{mark[cur] ? "⚑ Marked" : "⚐ Mark for review"}</button>
          <button className="btn btn-p btn-sm" disabled={cur===qs.length-1} onClick={()=>setCur(c=>c+1)}>Next ▶</button>
        </div>
      </div>
    )
  }

  // report
  const r = report
  return (
    <div className="card">
      <div className="result-card" style={{marginTop:0}}>
        <Ring pct={r.pct} />
        <div className="result-text">
          <h3>{r.pct >= 80 ? "Exam-ready!" : r.pct >= 55 ? "Solid attempt" : "Keep revising"}</h3>
          <p>{r.score} / {r.max} marks · {fmt(r.used)} used</p>
          <div className="rep-pills"><span className="ok">✓ {r.right} right</span><span className="bad">✕ {r.wrong} wrong</span><span>– {r.skipped} skipped</span></div>
          <button className="btn btn-p btn-sm" style={{marginTop:12}} onClick={()=>{ setPhase("setup"); setReport(null) }}>New exam</button>
          <button className="btn btn-ghost btn-sm" style={{marginTop:12, marginLeft:8}} onClick={()=>printDoc("Exam report", `<h2>${r.pct}% · ${r.score} / ${r.max} marks</h2><p>${r.right} right · ${r.wrong} wrong · ${r.skipped} skipped · ${fmt(r.used)} used</p><h2>By topic</h2>` + r.topics.map(t=>`<div class="q"><b>${esc(t.t || t.topic || t.name || "")}</b> ${t.ok ?? t.right ?? ""}/${t.n ?? t.total ?? ""}</div>`).join(""))}>🖨 Save as PDF</button>
        </div>
      </div>
      <h4 className="rep-h">By topic</h4>
      <div className="weak-bars">{r.topics.map(t=>(
        <div key={t.topic} className="wb-row"><span>{t.topic}</span><div className={"wb-track" + (t.ok/t.n < 0.5 ? " bad" : "")}><div style={{ width: (t.ok/t.n*100) + "%" }}/></div><b>{t.ok}/{t.n}</b></div>
      ))}</div>
      <h4 className="rep-h">Review</h4>
      {qs.map((q,i)=>{
        const ok = ans[i] === q.answer, skip = ans[i] === undefined
        return (
          <div key={i} className={"rev-item" + (skip ? " skip" : ok ? " ok" : " bad")}>
            <div className="rev-q"><span className="q-num">{i+1}</span>{q.question}</div>
            <div className="rev-a">{skip ? "Skipped" : <>Your answer: <b>{ans[i]}</b></>}{!ok && <> · Correct: <b>{q.answer}</b></>}</div>
            {q.explanation && <div className="rev-e">{q.explanation}</div>}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   Voice tutor
   ============================================================ */
export function VoiceTab(){
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const [state, setState] = useState("idle")
  const [log, setLog] = useState([])
  const [hands, setHands] = useState(false)
  const [text, setText] = useState("")
  const [interim, setInterim] = useState("")
  const [note, setNote] = useState("")
  const handsRef = useRef(hands); handsRef.current = hands
  const stateRef = useRef(state); stateRef.current = state
  const recRef = useRef(null), orbRef = useRef(null), ampRef = useRef(null), endRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:"smooth", block:"nearest" }) },[log, interim])
  useEffect(()=>{
    aliveRef.current = true
    return ()=>{ aliveRef.current = false; try{ recRef.current?.abort() }catch(e){}; try{ window.speechSynthesis?.cancel() }catch(e){}; stopAmp() }
  },[])

  function stopAmp(){ ampRef.current?.(); ampRef.current = null; orbRef.current?.style.setProperty("--lvl", 0) }
  async function startAmp(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true })
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(); an.fftSize = 256
      src.connect(an)
      const buf = new Uint8Array(an.frequencyBinCount)
      let raf, lvl = 0
      const loop = ()=>{
        an.getByteFrequencyData(buf)
        const avg = buf.reduce((a,b)=>a+b,0) / buf.length / 255
        lvl += (Math.min(1, avg*3) - lvl) * 0.25
        orbRef.current?.style.setProperty("--lvl", lvl.toFixed(3))
        raf = requestAnimationFrame(loop)
      }
      loop()
      ampRef.current = ()=>{ cancelAnimationFrame(raf); stream.getTracks().forEach(t=>t.stop()); ctx.close().catch(()=>{}) }
    }catch(e){}
  }

  function listen(){
    if(!SR){ setNote("Speech recognition isn't supported in this browser. Use Chrome, Edge or Safari, or type below."); return }
    try{ window.speechSynthesis?.cancel() }catch(e){}
    const rec = new SR()
    rec.lang = LANGS[getOutLang()].rec
    rec.interimResults = true; rec.continuous = false
    let finalText = ""
    rec.onresult = e=>{
      let interimT = ""
      for(let i = e.resultIndex; i < e.results.length; i++){
        if(e.results[i].isFinal) finalText += e.results[i][0].transcript
        else interimT += e.results[i][0].transcript
      }
      setInterim(interimT || finalText)
    }
    rec.onerror = e=>{ if(e.error === "not-allowed") setNote("Microphone access was blocked. Allow it in your browser's address bar and try again."); else if(e.error !== "no-speech" && e.error !== "aborted") setNote("Couldn't hear that (" + e.error + ").") }
    rec.onend = ()=>{
      stopAmp(); setInterim("")
      if(!aliveRef.current) return
      if(finalText.trim()) ask(finalText.trim())
      else if(stateRef.current === "listening") setState("idle")
    }
    recRef.current = rec
    setNote(""); setState("listening"); startAmp()
    try{ rec.start() }catch(e){ setState("idle") }
  }

  async function ask(q){
    setLog(l=>[...l, { role:"user", text:q }]); setState("thinking"); setText("")
    try{
      const a = await askText(q + "\n\nAnswer in at most 4 short sentences, as if speaking aloud. No markdown, bullets or symbols. " + langInstruction())
      if(!aliveRef.current) return
      setLog(l=>[...l, { role:"assistant", text:a }])
      speak(a)
    }catch(ex){
      setLog(l=>[...l, { role:"assistant", text:"⚠️ " + (ex?.response?.data?.detail || "Couldn't reach the AI. Is a PDF uploaded?") }])
      setState("idle")
    }
  }
  function speak(a){
    const synth = window.speechSynthesis
    if(!synth){ setState("idle"); return }
    const clean = a.replace(/[*_#`>~|]/g, " ").replace(/\s+/g, " ").trim()
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = LANGS[getOutLang()].tts; u.rate = 1
    u.onstart = ()=>setState("speaking")
    u.onend = ()=>{ if(!aliveRef.current) return; if(handsRef.current) listen(); else setState("idle") }
    u.onerror = ()=>{ if(aliveRef.current) setState("idle") }
    synth.cancel(); setState("speaking"); synth.speak(u)
  }
  function orbClick(){
    if(state === "idle") listen()
    else if(state === "listening"){ try{ recRef.current?.stop() }catch(e){} }
    else if(state === "speaking"){ try{ window.speechSynthesis.cancel() }catch(e){}; setState("idle") }
  }

  const label = { idle:"Tap the orb and speak", listening:"Listening…", thinking:"Thinking…", speaking:"Speaking · tap to stop" }[state]
  return (
    <div className="card voice-card">
      <div className={"voice-stage " + state}>
        <button ref={orbRef} className="voice-orb" onClick={orbClick} aria-label={label}>
          <i/><i/><i/><span/>
        </button>
        <div className="voice-label">{label}</div>
        {interim && <div className="voice-interim">“{interim}”</div>}
        <label className="voice-toggle"><input type="checkbox" checked={hands} onChange={e=>setHands(e.target.checked)} /> Hands-free (keep listening after each answer)</label>
        <div className="voice-lang">Language: <b>{LANGS[getOutLang()].label}</b> · change it in the sidebar</div>
      </div>
      {note && <div className="form-err">{note}</div>}
      <div className="voice-log">
        {log.length === 0 && <div className="chart-empty">Your conversation will appear here.</div>}
        {log.map((m,i)=>(<div key={i} className={"msg " + m.role}><div className="msg-body">{m.text}</div></div>))}
        {state === "thinking" && <div className="msg assistant typing"><span className="typing-dots"><i/><i/><i/></span></div>}
        <div ref={endRef} />
      </div>
      <div className="chat-input-row">
        <input className="inp" placeholder="…or type a question" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" && text.trim() && state==="idle") ask(text.trim()) }} />
        <button className="btn btn-p" disabled={!text.trim() || state==="thinking"} onClick={()=>ask(text.trim())}>Ask</button>
      </div>
    </div>
  )
}
