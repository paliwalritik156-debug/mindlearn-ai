import { useState } from "react"
import { askText, parseJSONLoose, toast, Spin, useLocalState, weakStats, getOutLang, recordAnswers } from "./lib.jsx"
import { teachPrompt, parseTeach, overall, grade } from "./teachlib.js"

const Meter = ({ label, v })=><div className="tb-m"><span>{label}</span><div><i style={{ width: v + "%" }} /></div><b>{v}</b></div>

export default function TeachBackTab(){
  const [topic, setTopic] = useState("")
  const [text, setText] = useState("")
  const [turns, setTurns] = useState([])   // {role:"you"|"student", text, eval?}
  const [busy, setBusy] = useState(false)
  const [hist, setHist] = useLocalState("ml_teach", [])
  const weak = weakStats().filter(w=>w.acc < 70).slice(0, 3)
  const last = [...turns].reverse().find(t=>t.eval)?.eval
  const send = async ()=>{
    if(!topic.trim()) return toast("Pehle topic likho")
    if(text.trim().split(/\s+/).length < 8) return toast("Thoda detail me samjhao (kam se kam 8 words)")
    setBusy(true)
    try{
      const hi = getOutLang() !== "en"
      const raw = await askText(teachPrompt(topic.trim(), turns, text.trim(), hi))
      const ev = parseTeach(parseJSONLoose(raw))
      if(!ev) throw new Error("bad")
      const nt = [...turns, { role: "you", text: text.trim() }, { role: "student", text: ev.reply, eval: ev }]
      setTurns(nt); setText("")
      const o = overall(ev)
      recordAnswers([{ t: topic.trim().slice(0, 40), ok: o >= 65 }])
      setHist(h=>[{ at: Date.now(), topic: topic.trim(), score: o }, ...h].slice(0, 20))
    }catch(e){ toast("Student confuse ho gaya, dobara bhejo.") }
    setBusy(false)
  }
  return (
    <div className="card tb">
      <h3>🧑‍🏫 Teach it back</h3>
      <p>Jo seekha use ek confused student ko samjhao. Agar samjha paye, to tumne sach me seekha hai (Feynman technique).</p>
      {weak.length > 0 && <p className="coach-note">Weak topics: {weak.map(w=><button type="button" key={w.topic} className="chip" onClick={()=>setTopic(w.topic)}>{w.topic}</button>)}</p>}
      <label>Topic<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Photosynthesis" maxLength={80} disabled={turns.length > 0} /></label>
      <div className="tb-chat">
        {turns.map((t, i)=>(
          <div key={i} className={"tb-b " + t.role}><b>{t.role === "you" ? "You (teacher)" : "🙋 Student"}</b><p>{t.text}</p></div>
        ))}
        {busy && <div className="tb-b student"><Spin /></div>}
      </div>
      {last && (
        <div className="tb-score" data-testid="tb-score">
          <h4>{overall(last)}/100 · {grade(overall(last))}</h4>
          <Meter label="Clarity" v={last.clarity} /><Meter label="Accuracy" v={last.accuracy} /><Meter label="Depth" v={last.depth} />
          {last.errors.length > 0 && <p>❌ Galat: {last.errors.join(" · ")}</p>}
          {last.gaps.length > 0 && <p>🕳 Gaps: {last.gaps.join(" · ")}</p>}
          <p className="coach-note">AI ka andaza hai, galti kar sakta hai. Apni book se verify karo.</p>
        </div>
      )}
      <textarea rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder={turns.length ? "Student ke sawal ka jawab do…" : "Aise samjhao jaise 10 saal ke bacche ko…"} />
      <div className="duel-actions">
        <button type="button" className="btn btn-p" onClick={send} disabled={busy}>{turns.length ? "Reply" : "Explain"}</button>
        {turns.length > 0 && <button type="button" className="btn" onClick={()=>{ setTurns([]); setText("") }}>New topic</button>}
      </div>
    </div>
  )
}
