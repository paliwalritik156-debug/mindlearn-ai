import { isLite } from "./perf.js"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { api, useLocalState, toast, sounds, askText, langInstruction, FUN_META, isSoundOn } from "./lib.jsx"
import { calcXp, levelOf, streakOf, saveToNotes } from "./core.js"
import { leagueOf } from "./v22.jsx"

const go = k => window.dispatchEvent(new CustomEvent("ml-goto", { detail: k }))
const DAY = 86400000
const dk = t => new Date(t).toDateString()
const buzz = ms => { try{ if(navigator.vibrate && window.matchMedia("(pointer: coarse)").matches) navigator.vibrate(ms) }catch(e){} }
const notify = k => window.dispatchEvent(new CustomEvent("ml-ls", { detail: k }))
export const confetti = () => { if(isLite()) return; window.dispatchEvent(new Event("ml-confetti")) }

/* ================= stats helpers ================= */
export function weekStats(activity, scores){
  const from = Date.now() - 7 * DAY
  const acts = (activity || []).filter(a=>a.at >= from && a.k && a.k !== "Home")
  const days = new Set(acts.map(a=>dk(a.at)))
  const counts = {}; acts.forEach(a=>{ counts[a.k] = (counts[a.k] || 0) + 1 })
  const top = Object.entries(counts).sort((a, b)=>b[1] - a[1])[0]
  const qs = (scores || []).filter(s=>new Date(s.date).getTime() >= from)
  const avg = qs.length ? Math.round(qs.reduce((a, s)=>a + (+s.pct || 0), 0) / qs.length) : 0
  const best = qs.length ? Math.round(Math.max(...qs.map(s=>+s.pct || 0))) : 0
  const bestAll = (scores || []).length ? Math.round(Math.max(...scores.map(s=>+s.pct || 0))) : 0
  return { actions: acts.length, activeDays: days.size, topKey: top?.[0], topTitle: top ? (FUN_META[top[0]]?.title || top[0]) : null, topCount: top?.[1] || 0, quizzes: qs.length, avg, best, bestAll }
}

/* ================= confetti + global effects ================= */
function ConfettiLayer(){
  const cv = useRef(null), raf = useRef(0), parts = useRef([])
  useEffect(()=>{
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const f = ()=>{
      if(reduce) return
      const c = cv.current; if(!c) return
      c.width = innerWidth; c.height = innerHeight
      const cols = ["#8b6bff", "#2de3f0", "#f472b6", "#fbbf24", "#34d399", "#fff"]
      for(let i = 0; i < 140; i++){
        const a = Math.random() * Math.PI * 2, s = 6 + Math.random() * 12
        parts.current.push({ x: innerWidth / 2, y: innerHeight * 0.45, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], life: 1 })
      }
      cancelAnimationFrame(raf.current)
      const ctx = c.getContext("2d")
      const tick = ()=>{
        ctx.clearRect(0, 0, c.width, c.height)
        parts.current = parts.current.filter(p=>p.life > 0 && p.y < c.height + 20)
        parts.current.forEach(p=>{ p.x += p.vx; p.y += p.vy; p.vy += .28; p.vx *= .99; p.r += p.vr; p.life -= .006
          ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore() })
        if(parts.current.length) raf.current = requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height)
      }
      tick()
    }
    window.addEventListener("ml-confetti", f); return ()=>{ window.removeEventListener("ml-confetti", f); cancelAnimationFrame(raf.current) }
  },[])
  return <canvas ref={cv} className="confetti-layer" aria-hidden="true" />
}

function useEasterEggs(){
  const [fly, setFly] = useState(0)
  useEffect(()=>{
    const KON = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"]
    let ki = 0, typed = ""
    const f = e=>{
      if(/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return
      ki = e.key === KON[ki] ? ki + 1 : (e.key === KON[0] ? 1 : 0)
      if(ki === KON.length){ ki = 0; confetti(); sounds.unlock(); document.documentElement.classList.add("rainbow"); setTimeout(()=>document.documentElement.classList.remove("rainbow"), 6000); toast("🎮 Konami! You found the secret. Study mode: legendary.", "ok") }
      if(e.key.length === 1){ typed = (typed + e.key.toLowerCase()).slice(-5); if(typed === "mindy"){ typed = ""; setFly(n=>n + 1); sounds.pop() } }
    }
    window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f)
  },[])
  return fly ? <div key={fly} className="mindy-fly" aria-hidden="true">🤖<span>Hi, I'm Mindy!</span></div> : null
}

/* tiny haptic tick on buttons (touch devices) + page transitions are CSS */
function useHaptics(){
  useEffect(()=>{
    const f = e=>{ if(isSoundOn() && e.target.closest?.("button, .btn")) buzz(6) }
    document.addEventListener("pointerdown", f, { passive:true }); return ()=>document.removeEventListener("pointerdown", f)
  },[])
}

