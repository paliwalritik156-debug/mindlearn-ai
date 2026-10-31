import { useEffect, useMemo, useState } from "react"
import { api, toast, Spin, useLocalState, recordAnswers, getOutLang } from "./lib.jsx"

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

export default function PyqTab(){
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
  function judge(qq, pick, correct){
    const ok = sameOpt(pick, correct)
    recordAnswers([{ topic: qq.topic, ok, q: qq.question }])
    return ok
  }
  function choose(opt){
    if(!q || ans?.pick) return
    if(q.answer){
      const ok = judge(q, opt, q.answer)
      patch(s=>{ s.answers[q.id] = { pick: opt, ok, recorded: true }; return s })
    }else{
      patch(s=>{ s.answers[q.id] = { pick: opt, ok: null, recorded: false }; return s })
    }
  }
  async function solve(){
    if(!q) return
    setSolving(true)
    try{
      const { data } = await api.post("/pyq/solve", { question: q.question, options: q.options, user_answer: ans?.pick || "", official_answer: q.answer || "", exam: set.exam || exam, language: LANG_NAME[getOutLang()] || "English" })
      patch(s=>{
        s.solutions[q.id] = data
        const a = s.answers[q.id]
        if(a?.pick && !a.recorded){ const ok = judge(q, a.pick, data.correct_option); s.answers[q.id] = { ...a, ok, recorded: true } }
        return s
      })
    }catch(e){ toast(e?.response?.data?.detail || "Couldn't solve this one. Try again.", "error") }
    finally{ setSolving(false) }
  }

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
