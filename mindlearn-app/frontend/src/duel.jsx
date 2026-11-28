import { useEffect, useRef, useState } from "react"
import { askText, parseJSONLoose, toast, Spin, useLocalState, recordAnswers } from "./lib.jsx"
import { shareCard } from "./sharecard.js"
import { duelPrompt, parseDuelQs, score as scoreOf, duelUrl, decodeDuel, verdict, shareText } from "./duellib.js"

const copy = async (txt, msg)=>{ try{ await navigator.clipboard.writeText(txt); toast(msg, "success") }catch(e){ window.prompt("Copy this:", txt) } }
const share = async (url, text)=>{
  try{ if(navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)){ await navigator.share({ title: "MindLearn Duel", text, url }); return } }catch(e){ if(e?.name === "AbortError") return }
  copy(url, "Duel link copied! Dost ko bhejo ⚔")
}

/* plays a list of questions, reports picks + seconds */
function Play({ qs, onDone }){
  const [i, setI] = useState(0)
  const [picks, setPicks] = useState([])
  const [sel, setSel] = useState(null)
  const t0 = useRef(Date.now())
  const q = qs[i]
  const choose = k=>{ if(sel != null) return; setSel(k) }
  const next = ()=>{
    const p = [...picks, sel]; setPicks(p); setSel(null)
    if(i + 1 >= qs.length) onDone(p, Math.max(1, Math.round((Date.now() - t0.current) / 1000)))
    else setI(i + 1)
  }
  return (
    <div className="card duel-play" data-testid="duel-play">
      <div className="duel-prog"><i style={{ width: (i / qs.length * 100) + "%" }} /></div>
      <p className="duel-n">Question {i + 1} / {qs.length}</p>
      <h3>{q.q}</h3>
      {q.o.map((o, k)=>(
        <button type="button" key={k} onClick={()=>choose(k)} className={"duel-opt" + (sel != null ? (k === q.a ? " ok" : k === sel ? " bad" : "") : "")} disabled={sel != null && k !== sel && k !== q.a}>
          <b>{"ABCD"[k]}</b> {o}
        </button>
      ))}
      {sel != null && <button type="button" className="btn btn-p" onClick={next}>{i + 1 >= qs.length ? "Finish ⚔" : "Next →"}</button>}
    </div>
  )
}

/* ---------- creator tool (inside the dashboard) ---------- */
export default function DuelTab(){
  const [name, setName] = useLocalState("ml_duel_name", "")
  const [topic, setTopic] = useState("")
  const [stage, setStage] = useState("setup")   // setup | loading | play | done
  const [qs, setQs] = useState([])
  const [res, setRes] = useState(null)
  const [hist, setHist] = useLocalState("ml_duels", [])
  const make = async ()=>{
    if(topic.trim().length < 2) return toast("Topic likho, jaise 'Newton's laws' ya 'Photosynthesis'")
    setStage("loading")
    try{
      const out = parseDuelQs(parseJSONLoose(await askText(duelPrompt(topic.trim()))))
      if(out.length < 3) throw new Error("few")
      setQs(out); setStage("play")
    }catch(e){ toast("Questions nahi ban paaye, dobara try karo."); setStage("setup") }
  }
  const finish = (picks, secs)=>{
    const s = scoreOf(qs, picks)
    recordAnswers(qs.map((q, i)=>({ t: topic.trim().slice(0, 40), ok: picks[i] === q.a })))
    const r = { title: topic.trim(), name: name.trim() || "A friend", qs, score: s, secs }
    setRes(r); setHist(h=>[{ at: Date.now(), title: r.title, score: s, n: qs.length, secs }, ...h].slice(0, 10)); setStage("done")
  }
  if(stage === "loading") return <div className="card" style={{ textAlign: "center", padding: 30 }}><Spin /> <p>Duel ke questions ban rahe hain…</p></div>
  if(stage === "play") return <Play qs={qs} onDone={finish} />
  if(stage === "done" && res) return (
    <div className="card duel-done" data-testid="duel-done">
      <h2>{res.score} / {res.qs.length}</h2>
      <p>in {res.secs}s. Ab dost ko challenge bhejo, wo bina sign-in ke khel sakta hai.</p>
      <div className="duel-actions">
        <button type="button" className="btn btn-p" onClick={()=>share(duelUrl(res), `${res.name} challenges you on "${res.title}": beat ${res.score}/${res.qs.length} in ${res.secs}s ⚔`)}>⚔ Send challenge link</button>
        <button type="button" className="btn" data-testid="share-card" onClick={async ()=>{ const r = await shareCard({ kind: "duel", big: `${res.score}/${res.qs.length}`, sub: res.title, who: `${res.name} challenges you` }, "duel.png"); if(r === "downloaded") toast("Image download ho gayi 📤") }}>📤 Share as image</button>
        <button type="button" className="btn" onClick={()=>{ setStage("setup"); setRes(null) }}>New duel</button>
      </div>
      <p className="coach-note">Note: sawal aur jawab link ke andar hote hain, to koi tech-savvy dost link decode karke jawab dekh sakta hai. Friendly games ke liye theek hai, exam ke liye nahi.</p>
    </div>
  )
  return (
    <div className="card duel-setup">
      <h3>⚔ Duel: dost se 1v1 quiz</h3>
      <p>Topic do, 5 sawal khelo, phir score ke saath challenge link bhejo. Dost ko jeetne ke liye tumhara score beat karna hai (barabar ho to jaldi wala jeetta hai).</p>
      <label>Tumhara naam<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ritik" maxLength={30} /></label>
      <label>Topic<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Newton's laws of motion" maxLength={80} onKeyDown={e=>e.key === "Enter" && make()} /></label>
      <button type="button" className="btn btn-p" onClick={make}>Start duel</button>
      {hist.length > 0 && <div className="duel-hist"><b>Recent</b>{hist.slice(0, 5).map(h=><div key={h.at}>{h.title}: {h.score}/{h.n} in {h.secs}s</div>)}</div>}
    </div>
  )
}