/* ================= share cards ================= */
function rr(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
export function drawCard(canvas, d){
  const W = 1080, H = 1350; canvas.width = W; canvas.height = H
  const c = canvas.getContext("2d")
  const css = getComputedStyle(document.documentElement)
  const v = (css.getPropertyValue("--v") || "#8b6bff").trim(), cy = (css.getPropertyValue("--cy") || "#2de3f0").trim()
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0b0a1f"); g.addColorStop(1, "#1a1246"); c.fillStyle = g; c.fillRect(0, 0, W, H)
  const blob = (x, y, r, col)=>{ const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, "transparent"); c.fillStyle = rg; c.fillRect(0, 0, W, H) }
  blob(180, 200, 600, v + "88"); blob(960, 1180, 640, cy + "66")
  c.strokeStyle = "rgba(255,255,255,.06)"; c.lineWidth = 2; for(let i = 0; i < 12; i++){ c.beginPath(); c.arc(W / 2, 640, 120 + i * 60, 0, 7); c.stroke() }
  // brand
  c.fillStyle = "#fff"; c.font = "800 44px system-ui, sans-serif"; c.textAlign = "left"; c.fillText("MindLearn", 80, 120)
  c.fillStyle = cy; c.fillText("AI", 80 + c.measureText("MindLearn ").width, 120)
  // card
  rr(c, 80, 240, W - 160, 780, 56); c.fillStyle = "rgba(255,255,255,.07)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 3; c.stroke()
  c.textAlign = "center"; c.fillStyle = "rgba(255,255,255,.7)"; c.font = "600 40px system-ui, sans-serif"; c.fillText((d.kicker || "").toUpperCase(), W / 2, 350)
  c.font = "700 190px system-ui, sans-serif"; const big = String(d.big)
  const gg = c.createLinearGradient(0, 450, W, 700); gg.addColorStop(0, "#fff"); gg.addColorStop(1, cy); c.fillStyle = gg; c.fillText(big, W / 2, 640)
  c.fillStyle = "#fff"; c.font = "700 64px system-ui, sans-serif"; c.fillText(d.title || "", W / 2, 750)
  c.fillStyle = "rgba(255,255,255,.65)"; c.font = "500 38px system-ui, sans-serif"
  ;(d.lines || []).forEach((l, i)=>c.fillText(l, W / 2, 830 + i * 56))
  c.font = "700 46px system-ui, sans-serif"; c.fillStyle = cy; c.fillText(d.emoji || "", W / 2, 960)
  c.fillStyle = "rgba(255,255,255,.75)"; c.font = "600 40px system-ui, sans-serif"; c.fillText("Study smarter from your own PDFs", W / 2, 1160)
  c.fillStyle = "rgba(255,255,255,.4)"; c.font = "500 32px system-ui, sans-serif"; c.fillText((d.name ? d.name + " · " : "") + new Date().toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" }), W / 2, 1230)
}
export function cardData(kind, activity, scores, user){
  const xp = calcXp(activity, scores), L = levelOf(xp), lg = leagueOf(xp), st = streakOf(activity), w = weekStats(activity, scores)
  const name = (user?.name || "").split(" ")[0]
  if(kind === "streak") return { kicker:"Study streak", big: st + "🔥", title: st === 1 ? "day in a row" : "days in a row", lines:[`${w.actions} actions this week`, `Level ${L.lvl} · ${L.title}`], emoji:"Keep it alive", name }
  if(kind === "level") return { kicker:"Level up", big: "Lv " + L.lvl, title: L.title, lines:[`${xp} XP earned`, `${lg.name} league ${lg.icon}`], emoji:"Always learning", name }
  if(kind === "score") return { kicker:"Best quiz score", big: (w.bestAll || 0) + "%", title: "Quiz champion", lines:[`${(scores || []).length} quizzes taken`, w.quizzes ? `${w.avg}% average this week` : "Keep practising"], emoji:"🎯", name }
  return { kicker:"My study week", big: w.actions, title: "actions this week", lines:[`${w.activeDays} active day${w.activeDays === 1 ? "" : "s"} · ${st}-day streak`, w.topTitle ? `Most used: ${w.topTitle}` : "Fresh start"], emoji:"📚", name }
}
function ShareModal({ kind: k0, onClose }){
  const [activity] = useLocalState("ml_activity", []), [scores] = useLocalState("ml_scores", []), [user] = useLocalState("ml_user", null)
  const [kind, setKind] = useState(k0 || "week")
  const cv = useRef(null)
  useEffect(()=>{ if(cv.current) drawCard(cv.current, cardData(kind, activity, scores, user)) },[kind])
  useEffect(()=>{ const f = e=>{ if(e.key === "Escape") onClose() }; window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f) },[])
  const blob = ()=>new Promise(r=>cv.current.toBlob(r, "image/png"))
  async function dl(){ const b = await blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `mindlearn-${kind}.png`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000); toast("Image saved.", "ok") }
  async function share(){
    try{
      const b = await blob(), file = new File([b], `mindlearn-${kind}.png`, { type:"image/png" })
      if(navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], text:"My progress on MindLearn AI 📚" }) } else { await dl() }
    }catch(e){ if(e?.name !== "AbortError") dl() }
  }
  return (
    <div className="modal-bg share-bg" onClick={onClose}>
      <div className="share-modal" role="dialog" aria-modal="true" aria-label="Share your progress" onClick={e=>e.stopPropagation()}>
        <button className="modal-x" aria-label="Close" onClick={onClose}>×</button>
        <h3>Share your progress</h3>
        <div className="share-tabs" role="tablist">{[["week", "Week"], ["streak", "Streak"], ["level", "Level"], ["score", "Score"]].map(([k, l])=><button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={()=>setKind(k)}>{l}</button>)}</div>
        <canvas ref={cv} className="share-canvas" aria-label="Preview of your share card" />
        <div className="share-actions"><button className="btn btn-p" onClick={share}>📤 Share</button><button className="btn btn-ghost" onClick={dl}>⬇ Save image</button></div>
      </div>
    </div>
  )
}

