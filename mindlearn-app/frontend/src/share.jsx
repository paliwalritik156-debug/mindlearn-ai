import { useEffect, useState } from "react"
import { api, toast, useLocalState } from "./lib.jsx"

/* Public page for #/s/<id>: a shared flashcard deck or quiz. No sign-in needed. */
export default function SharedPage({ id }){
  const [d, setD] = useState(null)
  const [err, setErr] = useState("")
  useEffect(()=>{
    setD(null); setErr("")
    api.get("/share/" + id, { silent: true }).then(r=>setD(r.data)).catch(e=>{
      setErr(e?.response?.status === 404 ? "This link doesn't exist or was removed." : e?.response ? "Couldn't open this link. Please try again." : "Can't reach the server right now. If you just opened the link, give it a minute and refresh (the server may be waking up).")
    })
  },[id])
  return (
    <main className="static-page share-page" style={{ maxWidth: 760, margin: "0 auto", padding: "96px 18px 60px" }} data-testid="share-page">
      {err && <div className="card" role="alert">{err}</div>}
      {!err && !d && <div className="card">Loading…</div>}
      {d && (
        <>
          <p className="pyq-note small" style={{ margin: 0 }}>{d.author ? `${d.author} shared` : "Shared"} {d.kind === "quiz" ? "a quiz" : "a flashcard deck"}</p>
          <h1 style={{ fontFamily: "var(--font-display)", margin: "4px 0 16px" }}>{d.title}</h1>
          {d.kind === "quiz" ? <SharedQuiz items={d.items} /> : <SharedDeck items={d.items} />}
          <div className="card share-cta">
            <b>Make your own from any PDF</b>
            <p style={{ margin: "4px 0 10px", color: "var(--text-dim)", fontSize: 14 }}>MindLearn AI turns your notes into flashcards, quizzes, past-paper practice and more. Free to start.</p>
            <a className="btn btn-p" href="#/" onClick={()=>{ try{ window.scrollTo(0, 0) }catch(e){} }}>Try MindLearn AI</a>
          </div>
        </>
      )}
    </main>
  )
}

function SharedDeck({ items }){
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  const [, setDeck] = useLocalState("ml_deck", [])
  const c = items[i]
  const go = n=>{ setI(v=>Math.min(Math.max(v + n, 0), items.length - 1)); setFlip(false) }
  return (
    <div className="card">
      <div className="fc-meta"><span>Card {i + 1} of {items.length}</span></div>
      <div className={"fc" + (flip ? " flipped" : "")} onClick={()=>setFlip(f=>!f)} key={i} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key === " " || e.key === "Enter"){ e.preventDefault(); setFlip(f=>!f) } }}>
        <div className="fc-face fc-front"><small>Question</small>{c.q}</div>
        <div className="fc-face fc-back"><small>Answer</small>{c.a}</div>
      </div>
      <div className="fc-nav">
        <button className="btn btn-ghost btn-sm" onClick={()=>go(-1)} disabled={i === 0} aria-label="Previous">◀</button>
        <button className="btn btn-sm" onClick={()=>setFlip(f=>!f)}>Flip</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>go(1)} disabled={i === items.length - 1} aria-label="Next">▶</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={()=>{ setDeck(items); toast(`Saved ${items.length} cards to your flashcards (Open last deck).`, "success") }}>📦 Save to my flashcards</button>
      </div>
    </div>
  )
}

function SharedQuiz({ items }){
  const [ans, setAns] = useState({})
  const [done, setDone] = useState(false)
  const correct = items.reduce((n, q, i)=>n + (ans[i] === q.answer ? 1 : 0), 0)
  return (
    <div className="card">
      {items.map((q, i)=>(
        <div key={i} className="qcard">
          <div className="q-text"><span className="q-num">{i + 1}</span>{q.question}</div>
          {q.options.map((o, j)=>(
            <label key={j} className={"qopt" + (done ? (o === q.answer ? " correct" : ans[i] === o ? " wrong" : "") : ans[i] === o ? " selected" : "")}>
              <input type="radio" name={"sq" + i} checked={ans[i] === o} disabled={done} onChange={()=>setAns(a=>({ ...a, [i]: o }))} />
              <span className="qopt-key">{String.fromCharCode(65 + j)}</span>{o}
            </label>
          ))}
          {done && q.explanation && <div className="q-why"><b>Why:</b> {q.explanation}</div>}
        </div>
      ))}
      {!done ? (
        <button className="btn btn-p" disabled={Object.keys(ans).length < items.length} onClick={()=>setDone(true)} data-testid="sq-submit">
          {Object.keys(ans).length < items.length ? `Answer all questions (${items.length - Object.keys(ans).length} left)` : "Submit"}
        </button>
      ) : (
        <div className="pyq-sum" data-testid="sq-score"><h4>{correct} of {items.length} correct</h4>
          <button className="btn btn-sm" onClick={()=>{ setAns({}); setDone(false) }}>Try again</button></div>
      )}
    </div>
  )
}