/* ---------- public page: #/duel/<payload> ---------- */
export function DuelPage({ id }){
  const d = decodeDuel(id)
  const [res, setRes] = useState(null)
  const [stage, setStage] = useState("intro")
  const [name, setName] = useState("")
  useEffect(()=>{ window.scrollTo(0, 0) }, [])
  const wrap = ch=><main className="static-page share-page" style={{ maxWidth: 680, margin: "0 auto", padding: "96px 18px 60px" }} data-testid="duel-page">{ch}</main>
  if(!d) return wrap(<div className="card" role="alert">Ye duel link kharab ya adhura hai. Dost se dobara link maango.</div>)
  if(stage === "play") return wrap(<Play qs={d.qs} onDone={(p, secs)=>{ setRes({ score: scoreOf(d.qs, p), secs }); setStage("done") }} />)
  if(stage === "done" && res){
    const v = verdict(res, d)
    const myName = name.trim() || "Friend"
    return wrap(
      <div className="card duel-done" data-testid="duel-result">
        <h1>{v === "win" ? "🏆 You win!" : v === "lose" ? "😅 " + d.name + " wins" : "🤝 Draw"}</h1>
        <p>You: <b>{res.score}/{d.qs.length}</b> in {res.secs}s · {d.name}: <b>{d.score}/{d.qs.length}</b> in {d.secs}s</p>
        <div className="duel-actions">
          <button type="button" className="btn btn-p" onClick={()=>copy(shareText(myName, d.title, res.score, d.qs.length, res.secs, v) + `\n${d.name}: ${d.score}/${d.qs.length} in ${d.secs}s`, "Result copied, dost ko bhej do")}>Copy my result</button>
          <a className="btn" href="#/">Make your own on MindLearn AI</a>
        </div>
      </div>
    )
  }
  return wrap(
    <div className="card duel-setup">
      <p className="pyq-note small" style={{ margin: 0 }}>⚔ Duel challenge</p>
      <h1 style={{ fontFamily: "var(--font-display)", margin: "4px 0 10px" }}>{d.name} ne tumhe challenge kiya</h1>
      <p>Topic: <b>{d.title}</b> · {d.qs.length} questions<br />Score to beat: <b>{d.score}/{d.qs.length}</b> in {d.secs}s</p>
      <label>Tumhara naam<input value={name} onChange={e=>setName(e.target.value)} placeholder="Name (optional)" maxLength={30} /></label>
      <button type="button" className="btn btn-p" onClick={()=>setStage("play")}>Accept challenge ⚔</button>
    </div>
  )
}