/* ================= Study Wrapped (stories) ================= */
function Wrapped({ onClose, onShare }){
  const [activity] = useLocalState("ml_activity", []), [scores] = useLocalState("ml_scores", []), [user] = useLocalState("ml_user", null)
  const [idx, setIdx] = useState(0)
  const w = weekStats(activity, scores), xp = calcXp(activity, scores), L = levelOf(xp), lg = leagueOf(xp), st = streakOf(activity)
  const name = (user?.name || "").split(" ")[0] || "Learner"
  const slides = [
    { bg:"s1", k:"Your week in study", big:"👋", t:`Hey ${name}`, s:"Here's how your last 7 days went." },
    { bg:"s2", k:"You did", big:w.actions, t: w.actions === 1 ? "study action" : "study actions", s: w.activeDays ? `across ${w.activeDays} active day${w.activeDays === 1 ? "" : "s"}` : "Let's make next week count." },
    w.topTitle ? { bg:"s3", k:"Your go-to tool", big:"⭐", t:w.topTitle, s:`${w.topCount} time${w.topCount === 1 ? "" : "s"} this week` } : null,
    { bg:"s4", k:"Quizzes", big: w.quizzes ? w.avg + "%" : "—", t: w.quizzes ? "average score" : "No quizzes yet", s: w.quizzes ? `${w.quizzes} quiz${w.quizzes === 1 ? "" : "zes"} · best ${w.best}%` : "Take one and it shows up here." },
    { bg:"s5", k:"Streak", big:st + "🔥", t: st === 1 ? "day streak" : "day streak", s: st >= 3 ? "Consistency beats intensity." : "Show up tomorrow to grow it." },
    { bg:"s6", k:"Where you stand", big:lg.icon, t:`${lg.name} league · Level ${L.lvl}`, s:`${L.title} · ${xp} XP` },
    { bg:"s7", k:"See you next week", big:"🚀", t:"Keep going", s:"Share your week with friends.", end:true },
  ].filter(Boolean)
  const last = slides.length - 1, cur = slides[idx]
  useEffect(()=>{ if(idx >= last) return; const t = setTimeout(()=>setIdx(i=>i + 1), 4800); return ()=>clearTimeout(t) },[idx])
  useEffect(()=>{ if(idx === 1 || idx === last) confetti() },[idx])
  useEffect(()=>{
    const f = e=>{ if(e.key === "Escape") onClose(); else if(e.key === "ArrowRight") setIdx(i=>Math.min(last, i + 1)); else if(e.key === "ArrowLeft") setIdx(i=>Math.max(0, i - 1)) }
    window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f)
  },[last])
  return (
    <div className={"wrapped " + cur.bg} role="dialog" aria-modal="true" aria-label="Your study week">
      <div className="wr-bars" aria-hidden="true">{slides.map((_, i)=><i key={i}><b className={i < idx ? "full" : i === idx ? "run" : ""} style={i === idx && idx < last ? undefined : i === idx ? { width:"100%", animation:"none" } : undefined} /></i>)}</div>
      <button className="wr-x" aria-label="Close" onClick={onClose}>✕</button>
      <button className="wr-nav l" aria-label="Previous" onClick={()=>setIdx(i=>Math.max(0, i - 1))} />
      <button className="wr-nav r" aria-label="Next" onClick={()=>setIdx(i=>Math.min(last, i + 1))} />
      <div className="wr-body" key={idx} aria-live="polite">
        <div className="wr-k">{cur.k}</div>
        <div className={"wr-big" + (/^[\d%—]+$/.test(String(cur.big)) ? "" : " emo")}>{cur.big}</div>
        <div className="wr-t">{cur.t}</div>
        <div className="wr-s">{cur.s}</div>
        {cur.end && <div className="wr-end"><button className="btn btn-p" onClick={()=>{ onClose(); onShare("week") }}>📤 Share my week</button><button className="btn btn-ghost" onClick={onClose}>Close</button></div>}
      </div>
    </div>
  )
}
export function WrappedCard(){
  const [activity] = useLocalState("ml_activity", [])
  const [scores] = useLocalState("ml_scores", [])
  const w = weekStats(activity, scores)
  return (
    <div className="wrcard">
      <div className="wrc-main"><b>Your week, wrapped ✨</b><span>{w.actions} actions · {w.quizzes} quiz{w.quizzes === 1 ? "" : "zes"} · {streakOf(activity)}-day streak</span></div>
      <div className="wrc-act"><button className="btn btn-p btn-sm" onClick={()=>window.dispatchEvent(new Event("ml-wrapped"))}>▶ Watch</button><button className="btn btn-ghost btn-sm" onClick={()=>window.dispatchEvent(new CustomEvent("ml-sharecard", { detail:"streak" }))}>📤 Share</button></div>
    </div>
  )
}

