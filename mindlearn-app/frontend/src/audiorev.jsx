import { useEffect, useRef, useState } from "react"
import { askText, toast, Spin, getOutLang, LANGS, useLocalState } from "./lib.jsx"
import { bestVoice } from "./voicelib.js"
import { chunkText, audioPrompt, stripMd } from "./v54lib.js"

export default function AudioRevTab(){
  const [focus, setFocus] = useState("")
  const [script, setScript] = useLocalState("ml_audio", "")
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState("idle")   // idle | playing | paused
  const [pos, setPos] = useState(0)
  const [rate, setRate] = useState(1)
  const R = useRef({ chunks: [], i: 0, rate: 1, on: false })
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null
  useEffect(()=>()=>{ R.current.on = false; try{ synth?.cancel() }catch(e){} }, [])
  const voiceFor = ()=>{
    return bestVoice(synth?.getVoices() || [], LANGS[getOutLang()]?.tts || "en-IN")
  }
  const speakFrom = i=>{
    const r = R.current
    if(!r.on || i >= r.chunks.length){ r.on = false; setState("idle"); setPos(0); return }
    r.i = i; setPos(i)
    const u = new SpeechSynthesisUtterance(r.chunks[i]); const v = voiceFor(); if(v){ u.voice = v; u.lang = v.lang } else u.lang = LANGS[getOutLang()]?.tts || "en-IN"
    u.rate = r.rate; u.onend = ()=>speakFrom(i + 1); u.onerror = ()=>{ if(r.on) speakFrom(i + 1) }
    synth.speak(u)
  }
  const play = ()=>{
    if(!synth) return toast("Is browser me audio support nahi hai. Chrome ya Edge try karo.")
    synth.cancel(); R.current = { chunks: chunkText(script), i: 0, rate, on: true }
    setState("playing"); speakFrom(0)
  }
  const pause = ()=>{ if(state === "playing"){ synth.pause(); setState("paused") } else if(state === "paused"){ synth.resume(); setState("playing") } }
  const stop = ()=>{ R.current.on = false; synth?.cancel(); setState("idle"); setPos(0) }
  const skip = d=>{ if(!R.current.on) return; synth.cancel(); R.current.on = true; speakFrom(Math.max(0, Math.min(R.current.chunks.length - 1, R.current.i + d))) }
  const make = async ()=>{
    setBusy(true); stop()
    try{ const t = stripMd(await askText(audioPrompt(focus.trim(), getOutLang() !== "en"))); if(t.length < 60) throw new Error("short"); setScript(t) }
    catch(e){ toast("Script nahi ban payi. PDF upload hai? Dobara try karo.") }
    setBusy(false)
  }
  const total = chunkText(script).length
  return (
    <div className="card tb" data-testid="audio-rev">
      <h3>🎧 Audio revision</h3>
      <p>PDF ka 2 minute ka revision script bana ke bol ke sunata hai. Bus, walk ya gym me padhai. Bolne ki bhasha tumhari Answer Language (EN, Hinglish, हिन्दी) se judi hai.</p>
      <label>Focus (optional)<input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="e.g. Chapter 2, cell division" maxLength={80} /></label>
      <div className="duel-actions"><button type="button" className="btn btn-p" onClick={make} disabled={busy}>{busy ? <Spin /> : script ? "Naya script" : "Make audio script"}</button></div>
      {script && (
        <>
          <div className="duel-actions">
            {state === "idle" ? <button type="button" className="btn btn-p" onClick={play}>▶ Play</button> : <button type="button" className="btn" onClick={pause}>{state === "paused" ? "▶ Resume" : "⏸ Pause"}</button>}
            <button type="button" className="btn" onClick={()=>skip(-1)} disabled={state === "idle"} aria-label="Previous">⏮</button>
            <button type="button" className="btn" onClick={()=>skip(1)} disabled={state === "idle"} aria-label="Next">⏭</button>
            <button type="button" className="btn" onClick={stop} disabled={state === "idle"}>⏹ Stop</button>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Speed {rate}x<input type="range" min="0.7" max="1.5" step="0.1" value={rate} onChange={e=>{ const v = +e.target.value; setRate(v); R.current.rate = v }} /></label>
          </div>
          {state !== "idle" && <div className="coach-bar"><i style={{ width: ((pos + 1) / Math.max(1, total) * 100) + "%" }} /></div>}
          <div className="cheat-sheet" style={{ columns: 1 }}>{chunkText(script).map((c, i)=><span key={i} style={{ background: state !== "idle" && i === pos ? "rgba(255,160,60,.28)" : "none", borderRadius: 4 }}>{c} </span>)}</div>
          <p className="coach-note">Awaaz tumhare browser/phone ki hoti hai. Hindi voice nahi mili to English voice me bolega. Script AI ne PDF se banayi hai, galti ho sakti hai.</p>
        </>
      )}
    </div>
  )
}
