import { useEffect, useMemo, useRef, useState } from "react"
import { api, toast, Spin, useLocalState, recordAnswers, getOutLang, askText } from "./lib.jsx"
import { whyWrongPrompt } from "./v46lib.js"
import { SCHEMES, defaultMinutes, fmtClock, scorable, scoreMock, topicBreakdown } from "./mock.js"
import { queueMistakes } from "./revenge.js"
import { CAUSES, causeLabel, pushLog, setLogCause, addToQueue, dueItems, waitingItems, gradeItem, setItemField, daysUntil, mistakeDna, BOX_DAYS } from "./mistakes.js"

/* PYQ / past-paper mode: upload a real question paper (PDF), the app pulls out the actual
   multiple-choice questions, you attempt them, and every answer feeds the Weak-Spot Radar. */

const EXAMS = [["neet", "NEET"], ["jee", "JEE"], ["upsc", "UPSC prelims"], ["cuet", "CUET"], ["board", "Board exam"], ["general", "Other"]]
const LANG_NAME = { en: "English", hi: "Hindi", hinglish: "Hinglish" }
const letterOf = s=>{ const t = String(s || "").trim(); const m = /^\(?([A-Ea-e1-5])[).:\s-]/.exec(t); return m ? m[1].toUpperCase() : (t.length <= 2 ? t.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "") }
export const sameOpt = (a, b)=>{
  const x = String(a || "").trim().toLowerCase(), y = String(b || "").trim().toLowerCase()
  if(!x || !y) return false
  if(x === y) return true
  const la = letterOf(a), lb = letterOf(b)
  return !!la && la === lb && (String(a).trim().length <= 3 || String(b).trim().length <= 3)
}

async function waitJob(jid, onProg){
  let fails = 0
  for(let i = 0; i < 600; i++){
    await new Promise(r=>setTimeout(r, i < 4 ? 800 : 1500))
    let st
    try{ st = (await api.get("/jobs/" + jid, { silent: true })).data; fails = 0 }
    catch(e){
      if(e?.response?.status === 404) throw new Error("This was interrupted (the server restarted). Please try again.")
      if(e?.response?.status === 401) throw e
      if(++fails > 8) throw new Error("Lost connection to the server. Please try again.")
      continue
    }
    onProg && onProg(st.pct, st.msg)
    if(st.done){ if(st.error) throw new Error(st.error); return st.result }
  }
  throw new Error("This is taking too long. Please try again.")
}


const outLang = ()=>LANG_NAME[getOutLang()] || "English"
const isHi = ()=>getOutLang() !== "en"

/* One question card used by the Revenge Queue and by twin questions. It reports the verdict once. */
function MiniQ({ q, exam, idKey, onVerdict }){
  const [pick, setPick] = useState(null)
  const [res, setRes] = useState(null)
  const [sol, setSol] = useState(null)
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState("")
  const [whyBusy, setWhyBusy] = useState(false)
  const t0 = useRef(Date.now())
  const askWhy = async ()=>{ setWhyBusy(true); try{ setWhy(await askText(whyWrongPrompt(q.question, pick, res?.correct || q.answer, getOutLang() !== "en"))) }catch(e){ toast("Explain nahi ho paya, dobara try karo.") } setWhyBusy(false) }
  useEffect(()=>{ setWhy(""); setPick(null); setRes(null); setSol(null); t0.current = Date.now() }, [idKey])
  function finish(o, correct){
    const ok = sameOpt(o, correct)
    setRes({ ok, correct })
    onVerdict && onVerdict(ok, correct, Math.min(600, Math.round((Date.now() - t0.current) / 1000)))
  }
  function choose(o){ if(res) return; setPick(o); if(q.answer) finish(o, q.answer) }
  async function loadSol(){
    if(sol) return sol
    setBusy(true)
    try{
      const { data } = await api.post("/pyq/solve", { question: q.question, options: q.options, user_answer: pick || "", official_answer: q.answer || "", exam: exam || "exam", language: outLang() })
      setSol(data); return data
    }catch(e){ toast(e?.response?.data?.detail || "Couldn't solve this one. Try again.", "error"); return null }
    finally{ setBusy(false) }
  }
  async function check(){ const d = await loadSol(); if(d && pick && !res) finish(pick, d.correct_option) }
  const correct = res?.correct
  return (
    <div className="pyq-q" data-testid="miniq">
      <div className="pyq-meta">{q.topic}{q.twin ? " · 🧬 twin question" : ""}</div>
      <div className="pyq-text">{q.question}</div>
      <div className="pyq-opts">
        {q.options.map(o=>(
          <button key={o} className={"pyq-o" + (pick === o ? " picked" : "") + (res && sameOpt(o, correct) ? " right" : "") + (res && pick === o && !sameOpt(o, correct) ? " wrong" : "")} disabled={!!res} onClick={()=>choose(o)}>{o}</button>
        ))}
      </div>
      {res && <div className={"pyq-res " + (res.ok ? "ok" : "bad")}>{res.ok ? "✅ Correct" : "❌ Not quite"}</div>}
      <div className="pyq-acts">
        {!res && pick && !q.answer && <button className="btn btn-p" disabled={busy} onClick={check} data-testid="miniq-check">{busy ? <Spin /> : "Check my answer"}</button>}
        {res && !res.ok && pick && !why && <button className="btn" disabled={whyBusy} onClick={askWhy} data-testid="why-wrong">{whyBusy ? <Spin /> : "🧠 Mujhse galti kyun hui?"}</button>}
        {res && !q.explanation && !sol && <button className="btn" disabled={busy} onClick={loadSol}>{busy ? <Spin /> : "💡 Show solution"}</button>}
      </div>
      {why && <div className="pyq-sol" data-testid="why-text"><p>🧠 {why}</p></div>}
      {(q.explanation || sol) && res && (
        <div className="pyq-sol">
          {sol ? <><ol>{sol.steps.map((x, i)=><li key={i}>{x}</li>)}</ol>{sol.concept && <p><b>Concept:</b> {sol.concept}</p>}</> : <p>{q.explanation}</p>}
        </div>
      )}
    </div>
  )
}