/* ================= text-selection toolbar ================= */
function SelectToolbar(){
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState("")
  const [out, setOut] = useState("")
  const boxRef = useRef(null)
  const check = useCallback(()=>{
    const s = window.getSelection()
    if(!s || s.isCollapsed || !s.rangeCount){ return }
    const text = s.toString().trim()
    if(text.length < 6 || text.length > 900) return
    const n = s.anchorNode && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode)
    if(!n || n.closest?.("input, textarea, [contenteditable=true], .sel-tb, .dash-sidebar, nav, .authpage, button, .wrapped")) return
    if(!n.closest?.(".dash-main, main, .dash-content, .dash-root")) return
    const r = s.getRangeAt(0).getBoundingClientRect()
    if(!r.width && !r.height) return
    setSel({ text, x: Math.min(innerWidth - 20, Math.max(20, r.left + r.width / 2)), y: r.top > 90 ? r.top - 8 : r.bottom + 8, below: r.top <= 90 })
    setOut("")
  },[])
  useEffect(()=>{
    let t
    const up = e=>{ if(e && e.target && e.target.closest && e.target.closest(".sel-tb")) return; clearTimeout(t); t = setTimeout(check, 60) }
    const down = e=>{ if(!e.target.closest?.(".sel-tb")){ setSel(null); setOut("") } }
    document.addEventListener("mouseup", up); document.addEventListener("touchend", up); document.addEventListener("keyup", e=>{ if(e.key === "Shift") up() }); document.addEventListener("mousedown", down)
    return ()=>{ document.removeEventListener("mouseup", up); document.removeEventListener("touchend", up); document.removeEventListener("mousedown", down) }
  },[check])
  if(!sel) return null
  const run = async (kind)=>{
    if(kind === "note"){ saveToNotes(sel.text.slice(0, 50), sel.text); return }
    setBusy(kind); setOut("")
    try{
      const base = `"${sel.text}"`
      if(kind === "flash"){
        const a = await askText(`Give a short answer (max 2 sentences) that works as the back of a flashcard for this text: ${base}. ${langInstruction()}`)
        const list = JSON.parse(localStorage.getItem("ml_srs") || "[]"); list.push({ q: sel.text.length > 120 ? "Explain: " + sel.text.slice(0, 117) + "…" : sel.text, a: String(a).trim(), interval:1, due:Date.now() })
        localStorage.setItem("ml_srs", JSON.stringify(list)); notify("ml_srs"); toast("Flashcard added to your review deck.", "ok"); setSel(null)
      } else {
        const t = await askText(kind === "hi" ? `Explain this in simple Hinglish (Hindi in Roman letters), in 3-4 sentences: ${base}` : `Explain this simply in 3-4 sentences for a student: ${base}. ${langInstruction()}`)
        setOut(String(t).trim())
      }
    }catch(e){ toast("Couldn't reach the AI. Try again in a moment.", "error") }
    finally{ setBusy("") }
  }
  const style = { left: sel.x, top: sel.y, transform: sel.below ? "translate(-50%,0)" : "translate(-50%,-100%)" }
  return (
    <div className="sel-tb" style={style} ref={boxRef} role="toolbar" aria-label="Text actions" onMouseDown={e=>e.stopPropagation()}>
      <div className="sel-row">
        <button onClick={()=>run("explain")} disabled={!!busy}>{busy === "explain" ? "…" : "💡 Explain"}</button>
        <button onClick={()=>run("hi")} disabled={!!busy}>{busy === "hi" ? "…" : "🇮🇳 Hinglish"}</button>
        <button onClick={()=>run("flash")} disabled={!!busy}>{busy === "flash" ? "…" : "🗂️ Flashcard"}</button>
        <button onClick={()=>run("note")} disabled={!!busy}>📝 Note</button>
      </div>
      {out && <div className="sel-out"><p>{out}</p><div><button onClick={()=>{ saveToNotes("Explained: " + sel.text.slice(0, 40), sel.text + "\n\n" + out); setSel(null) }}>💾 Save</button><button onClick={()=>setSel(null)}>Close</button></div></div>}
    </div>
  )
}

/* ================= host ================= */
export function V24Host({ onAction }){
  const [wr, setWr] = useState(false)
  const [share, setShare] = useState(null)
  const egg = useEasterEggs()
  useHaptics()
  useEffect(()=>{
    const a = ()=>setWr(true), b = e=>setShare(e.detail || "week")
    window.addEventListener("ml-wrapped", a); window.addEventListener("ml-sharecard", b)
    return ()=>{ window.removeEventListener("ml-wrapped", a); window.removeEventListener("ml-sharecard", b) }
  },[])
  return (
    <>
      <ConfettiLayer />
      {egg}
      <SelectToolbar />
      {wr && <Wrapped onClose={()=>setWr(false)} onShare={k=>setShare(k)} />}
      {share && <ShareModal kind={share} onClose={()=>setShare(null)} />}
    </>
  )
}

