import { useState } from "react"
import { askText, toast, Spin, printDoc, getOutLang, useLocalState } from "./lib.jsx"
import { cheatPrompt, cheatHtml } from "./v46lib.js"

export default function CheatSheetTab(){
  const [focus, setFocus] = useState("")
  const [md, setMd] = useLocalState("ml_cheat", "")
  const [busy, setBusy] = useState(false)
  const make = async ()=>{
    setBusy(true)
    try{
      const t = await askText(cheatPrompt(focus.trim(), getOutLang() !== "en"))
      if(!t || t.length < 40) throw new Error("short")
      setMd(t)
    }catch(e){ toast("Cheat-sheet nahi ban payi. PDF upload hai? Dobara try karo.") }
    setBusy(false)
  }
  return (
    <div className="card tb" data-testid="cheat">
      <h3>📄 Cheat-sheet</h3>
      <p>Apne PDF se 1 page ki revision sheet: formulas, definitions, traps. Exam se pehle print kar lo.</p>
      <label>Focus (optional)<input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="e.g. Chapter 3, thermodynamics" maxLength={80} /></label>
      <div className="duel-actions">
        <button type="button" className="btn btn-p" onClick={make} disabled={busy}>{busy ? <Spin /> : md ? "Regenerate" : "Make cheat-sheet"}</button>
        {md && <button type="button" className="btn" onClick={()=>printDoc("MindLearn Cheat-sheet", cheatHtml(md))}>🖨 Print / Save PDF</button>}
      </div>
      {md && <div className="cheat-sheet" dangerouslySetInnerHTML={{ __html: cheatHtml(md) }} />}
      {md && <p className="coach-note">AI se bani hai aur sirf tumhare PDF par based hai, phir bhi galti ho sakti hai. Exam se pehle book se check karna.</p>}
    </div>
  )
}