function TwinBox({ base, exam, onResult }){
  const [tw, setTw] = useState(null)
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(0)
  async function make(){
    setBusy(true)
    try{
      const { data } = await api.post("/pyq/twin", { question: base.question, options: base.options, correct_option: base.answer || "", topic: base.topic, exam: exam || "exam", language: outLang() })
      setTw(data); setN(v=>v + 1)
    }catch(e){ toast(e?.response?.data?.detail || "Couldn't make a twin question. Try again.", "error") }
    finally{ setBusy(false) }
  }
  if(!tw) return <div className="pyq-acts"><button className="btn" disabled={busy} onClick={make} data-testid="twin-make">{busy ? <Spin /> : "🧬 Try a twin question"}</button><span className="pyq-note small" style={{ alignSelf: "center" }}>Same concept, new numbers. Tests whether you really got it.</span></div>
  return (
    <div className="pyq-twin">
      <MiniQ q={tw} exam={exam} idKey={"tw" + n} onVerdict={ok=>{ recordAnswers([{ topic: tw.topic, ok, q: tw.question }]); onResult && onResult(ok) }} />
      <div className="pyq-acts"><button className="btn btn-ghost btn-sm" disabled={busy} onClick={make}>{busy ? <Spin /> : "Another twin"}</button><button className="btn btn-ghost btn-sm" onClick={()=>setTw(null)}>Close</button></div>
    </div>
  )
}

function CauseChips({ onPick, onSkip }){
  return (
    <div className="pyq-cause" data-testid="cause-chips">
      <div className="pyq-note" style={{ margin: "0 0 6px" }}><b>Why did you miss it?</b> (builds your Mistake DNA)</div>
      <div className="fb-kinds">
        {CAUSES.map(c=><button key={c.key} className="chip" onClick={()=>onPick(c.key)} data-testid={"cause-" + c.key}>{c.icon} {isHi() ? c.hi : c.en}</button>)}
        <button className="chip" onClick={onSkip}>Skip</button>
      </div>
    </div>
  )
}