/* ================= swipe flashcards ================= */
export function SwipeTab(){
  const [cards, setCards] = useLocalState("ml_srs", [])
  const [deck] = useLocalState("ml_deck", [])
  const [flip, setFlip] = useState(false)
  const [drag, setDrag] = useState({ x:0, y:0, on:false })
  const [fly, setFly] = useState(0)
  const [stats, setStats] = useState({ good:0, again:0 })
  const start = useRef(null)
  const due = cards.map((c, i)=>({ c, i })).filter(o=>o.c.due <= Date.now())
  const cur = due[0]
  const rate = useCallback(good=>{
    if(!cur) return
    setFly(good ? 1 : -1); buzz(good ? 12 : [10, 30, 10]); good ? sounds.pop() : sounds.tick()
    setTimeout(()=>{
      setCards(cs=>cs.map((c, i)=>i !== cur.i ? c : { ...c, interval: good ? Math.max(1, c.interval * 2) : 1, due: Date.now() + (good ? Math.max(1, c.interval * 2) : 1) * DAY - (good ? 0 : DAY + 1) }))
      setStats(s=>({ good: s.good + (good ? 1 : 0), again: s.again + (good ? 0 : 1) }))
      setFly(0); setFlip(false); setDrag({ x:0, y:0, on:false })
    }, 260)
  },[cur?.i, due.length])
  useEffect(()=>{
    const f = e=>{ if(/input|textarea|select/i.test(e.target.tagName)) return
      if(e.key === "ArrowRight") rate(true); else if(e.key === "ArrowLeft") rate(false); else if(e.key === " " || e.key === "Enter"){ e.preventDefault(); setFlip(x=>!x) } }
    window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f)
  },[rate])
  useEffect(()=>{ if(stats.good + stats.again > 0 && !cur){ confetti(); sounds.success() } },[cur])
  const onDown = e=>{ start.current = { x:e.clientX, y:e.clientY, t:Date.now() }; setDrag(d=>({ ...d, on:true })); e.currentTarget.setPointerCapture?.(e.pointerId) }
  const onMove = e=>{ if(!start.current) return; setDrag({ x:e.clientX - start.current.x, y:(e.clientY - start.current.y) * .3, on:true }) }
  const onUp = ()=>{
    if(!start.current) return
    const { x } = drag, moved = Math.abs(x) > 6
    start.current = null
    if(x > 110) rate(true); else if(x < -110) rate(false); else { setDrag({ x:0, y:0, on:false }); if(!moved) setFlip(f=>!f) }
  }
  const importDeck = ()=>{ setCards(deck.map(c=>({ ...c, interval:1, due:Date.now() }))); toast(`Added ${deck.length} cards to your review deck.`, "ok") }
  if(!cards.length) return (
    <div className="card swipe-empty"><div className="empty-icon">👆</div><h3>Swipe to study</h3><p className="profile-email">Build a deck first, then review it Tinder-style.</p>
      {deck.length > 0 && <button className="btn btn-p" onClick={importDeck}>Use my last flashcard deck ({deck.length})</button>}
      <button className="btn btn-ghost" onClick={()=>go("flashcards")}>Generate flashcards</button></div>
  )
  if(!cur) return (
    <div className="card swipe-empty"><div className="empty-icon">🎉</div><h3>All caught up!</h3><p className="profile-email">{stats.good + stats.again > 0 ? `You reviewed ${stats.good + stats.again} cards (${stats.good} remembered).` : "No cards due right now."} Come back tomorrow.</p>
      <button className="btn btn-ghost" onClick={()=>go("Home")}>Back to Home</button></div>
  )
  const x = fly ? fly * 700 : drag.x, rot = x / 18
  return (
    <div className="swipe">
      <div className="swipe-top"><span>{due.length} due</span><span className="swipe-hint">← Forgot · Remembered →</span><span>{stats.good}✓ {stats.again}✗</span></div>
      <div className="swipe-stage">
        <div className="swipe-back" aria-hidden="true" />
        <div className={"swipe-card" + (flip ? " flip" : "") + (drag.on ? " drag" : "")} style={{ transform:`translate(${x}px, ${drag.y}px) rotate(${rot}deg)`, transition: drag.on ? "none" : "transform .26s ease, opacity .26s", opacity: fly ? 0 : 1 }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="group" aria-label="Flashcard. Press space to flip, arrow keys to rate." tabIndex={0}>
          <div className="sw-face sw-front"><small>Question</small><p>{cur.c.q}</p><em>tap to flip</em></div>
          <div className="sw-face sw-back"><small>Answer</small><p>{cur.c.a || "(no answer saved)"}</p></div>
          <div className="sw-stamp good" style={{ opacity: Math.min(1, Math.max(0, x / 110)) }}>KNEW IT</div>
          <div className="sw-stamp bad" style={{ opacity: Math.min(1, Math.max(0, -x / 110)) }}>AGAIN</div>
        </div>
      </div>
      <div className="swipe-btns"><button className="btn btn-ghost" onClick={()=>rate(false)}>✗ Forgot</button><button className="btn btn-ghost" onClick={()=>setFlip(f=>!f)}>⟲ Flip</button><button className="btn btn-p" onClick={()=>rate(true)}>✓ Remembered</button></div>
    </div>
  )
}