function DnaView({ log, goto }){
  const d = useMemo(()=>mistakeDna(log, isHi() ? "hi" : "en"), [log])
  const hi = isHi()
  if(!d.n) return <div className="pyq-empty">Your Mistake DNA appears here after you answer some PYQ questions. Each wrong answer asks <i>why</i> you missed it, and that is what makes this useful.<div style={{ marginTop: 10 }}><button className="btn btn-p" onClick={()=>goto("practice")}>Start a paper</button></div></div>
  return (
    <div data-testid="dna">
      <div className="ad-grid" style={{ marginTop: 0 }}>
        <div className="ad-stat"><div className="ad-n">{d.n}</div><div className="ad-l">Answered</div></div>
        <div className="ad-stat"><div className="ad-n">{d.accuracy}%</div><div className="ad-l">Accuracy</div></div>
        <div className="ad-stat"><div className="ad-n">{d.avgRight || "–"}{d.avgRight ? "s" : ""}</div><div className="ad-l">Avg time, right</div></div>
        <div className="ad-stat"><div className="ad-n" style={d.avgWrong && d.avgRight && d.avgWrong < d.avgRight * 0.6 ? { color: "#f59e0b" } : null}>{d.avgWrong || "–"}{d.avgWrong ? "s" : ""}</div><div className="ad-l">Avg time, wrong</div></div>
      </div>
      <h4 style={{ margin: "16px 0 6px" }}>Why you miss questions</h4>
      {d.tagged === 0 ? <p className="pyq-note">Tag the reason after a wrong answer to see this chart.</p> : d.byCause.map(c=>(
        <div className="dna-row" key={c.key}><span className="dna-l">{c.icon} {causeLabel(c.key, hi ? "hi" : "en")}</span><div className="dna-bar"><i style={{ width: Math.round(c.pct * 100) + "%" }} /></div><span className="dna-n">{c.count}</span></div>
      ))}
      {d.topTopics.length > 0 && (<><h4 style={{ margin: "16px 0 6px" }}>Where you leak marks</h4>
        {d.topTopics.map(t=><div className="dna-top" key={t.topic}><b>{t.topic}</b> <span>{t.wrong} of {t.total} wrong{t.cause ? " · mostly " + causeLabel(t.cause, "en").toLowerCase() : ""}</span></div>)}</>)}
      <h4 style={{ margin: "16px 0 6px" }}>What to do about it</h4>
      {d.enough ? (d.advice.length ? <ul className="dna-adv">{d.advice.map((a, i)=><li key={i}>{a}</li>)}</ul> : <p className="pyq-note">Your misses have mixed reasons, so no single pattern yet. Keep tagging.</p>)
        : <p className="pyq-note">Answer at least 5 questions with 2 or more mistakes and the advice appears here ({d.n} answered, {d.wrong} wrong so far).</p>}
      <div className="pyq-acts"><button className="btn btn-p" onClick={()=>goto("revenge")}>⚔ Open Revenge Queue</button><button className="btn" onClick={()=>goto("practice")}>Practise more</button></div>
    </div>
  )
}

function RevengeView({ queue, setQueue, goto, exam }){
  const [active, setActive] = useState(null)
  const [now] = useState(()=>Date.now())
  const due = dueItems(queue, now), waiting = waitingItems(queue, now), mastered = queue.filter(x=>x.mastered).length
  const item = (active && queue.find(x=>x.id === active)) || due[0]
  const [graded, setGraded] = useState(null)
  useEffect(()=>{ setGraded(null) }, [item?.id])
  if(!queue.length) return <div className="pyq-empty">Nothing here yet. Every PYQ question you get wrong lands in your Revenge Queue and comes back after 1, 3, 7, 14 and 30 days, until you beat it.<div style={{ marginTop: 10 }}><button className="btn btn-p" onClick={()=>goto("practice")}>Start a paper</button></div></div>
  const cur = item && queue.find(x=>x.id === item.id)
  return (
    <div data-testid="revenge">
      <p className="pyq-note" style={{ marginTop: 0 }}><b>{due.length}</b> due now · {waiting.length} waiting · {mastered} mastered 🏆</p>
      {!item ? (
        <div className="pyq-empty">All caught up. 🎉 {waiting[0] ? `Next review in ${daysUntil(waiting[0].due, now)} day(s).` : ""}<div style={{ marginTop: 10 }}><button className="btn" onClick={()=>goto("practice")}>Practise a paper</button></div></div>
      ) : (
        <>
          <MiniQ key={item.id} q={item} exam={item.exam || exam} idKey={item.id} onVerdict={(ok, correct)=>{
            setActive(item.id)
            setQueue(q=>setItemField(gradeItem(q, item.id, ok), item.id, correct && !item.answer ? { answer: correct } : {}))
            setGraded(ok)
          }} />
          {graded !== null && cur && (
            <div className={"pyq-res " + (graded ? "ok" : "bad")} data-testid="revenge-outcome">
              {cur.mastered ? "🏆 Beaten for good. This question is mastered." : graded ? `Moved up. You'll see it again in ${daysUntil(cur.due)} day(s) (step ${cur.box + 1} of ${BOX_DAYS.length}).` : "Back to step 1. You'll see it again tomorrow."}
            </div>
          )}
          {graded !== null && <TwinBox base={item} exam={item.exam || exam} onResult={ok=>{ if(ok) setQueue(q=>setItemField(q, item.id, { twinWins: (q.find(x=>x.id === item.id)?.twinWins || 0) + 1 })) }} />}
          {graded !== null && <div className="pyq-acts"><button className="btn btn-p" onClick={()=>{ setActive(null); setGraded(null) }} data-testid="revenge-next">Next →</button></div>}
          {item.twinWins > 0 && <p className="pyq-note small">🧬 Twin questions solved: {item.twinWins}</p>}
        </>
      )}
    </div>
  )
}

function Practice({ log, setLog, queue, setQueue }){
  const [set, setSet] = useLocalState("ml_pyq", null)
  const [docs, setDocs] = useState([])
  const [docId, setDocId] = useState("")
  const [exam, setExam] = useState(()=>{ try{ const g = JSON.parse(localStorage.getItem("ml_profile") || "null")?.goal; return ["neet", "jee", "upsc"].includes(g) ? g : "neet" }catch(e){ return "neet" } })
  const [from, setFrom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState({ pct: 0, msg: "" })
  const [err, setErr] = useState("")
  const [cur, setCur] = useState(0)
  const [solving, setSolving] = useState(false)
  const shownAt = useRef(Date.now())
  useEffect(()=>{ shownAt.current = Date.now() }, [cur, set?.at])

  useEffect(()=>{
    api.get("/library", { silent: true }).then(r=>{
      const d = r.data?.docs || []; setDocs(d)
      const act = d.find(x=>x.active) || d[0]; if(act) setDocId(x=>x || act.id)
    }).catch(()=>{})
  },[])

  async function extract(append){
    setBusy(true); setErr(""); setProg({ pct: 1, msg: "Starting" })
    const pf = append && set ? set.page_to + 1 : Math.max(1, +from || 1)
    try{
      const { data } = await api.post("/pyq/extract", { doc_id: (append && set ? set.doc_id : docId) || null, page_from: pf, exam })
      const res = await waitJob(data.job_id, (pct, msg)=>setProg({ pct, msg }))
      if(append && set){
        const have = new Set(set.questions.map(q=>q.question.toLowerCase()))
        const fresh = res.questions.filter(q=>!have.has(q.question.toLowerCase()))
        setSet({ ...set, page_to: res.page_to, total_pages: res.total_pages, questions: [...set.questions, ...fresh] })
        setCur(set.questions.length)
      }else{
        setSet({ ...res, exam, answers: {}, solutions: {}, at: Date.now() }); setCur(0)
      }
    }catch(e){
      setErr(e?.response?.data?.detail || e?.message || "Couldn't read questions from this paper.")
    }finally{ setBusy(false) }
  }

  const qs = set?.questions || []
  const q = qs[cur]
  const ans = (q && set.answers?.[q.id]) || null
  const sol = (q && set.solutions?.[q.id]) || null

  function patch(fn){ setSet(s=>fn({ ...s, answers: { ...s.answers }, solutions: { ...s.solutions } })) }
  // one place that records a verdict: weak-spot radar, mistake log and (if wrong) the revenge queue
  function verdict(qq, pick, correct, secs){
    const ok = sameOpt(pick, correct)
    const at = Date.now()
    recordAnswers([{ topic: qq.topic, ok, q: qq.question }])
    setLog(l=>pushLog(l, { id: qq.id, topic: qq.topic, ok, secs, at }))
    if(!ok) setQueue(qd=>addToQueue(qd, { id: qq.id, question: qq.question, options: qq.options, answer: correct || null, topic: qq.topic, exam: set?.exam || exam, source: set?.name || "" }))
    return ok
  }
  function choose(opt){
    if(!q || ans?.pick) return
    const secs = Math.min(600, Math.round((Date.now() - shownAt.current) / 1000))
    if(q.answer){
      const ok = verdict(q, opt, q.answer, secs)
      patch(s=>{ s.answers[q.id] = { pick: opt, ok, recorded: true, secs }; return s })
    }else{
      patch(s=>{ s.answers[q.id] = { pick: opt, ok: null, recorded: false, secs }; return s })
    }
  }
  async function solve(){
    if(!q) return
    setSolving(true)
    try{
      const { data } = await api.post("/pyq/solve", { question: q.question, options: q.options, user_answer: ans?.pick || "", official_answer: q.answer || "", exam: set.exam || exam, language: outLang() })
      const a = set.answers?.[q.id]
      const ok = a?.pick && !a.recorded ? verdict(q, a.pick, data.correct_option, a.secs || 0) : null
      patch(s=>{
        s.solutions[q.id] = data
        if(ok !== null) s.answers[q.id] = { ...a, ok, recorded: true }
        return s
      })
    }catch(e){ toast(e?.response?.data?.detail || "Couldn't solve this one. Try again.", "error") }
    finally{ setSolving(false) }
  }
  function tagCause(cause){
    if(!q) return
    setLog(l=>setLogCause(l, q.id, cause))
    setQueue(qd=>setItemField(qd, q.id, { cause }))
    patch(s=>{ s.answers[q.id] = { ...s.answers[q.id], cause }; return s })
  }
  function skipCause(){ patch(s=>{ s.answers[q.id] = { ...s.answers[q.id], cause: "skipped" }; return s }) }

  const stats = useMemo(()=>{
    const done = qs.filter(x=>set?.answers?.[x.id]?.recorded)
    const right = done.filter(x=>set.answers[x.id].ok).length
    const topics = {}
    done.forEach(x=>{ const t = topics[x.topic] = topics[x.topic] || { n: 0, r: 0 }; t.n++; if(set.answers[x.id].ok) t.r++ })
    const weak = Object.entries(topics).filter(([, v])=>v.r / v.n < 0.6).map(([k, v])=>[k, v.r, v.n])
    return { done: done.length, right, weak, picked: qs.filter(x=>set?.answers?.[x.id]?.pick).length }
  }, [set])

  /* ---------- setup screen ---------- */
  if(!set) return (
    <div className="card pyq">
      <h4 style={{ marginTop: 0 }}>📜 Practise with a real past paper</h4>
      <p className="pyq-note">Upload a question paper PDF first (from the home screen or <b>My Library</b>). MindLearn pulls out the real multiple-choice questions, you attempt them, and you get step-by-step solutions. Wrong answers feed your Weak-Spot Radar.</p>
      {docs.length === 0 ? (
        <div className="pyq-empty">No document yet. Upload a past-paper PDF from the Library, then come back here.
          <div style={{ marginTop: 10 }}><button className="btn btn-p" onClick={()=>window.dispatchEvent(new CustomEvent("ml-goto", { detail: "library" }))}>Open Library</button></div></div>
      ) : (
        <div className="pyq-form">
          <label>Paper<select className="sel" value={docId} onChange={e=>setDocId(e.target.value)}>{docs.map(d=><option key={d.id} value={d.id}>{d.name} · {d.pages} pages</option>)}</select></label>
          <label>Exam<select className="sel" value={exam} onChange={e=>setExam(e.target.value)}>{EXAMS.map(([k, l])=><option key={k} value={k}>{l}</option>)}</select></label>
          <label>Start at page<input className="inp" type="number" min="1" value={from} onChange={e=>setFrom(e.target.value)} /></label>
          <button className="btn btn-p" disabled={busy || !docId} onClick={()=>extract(false)}>{busy ? <Spin /> : "Find questions"}</button>
        </div>
      )}
      {busy && <div className="pyq-prog" role="progressbar" aria-valuenow={prog.pct}><div><i style={{ width: prog.pct + "%" }} /></div><span>{prog.msg} {prog.pct}%</span></div>}
      {err && <div className="pyq-err" role="alert">{err}</div>}
      <p className="pyq-note small">Reads 12 pages at a time (so it stays fast). Only multiple-choice questions are picked up. If the paper has no printed answer key, solutions are written by AI, so double-check important ones.</p>
    </div>
  )

  /* ---------- practice screen ---------- */
  const finished = stats.picked === qs.length && qs.length > 0
  const status = x=>{ const a = set.answers?.[x.id]; return !a?.pick ? "" : a.ok === true ? "ok" : a.ok === false ? "bad" : "pick" }
  return (
    <div className="card pyq">
      <div className="pyq-head">
        <div><b>{set.name}</b><div className="pyq-note small">Pages {set.page_from}–{set.page_to} of {set.total_pages} · {qs.length} questions · {stats.right}/{stats.done} correct</div></div>
        <button className="btn btn-ghost btn-sm" onClick={()=>{ if(confirm("Start a new paper? This one will be cleared.")){ setSet(null); setErr("") } }}>New paper</button>
      </div>
      <div className="pyq-nav" role="tablist" aria-label="Questions">
        {qs.map((x, i)=><button key={x.id} role="tab" aria-selected={i === cur} className={"pyq-n " + status(x) + (i === cur ? " cur" : "")} onClick={()=>setCur(i)}>{i + 1}</button>)}
      </div>
      {q && (
        <div className="pyq-q" data-testid="pyq-q">
          <div className="pyq-meta">Q{cur + 1}{q.number ? ` (paper no. ${q.number})` : ""} · {q.topic}{q.page ? ` · p.${q.page}` : ""}{q.answer ? "" : " · no printed key"}</div>
          <div className="pyq-text">{q.question}</div>
          <div className="pyq-opts">
            {q.options.map(o=>{
              const picked = ans?.pick === o
              const right = (q.answer && sameOpt(o, q.answer)) || (sol && sameOpt(o, sol.correct_option))
              const show = ans?.recorded || sol
              return <button key={o} className={"pyq-o" + (picked ? " picked" : "") + (show && right ? " right" : "") + (show && picked && !right ? " wrong" : "")} disabled={!!ans?.pick && !!q.answer} onClick={()=>choose(o)}>{o}</button>
            })}
          </div>
          {ans?.recorded && <div className={"pyq-res " + (ans.ok ? "ok" : "bad")}>{ans.ok ? "✅ Correct" : "❌ Not quite"}</div>}
          {ans?.recorded && ans.ok === false && !ans.cause && <CauseChips onPick={tagCause} onSkip={skipCause} />}
          {ans?.cause && ans.cause !== "skipped" && <div className="pyq-note small">Tagged: {CAUSES.find(c=>c.key === ans.cause)?.icon} {causeLabel(ans.cause, isHi() ? "hi" : "en")}</div>}
          {ans?.pick && !ans.recorded && !sol && <div className="pyq-res">Answer saved. Tap “Show solution” to check it.</div>}
          <div className="pyq-acts">
            <button className="btn btn-p" disabled={solving} onClick={solve} data-testid="pyq-solve">{solving ? <Spin /> : sol ? "Solution ↓" : "💡 Show solution"}</button>
            <button className="btn" disabled={cur === 0} onClick={()=>setCur(cur - 1)}>← Prev</button>
            <button className="btn" disabled={cur >= qs.length - 1} onClick={()=>setCur(cur + 1)}>Next →</button>
          </div>
          {sol && (
            <div className="pyq-sol" data-testid="pyq-sol">
              <div className="pyq-ans">Answer: <b>{sol.correct_option}</b> <span className={"pyq-conf " + sol.confidence}>{q.answer ? "from the paper" : `AI confidence: ${sol.confidence || "?"}`}</span></div>
              <ol>{sol.steps.map((s, i)=><li key={i}>{s}</li>)}</ol>
              {sol.concept && <p><b>Concept:</b> {sol.concept}</p>}
              {sol.shortcut && <p><b>Shortcut:</b> {sol.shortcut}</p>}
              {sol.why_wrong && ans?.ok === false && <p><b>Why your answer is wrong:</b> {sol.why_wrong}</p>}
              {!q.answer && <p className="pyq-note small">This solution is written by AI. Verify it against the official key when you can.</p>}
            </div>
          )}
        </div>
      )}
      {finished && (
        <div className="pyq-sum" data-testid="pyq-sum">
          <h4>All attempted 🎉</h4>
          <p>{stats.done ? `${stats.right} of ${stats.done} checked answers correct.` : "Tap “Show solution” on the questions to check them."}</p>
          {stats.weak.length > 0 && <p><b>Revise:</b> {stats.weak.map(([t, r, n])=>`${t} (${r}/${n})`).join(", ")}</p>}
        </div>
      )}
      <div className="pyq-acts" style={{ marginTop: 14 }}>
        {set.page_to < set.total_pages && <button className="btn" disabled={busy} onClick={()=>extract(true)}>{busy ? <Spin /> : `Read next pages (${set.page_to + 1}–${Math.min(set.total_pages, set.page_to + 12)})`}</button>}
        <button className="btn btn-ghost" onClick={()=>window.dispatchEvent(new CustomEvent("ml-goto", { detail: "weakspots" }))}>🎯 Weak-Spot Radar</button>
      </div>
      {busy && <div className="pyq-prog"><div><i style={{ width: prog.pct + "%" }} /></div><span>{prog.msg} {prog.pct}%</span></div>}
      {err && <div className="pyq-err" role="alert">{err}</div>}
    </div>
  )
}

/* ===== Timed mock: exam conditions, no feedback until you submit ===== */
function MockView({ goto }){
  const [set] = useLocalState("ml_pyq", null)
  const [hist, setHist] = useLocalState("ml_pyq_mocks", [])
  const qs = useMemo(()=>scorable(set?.questions), [set])
  const [phase, setPhase] = useState("setup")        // setup | run | result
  const [scheme, setScheme] = useState(SCHEMES[0])
  const [mins, setMins] = useState(0)
  const [picks, setPicks] = useState({})
  const [flags, setFlags] = useState({})
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(0)
  const [res, setRes] = useState(null)
  const endAt = useRef(0), startAt = useRef(0), done = useRef(false)
  const minutes = mins || defaultMinutes(qs.length)

  function begin(){
    setPicks({}); setFlags({}); setI(0); setRes(null); done.current = false
    startAt.current = Date.now(); endAt.current = Date.now() + minutes * 60000; setLeft(minutes * 60); setPhase("run")
  }
  function submit(auto){
    if(done.current) return; done.current = true
    const r = scoreMock(qs, picks, scheme, sameOpt)
    const used = Math.min(minutes * 60, Math.round((Date.now() - startAt.current) / 1000))
    recordAnswers(r.rows.filter(x=>x.pick).map(x=>({ topic: x.q.topic, ok: x.status === "right", q: x.q.question })))
    const added = queueMistakes(r.rows.filter(x=>x.status === "wrong").map(x=>x.q), "Timed mock")
    setHist(h=>[...h, { at: Date.now(), name: set?.name || "", score: r.score, max: r.max, pct: r.pct }].slice(-10))
    setRes({ ...r, used, added, auto: !!auto }); setPhase("result")
  }
  useEffect(()=>{
    if(phase !== "run") return
    const id = setInterval(()=>{
      const s = Math.round((endAt.current - Date.now()) / 1000)
      setLeft(s)
      if(s <= 0) submit(true)
    }, 500)
    return ()=>clearInterval(id)
  }, [phase, picks])

  if(!set || qs.length < 3) return (
    <div className="card pyq"><div className="pyq-empty">A timed mock needs a paper with at least 3 questions that have a printed answer key. Open <b>Practice</b>, load a paper first, then come back.
      <div style={{ marginTop: 10 }}><button className="btn btn-p" onClick={()=>goto("practice")}>Go to Practice</button></div></div>
      {set && qs.length < 3 && <p className="pyq-note small">This paper has {set.questions?.length || 0} questions but only {qs.length} with a printed answer key, so a mock can't be scored fairly.</p>}
    </div>
  )

  if(phase === "setup") return (
    <div className="card pyq" data-testid="mock-setup">
      <h4 style={{ marginTop: 0 }}>⏱ Timed mock</h4>
      <p className="pyq-note">Exam conditions: the clock runs, you get no hints, and results appear only when you submit or time runs out. Wrong answers then go to your Revenge Queue.</p>
      <p><b>{set.name}</b> · {qs.length} scorable questions{set.questions.length > qs.length ? ` (${set.questions.length - qs.length} skipped: no printed answer key)` : ""}</p>
      <div className="iv-row"><div>Marking: {SCHEMES.map(x=><button key={x.key} className={"chip" + (scheme.key === x.key ? " on" : "")} onClick={()=>setScheme(x)}>{x.label}</button>)}</div></div>
      <div className="iv-row"><div>Time: {[defaultMinutes(qs.length), 30, 60, 90, 180].filter((v, k, a)=>a.indexOf(v) === k).map(m=><button key={m} className={"chip" + (minutes === m ? " on" : "")} onClick={()=>setMins(m)}>{m} min</button>)}</div></div>
      <div className="pyq-acts"><button className="btn btn-p" onClick={begin} data-testid="mock-start">Start mock · {minutes} min</button></div>
      {hist.length > 0 && <p className="pyq-note small">Previous mocks: {hist.slice(-5).map((h, k)=><span key={k} className="chip">{h.pct}%</span>)}</p>}
    </div>
  )

  if(phase === "run"){
    const q = qs[i]
    const low = left < 300
    return (
      <div className="card pyq" data-testid="mock-run">
        <div className="pyq-head">
          <div><b>Q{i + 1} of {qs.length}</b> <span className="pyq-note small">· {q.topic}</span></div>
          <div className={"mock-clock" + (low ? " low" : "")} data-testid="mock-clock">⏱ {fmtClock(left)}</div>
        </div>
        <div className="pyq-nav">
          {qs.map((x, k)=><button key={x.id} className={"pyq-n" + (picks[x.id] ? " pick" : "") + (flags[x.id] ? " flag" : "") + (k === i ? " cur" : "")} onClick={()=>setI(k)}>{k + 1}</button>)}
        </div>
        <div className="pyq-q">
          <div className="pyq-text">{q.question}</div>
          <div className="pyq-opts">
            {q.options.map(o=><button key={o} className={"pyq-o" + (picks[q.id] === o ? " picked" : "")} onClick={()=>setPicks(p=>({ ...p, [q.id]: o }))}>{o}</button>)}
          </div>
          <div className="pyq-acts">
            <button className="btn" disabled={i === 0} onClick={()=>setI(i - 1)}>← Prev</button>
            <button className="btn" disabled={i >= qs.length - 1} onClick={()=>setI(i + 1)}>Next →</button>
            <button className="btn btn-ghost" onClick={()=>setPicks(p=>{ const n = { ...p }; delete n[q.id]; return n })}>Clear</button>
            <button className={"btn btn-ghost" + (flags[q.id] ? " on" : "")} onClick={()=>setFlags(f=>({ ...f, [q.id]: !f[q.id] }))}>{flags[q.id] ? "⚑ Flagged" : "⚐ Flag for review"}</button>
          </div>
        </div>
        <div className="pyq-acts" style={{ marginTop: 14 }}>
          <span className="pyq-note small">{Object.keys(picks).length} answered · {Object.keys(flags).filter(k=>flags[k]).length} flagged</span>
          <button className="btn btn-p" onClick={()=>{ const un = qs.length - Object.keys(picks).length; if(!un || confirm(`${un} question(s) unanswered. Submit anyway?`)) submit(false) }} data-testid="mock-submit">Submit mock</button>
        </div>
      </div>
    )
  }

  const topics = topicBreakdown(res.rows)
  return (
    <div className="card pyq" data-testid="mock-result">
      <h4 style={{ marginTop: 0 }}>{res.auto ? "⏰ Time's up" : "Mock submitted"}</h4>
      <div className="ad-grid" style={{ marginTop: 0 }}>
        <div className="ad-stat"><div className="ad-n">{res.score}<small style={{ opacity: .5 }}> / {res.max}</small></div><div className="ad-l">Score ({res.pct}%)</div></div>
        <div className="ad-stat"><div className="ad-n">{res.right}</div><div className="ad-l">Correct</div></div>
        <div className="ad-stat"><div className="ad-n">{res.wrong}</div><div className="ad-l">Wrong</div></div>
        <div className="ad-stat"><div className="ad-n">{res.skipped}</div><div className="ad-l">Skipped</div></div>
      </div>
      <p className="pyq-note">Time used: {fmtClock(res.used)} of {minutes} min.{res.added ? ` ${res.added} wrong answer${res.added > 1 ? "s were" : " was"} added to your Revenge Queue ⚔` : ""}</p>
      <h4>By topic (weakest first)</h4>
      {topics.map(t=><div className="dna-row" key={t.topic}><span className="dna-l">{t.topic}</span><div className="dna-bar"><i style={{ width: t.pct + "%" }} /></div><span className="dna-n">{t.right}/{t.n}</span></div>)}
      <h4>Review</h4>
      {res.rows.map((x, k)=>(
        <details key={x.q.id} className="iv-q"><summary><b>{k + 1}.</b> {x.q.question.slice(0, 90)}{x.q.question.length > 90 ? "…" : ""} <span className={"chip mock-" + x.status}>{x.status}</span></summary>
          <p>Your answer: <b>{x.pick || "none"}</b></p><p>Correct answer: <b>{x.q.answer}</b></p>
        </details>
      ))}
      <div className="pyq-acts"><button className="btn btn-p" onClick={()=>setPhase("setup")}>Another mock</button><button className="btn" onClick={()=>goto("revenge")}>⚔ Revenge Queue</button><button className="btn btn-ghost" onClick={()=>goto("dna")}>🧬 Mistake DNA</button></div>
    </div>
  )
}

export default function PyqTab(){
  const [view, setView] = useState("practice")
  const [log, setLog] = useLocalState("ml_mistakes", [])
  const [queue, setQueue] = useLocalState("ml_revenge", [])
  const [exam] = useState("general")
  const dueN = dueItems(queue).length
  const tabs = [["practice", "📜 Practice"], ["mock", "⏱ Timed mock"], ["dna", "🧬 Mistake DNA"], ["revenge", `⚔ Revenge Queue${dueN ? ` (${dueN} due)` : ""}`]]
  return (
    <div>
      <div className="pyq-tabs" role="tablist">
        {tabs.map(([k, l])=><button key={k} role="tab" aria-selected={view === k} className={"chip" + (view === k ? " on" : "")} onClick={()=>setView(k)} data-testid={"tab-" + k}>{l}</button>)}
      </div>
      {view === "practice" && <Practice log={log} setLog={setLog} queue={queue} setQueue={setQueue} />}
      {view === "mock" && <MockView goto={setView} />}
      {view === "dna" && <div className="card pyq"><DnaView log={log} goto={setView} /></div>}
      {view === "revenge" && <div className="card pyq"><RevengeView queue={queue} setQueue={setQueue} goto={setView} exam={exam} /></div>}
    </div>
  )
}