/* ================= listen mode (text to speech) ================= */
function splitSentences(t){ return String(t).replace(/[#*_`>]+/g, " ").replace(/\s+/g, " ").match(/[^.!?।\n]+[.!?।]?/g)?.map(s=>s.trim()).filter(s=>s.length > 1) || [] }
export function ListenTab(){
  const ok = typeof window !== "undefined" && "speechSynthesis" in window
  const [notes] = useLocalState("ml_mynotes", [])
  const [srs] = useLocalState("ml_srs", [])
  const [src, setSrc] = useState("custom")
  const [text, setText] = useState("")
  const [rate, setRate] = useState(1)
  const [voices, setVoices] = useState([])
  const [vname, setVname] = useState("")
  const [pos, setPos] = useState(-1)
  const [state, setState] = useState("idle")
  const [sleep, setSleep] = useState(0)
  const sents = useMemo(()=>splitSentences(text), [text])
  const run = useRef(0), idxRef = useRef(0), rateRef = useRef(1), vRef = useRef("")
  rateRef.current = rate; vRef.current = vname
  useEffect(()=>{ if(!ok) return; const f = ()=>{ const v = speechSynthesis.getVoices(); setVoices(v); if(!vname){ const pref = v.find(x=>/en-IN|hi-IN/i.test(x.lang)) || v.find(x=>/^en/i.test(x.lang)) || v[0]; if(pref) setVname(pref.name) } }; f(); speechSynthesis.onvoiceschanged = f; return ()=>{ speechSynthesis.onvoiceschanged = null; speechSynthesis.cancel() } },[])
  useEffect(()=>{ if(src === "custom") return; if(src === "cards"){ setText(srs.map(c=>`${c.q}. ${c.a}`).join("\n")) } else { const n = notes.find(n=>n.id === src); setText(n ? n.title + ". " + n.body : "") } stop() },[src])
  useEffect(()=>{ if(!sleep || state !== "play") return; const t = setTimeout(()=>{ stop(); toast("Sleep timer: stopped listening.", "ok") }, sleep * 60000); return ()=>clearTimeout(t) },[sleep, state])
  function speakFrom(i){
    if(!ok) return
    const my = ++run.current; speechSynthesis.cancel()
    if(i >= sents.length){ setState("idle"); setPos(-1); return }
    idxRef.current = i; setPos(i); setState("play")
    const u = new SpeechSynthesisUtterance(sents[i]); u.rate = rateRef.current
    const v = speechSynthesis.getVoices().find(x=>x.name === vRef.current); if(v){ u.voice = v; u.lang = v.lang }
    u.onend = ()=>{ if(run.current === my) speakFrom(i + 1) }
    u.onerror = ()=>{ if(run.current === my && !speechSynthesis.speaking) setState("idle") }
    speechSynthesis.speak(u)
  }
  function stop(){ run.current++; try{ speechSynthesis.cancel() }catch(e){}; setState("idle"); setPos(-1) }
  const pause = ()=>{ speechSynthesis.pause(); setState("pause") }
  const resume = ()=>{ speechSynthesis.resume(); setState("play") }
  useEffect(()=>()=>{ run.current++; try{ speechSynthesis.cancel() }catch(e){} },[])
  if(!ok) return <div className="card"><div className="empty-state"><div className="empty-icon">🎧</div><div className="empty-title">Listening isn't supported here</div><div className="empty-body">Your browser has no text-to-speech. Try Chrome, Edge or Safari.</div></div></div>
  return (
    <div className="listen">
      <div className="card">
        <h3 style={{ marginTop:0 }}>🎧 Listen mode</h3>
        <p className="profile-email">Turn your notes or flashcards into audio. Great for walking, commuting, or eyes-closed revision.</p>
        <div className="ls-row">
          <label>Source<select className="sel" value={src} onChange={e=>setSrc(e.target.value)}>
            <option value="custom">Paste my own text</option>
            {srs.length > 0 && <option value="cards">Flashcards ({srs.length})</option>}
            {notes.slice(0, 20).map(n=><option key={n.id} value={n.id}>Note: {n.title || "Untitled"}</option>)}
          </select></label>
          <label>Voice<select className="sel" value={vname} onChange={e=>setVname(e.target.value)}>{voices.map(v=><option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</select></label>
          <label>Speed {rate.toFixed(1)}×<input type="range" min="0.6" max="1.8" step="0.1" value={rate} onChange={e=>setRate(+e.target.value)} /></label>
          <label>Sleep timer<select className="sel" value={sleep} onChange={e=>setSleep(+e.target.value)}><option value="0">Off</option><option value="5">5 min</option><option value="15">15 min</option><option value="30">30 min</option></select></label>
        </div>
        <textarea className="inp ls-text" rows={6} placeholder="Paste or type text to listen to…" value={text} onChange={e=>{ setText(e.target.value); setSrc("custom"); stop() }} />
        <div className="ls-ctl">
          <button className="btn btn-ghost btn-sm" disabled={!sents.length} onClick={()=>speakFrom(Math.max(0, idxRef.current - 1))} aria-label="Previous sentence">⏮</button>
          {state === "play" ? <button className="btn btn-p" onClick={pause}>⏸ Pause</button> : state === "pause" ? <button className="btn btn-p" onClick={resume}>▶ Resume</button> : <button className="btn btn-p" disabled={!sents.length} onClick={()=>speakFrom(0)}>▶ Play</button>}
          <button className="btn btn-ghost btn-sm" disabled={!sents.length} onClick={()=>speakFrom(idxRef.current + 1)} aria-label="Next sentence">⏭</button>
          <button className="btn btn-ghost btn-sm" onClick={stop}>⏹ Stop</button>
          <span className="profile-email">{sents.length ? `${pos >= 0 ? pos + 1 : 0}/${sents.length} sentences` : ""}</span>
        </div>
      </div>
      {sents.length > 0 && <div className="card ls-read" aria-live="off">{sents.map((s, i)=><span key={i} className={i === pos ? "now" : ""} onClick={()=>speakFrom(i)}>{s} </span>)}</div>}
    </div>
  )
}

/* ================= sketchpad ================= */
export function SketchTab(){
  const cv = useRef(null), draw = useRef(null), hist = useRef([])
  const [color, setColor] = useState("#ffffff")
  const [size, setSize] = useState(4)
  const [eraser, setEraser] = useState(false)
  const [grid, setGrid] = useState(true)
  const [saved, setSaved] = useLocalState("ml_sketches", [])
  const [, force] = useState(0)
  useEffect(()=>{
    const c = cv.current; const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = c.parentElement.clientWidth; c.width = w * dpr; c.height = 420 * dpr; c.style.height = "420px"
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round"
    hist.current = [c.toDataURL()]
  },[])
  const pt = e=>{ const r = cv.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const down = e=>{ e.preventDefault(); cv.current.setPointerCapture?.(e.pointerId); const [x, y] = pt(e); draw.current = [x, y]; const c = cv.current.getContext("2d"); c.beginPath(); c.fillStyle = eraser ? "#0e0c22" : color; c.arc(x, y, (eraser ? size * 3 : size) / 2, 0, 7); c.fill() }
  const move = e=>{ if(!draw.current) return; const [x, y] = pt(e), c = cv.current.getContext("2d"); c.globalCompositeOperation = eraser ? "destination-out" : "source-over"; c.strokeStyle = color; c.lineWidth = eraser ? size * 3 : size * (e.pressure && e.pointerType === "pen" ? e.pressure * 2 : 1); c.beginPath(); c.moveTo(...draw.current); c.lineTo(x, y); c.stroke(); draw.current = [x, y]; c.globalCompositeOperation = "source-over" }
  const up = ()=>{ if(!draw.current) return; draw.current = null; hist.current.push(cv.current.toDataURL()); if(hist.current.length > 25) hist.current.shift() }
  const restore = url=>{ const img = new Image(); img.onload = ()=>{ const c = cv.current, ctx = c.getContext("2d"); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0); ctx.restore() }; img.src = url }
  const undo = ()=>{ if(hist.current.length > 1){ hist.current.pop(); restore(hist.current[hist.current.length - 1]) } }
  const clear = ()=>{ const c = cv.current, ctx = c.getContext("2d"); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore(); hist.current.push(c.toDataURL()) }
  const exportUrl = ()=>{ const c = cv.current, o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const x = o.getContext("2d"); x.fillStyle = "#0e0c22"; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0); return o.toDataURL("image/png") }
  const save = ()=>{ const url = exportUrl(); const next = [{ id: Date.now().toString(36), url, at: Date.now() }, ...saved].slice(0, 8); try{ setSaved(next); toast("Sketch saved.", "ok") }catch(e){ toast("Storage is full. Delete an old sketch.", "error") } }
  const dl = ()=>{ const a = document.createElement("a"); a.href = exportUrl(); a.download = "mindlearn-sketch.png"; a.click() }
  const colors = ["#ffffff", "#2de3f0", "#8b6bff", "#f472b6", "#fbbf24", "#34d399", "#f87171"]
  return (
    <div className="sketch">
      <div className="card sk-tools">
        <div className="sk-colors" role="radiogroup" aria-label="Pen colour">{colors.map(c=><button key={c} role="radio" aria-checked={color === c && !eraser} aria-label={"Colour " + c} className={color === c && !eraser ? "on" : ""} style={{ background:c }} onClick={()=>{ setColor(c); setEraser(false) }} />)}</div>
        <label className="sk-size">Size<input type="range" min="2" max="18" value={size} onChange={e=>setSize(+e.target.value)} /></label>
        <button className={"btn btn-sm " + (eraser ? "btn-p" : "btn-ghost")} aria-pressed={eraser} onClick={()=>setEraser(e=>!e)}>🧽 Eraser</button>
        <button className="btn btn-ghost btn-sm" onClick={undo}>↶ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={clear}>🗑 Clear</button>
        <button className={"btn btn-sm " + (grid ? "btn-p" : "btn-ghost")} aria-pressed={grid} onClick={()=>setGrid(g=>!g)}>▦ Grid</button>
      </div>
      <div className={"sk-board" + (grid ? " grid" : "")}><canvas ref={cv} aria-label="Drawing canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} /></div>
      <div className="sk-actions"><button className="btn btn-p" onClick={save}>💾 Save sketch</button><button className="btn btn-ghost" onClick={dl}>⬇ Download PNG</button></div>
      {saved.length > 0 && <div className="card"><b>Saved sketches</b><div className="sk-gallery">{saved.map(s=>(
        <div key={s.id} className="sk-item"><img src={s.url} alt={"Sketch from " + new Date(s.at).toLocaleDateString()} onClick={()=>{ restore(s.url); hist.current.push(s.url); window.scrollTo({ top:0, behavior:"smooth" }) }} /><button aria-label="Delete sketch" onClick={()=>setSaved(saved.filter(x=>x.id !== s.id))}>✕</button></div>))}</div><p className="profile-email">Tap a sketch to edit it.</p></div>}
    </div>
  )
}

/* ================= forgetting curve (home widget) ================= */
export function MemoryCard(){
  const [cards] = useLocalState("ml_srs", [])
  if(!cards.length) return (
    <div className="chart-card"><div className="brief-head"><b>Memory strength</b><span>no deck yet</span></div><p className="profile-email" style={{ margin:0 }}>Build a review deck and we'll chart how fast you forget, and when to revise.</p><button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={()=>go("flashcards")}>Make flashcards</button></div>
  )
  const now = Date.now()
  // estimated retention R = e^(-t/S): S grows with the card's interval (days)
  const stab = c=>Math.max(1.2, (c.interval || 1) * 1.6)
  const since = c=>Math.max(0, (now - (c.due - (c.interval || 1) * DAY)) / DAY)
  const ret = (c, extra)=>Math.exp(-(since(c) + extra) / stab(c))
  const days = 14, pts = Array.from({ length: days + 1 }, (_, d)=>cards.reduce((a, c)=>a + ret(c, d), 0) / cards.length * 100)
  const now100 = Math.round(pts[0]), weak = cards.filter(c=>ret(c, 0) < 0.7).length
  const W = 320, H = 110, P = 8, xy = pts.map((v, i)=>[P + i * (W - 2 * P) / days, H - P - v / 100 * (H - 2 * P)])
  const line = xy.map((p, i)=>(i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")
  const y70 = H - P - .7 * (H - 2 * P)
  return (
    <div className="chart-card">
      <div className="brief-head"><b>Memory strength</b><span className={now100 >= 70 ? "up" : "down"}>≈ {now100}% retained now</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svg" role="img" aria-label={`Estimated memory retention falls from ${now100} percent to ${Math.round(pts[days])} percent over the next ${days} days if you do not review.`}>
        <line x1={P} x2={W - P} y1={y70} y2={y70} className="sc-grid" />
        <path d={line + ` L${xy[days][0]} ${H - P} L${xy[0][0]} ${H - P} Z`} fill="url(#scg)" /><path d={line} className="sc-line" />
      </svg>
      <div className="sc-meta"><span>Today</span><span>if you don't review →</span><span>+{days} days</span></div>
      <p className="profile-email" style={{ margin:"8px 0 0" }}>{weak ? `${weak} card${weak === 1 ? " is" : "s are"} fading below 70%.` : "Your memory looks strong."} <i style={{ opacity:.7 }}>(Estimate)</i></p>
      {weak > 0 && <button className="btn btn-p btn-sm" style={{ marginTop:8 }} onClick={()=>go("swipe")}>Review now</button>}
    </div>
  )
}

/* ================= question of the day ================= */
export function QotdCard(){
  const [q, setQ] = useLocalState("ml_qotd", null)
  const [streak, setStreak] = useLocalState("ml_qotd_streak", { last:"", n:0 })
  const [loading, setLoading] = useState(false)
  const today = dk(Date.now())
  const mine = q && q.day === today ? q : null
  async function fetchQ(){
    setLoading(true)
    try{
      const { data } = await api.post("/quiz", {})
      const qs = data.questions || data.quiz || []
      const pick = qs[Math.floor(Math.random() * qs.length)]
      if(!pick) throw 0
      setQ({ day: today, question: pick.question || pick.q, options: pick.options || pick.choices || [], answer: pick.answer || pick.correct, picked: null })
    }catch(e){ toast("Couldn't load a question. Upload a PDF first, or try again.", "error") }
    finally{ setLoading(false) }
  }
  function pick(opt){
    if(mine.picked) return
    const right = opt === mine.answer
    setQ({ ...mine, picked: opt })
    if(right){ confetti(); sounds.success(); buzz(15) } else sounds.error()
    const y = dk(Date.now() - DAY)
    setStreak(s=>s.last === today ? s : { last: today, n: s.last === y ? s.n + 1 : 1 })
  }
  const live = streak.last === today || streak.last === dk(Date.now() - DAY) ? streak.n : 0
  return (
    <div className="qotd">
      <div className="brief-head"><b>⚡ Question of the day</b><span>{live ? `🔥 ${live}-day streak` : "start a streak"}</span></div>
      {!mine ? <button className="btn btn-p btn-sm" disabled={loading} onClick={fetchQ}>{loading ? "Loading…" : "Get today's question"}</button> : (
        <>
          <p className="qotd-q">{mine.question}</p>
          <div className="qotd-opts">{mine.options.map(o=>(
            <button key={o} className={"qotd-opt" + (mine.picked ? (o === mine.answer ? " correct" : o === mine.picked ? " wrong" : "") : "")} disabled={!!mine.picked} onClick={()=>pick(o)}>{o}</button>))}</div>
          {mine.picked && <p className="profile-email" style={{ margin:"8px 0 0" }}>{mine.picked === mine.answer ? "Correct! See you tomorrow 🎉" : `Not quite. The answer: ${mine.answer}`}</p>}
        </>
      )}
    </div>
  )
}

/* ================= exam mode ================= */
export function useExamMode(){
  const [g] = useLocalState("ml_goals", { daily:5, exam:null })
  const [off, setOff] = useLocalState("ml_exammode_off", "")
  if(!g.exam) return { active:false }
  const end = new Date(g.exam.date + "T00:00:00").getTime(), left = end - Date.now()
  const days = Math.ceil(left / DAY)
  const within = left > -DAY && days <= 7
  return { active: within && off !== g.exam.date, within, exam: g.exam, days, left, off: ()=>setOff(g.exam.date), on: ()=>setOff("") }
}
export function ExamModeCard({ em }){
  const [, t] = useState(0)
  useEffect(()=>{ const i = setInterval(()=>t(n=>n + 1), 1000); return ()=>clearInterval(i) },[])
  const left = Math.max(0, em.left), d = Math.floor(left / DAY), h = Math.floor(left % DAY / 3600000), m = Math.floor(left % 3600000 / 60000), s = Math.floor(left % 60000 / 1000)
  return (
    <div className="exammode">
      <div className="em-tag">🎯 EXAM MODE</div>
      <div className="em-name">{em.exam.name}</div>
      <div className="em-clock" role="timer" aria-label={`${d} days ${h} hours left`}>{[[d, "days"], [h, "hrs"], [m, "min"], [s, "sec"]].map(([n, l])=><div key={l}><b>{String(n).padStart(2, "0")}</b><span>{l}</span></div>)}</div>
      <p className="em-sub">Distractions are hidden. Focus on what moves your score.</p>
      <div className="em-acts"><button className="btn btn-p" onClick={()=>go("exam")}>📝 Mock exam</button><button className="btn btn-ghost" onClick={()=>go("weakspots")}>🎯 Weak spots</button><button className="btn btn-ghost" onClick={()=>go("swipe")}>🗂️ Revise cards</button></div>
      <button className="auth-link em-off" onClick={em.off}>Switch to normal home</button>
    </div>
  )
}
