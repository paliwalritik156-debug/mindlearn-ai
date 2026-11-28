import { useEffect, useRef, useState } from "react"
import { askText, parseJSONLoose, toast, Spin, useLocalState, LANGS, getOutLang } from "./lib.jsx"
import { LEVELS, ROUNDS, sideFor, openingPrompt, turnPrompt, parseTurn, finalPrompt, parseFinal, averages } from "./debatelib.js"
import { rankVoices, phrases, prosody } from "./voicelib.js"
import Avatar from "./Avatar.jsx"
import { useGaze } from "./gazehook.js"
import Attention from "./Attention.jsx"
import { chipText } from "./gaze.js"
import { wordCount, fillerCount, wpm, paceLabel } from "./interviewlib.js"

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
const isHi = ()=>getOutLang() !== "en"
const SILENCE_MS = 2600, MAX_SECS = 90

export default function DebateLive(){
  const [stage, setStage] = useState("setup")        // setup | loading | live | report
  const [topic, setTopic] = useState("")
  const [mine, setMine] = useState("For")
  const [level, setLevel] = useState("friendly")
  const [rounds, setRounds] = useState(4)
  const [cam, setCam] = useState(true)
  const [phase, setPhase] = useState("speaking")      // speaking | listening | thinking
  const [round, setRound] = useState(1)
  const [log, setLog] = useState([])                  // {role:"you"|"pari", text, ev?}
  const [live, setLive] = useState("")
  const [typed, setTyped] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [fin, setFin] = useState(null)
  const [note, setNote] = useState("")
  const [camOn, setCamOn] = useState(false)
  const [track, setTrack] = useState(true)
  const [att, setAtt] = useState(null)
  const [voices, setVoices] = useState([])
  const [voiceName, setVoiceName] = useLocalState("ml_pari_voice", "")
  const [hist, setHist] = useLocalState("ml_debates", [])
  const videoRef = useRef(null), streamRef = useRef(null)
  const gz = useGaze(videoRef, camOn && track && stage === "live")
  const S = useRef({ alive: true, token: 0, rec: null, want: false, text: "", t0: 0, last: 0, rows: [], log: [], round: 1, busy: false, topic: "", ai: "Against", level: "friendly", rounds: 4 }).current

  useEffect(()=>{
    S.alive = true
    const load = ()=>{ try{ setVoices(window.speechSynthesis.getVoices() || []) }catch(e){} }
    load(); try{ window.speechSynthesis.onvoiceschanged = load }catch(e){}
    return ()=>{ S.alive = false; stopListen(); try{ window.speechSynthesis?.cancel() }catch(e){}; stopCam() }
  }, [])

  const lang = ()=>LANGS[getOutLang()].tts
  const ranked = rankVoices(voices, lang())
  const chosen = ()=>voices.find(v=>v.name === voiceName) || ranked[0] || null

  /* ---------- camera (browser only, never recorded or uploaded) ---------- */
  async function startCam(){
    try{ streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640 }, audio: false }); setCamOn(true) }
    catch(e){ setCamOn(false); setNote("Camera not available or blocked. The debate still works without it.") }
  }
  function stopCam(){ try{ streamRef.current?.getTracks().forEach(t=>t.stop()) }catch(e){}; streamRef.current = null; setCamOn(false) }
  useEffect(()=>{ if(camOn && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current }, [camOn, stage])

  /* ---------- Pari's voice: short phrases, small natural variation, tiny pauses ---------- */
  function say(text){
    return new Promise(res=>{
      const synth = window.speechSynthesis, ps = phrases(text), my = ++S.token
      if(!synth || !ps.length){ setTimeout(res, Math.min(5000, String(text).length * 40)); return }
      synth.cancel()
      const v = chosen()
      let i = 0
      const next = ()=>{
        if(my !== S.token || !S.alive || i >= ps.length) return res()
        const p = ps[i], pr = prosody(p, i + S.round)
        const u = new SpeechSynthesisUtterance(p)
        u.lang = v?.lang || lang(); if(v) u.voice = v; u.rate = pr.rate; u.pitch = pr.pitch
        let done = false
        const go = ()=>{ if(done) return; done = true; i++; setTimeout(next, pr.pause) }
        u.onend = go; u.onerror = go
        synth.speak(u)
        setTimeout(go, 9000 + p.length * 70)
      }
      next()
    })
  }
  const stopSay = ()=>{ S.token++; try{ window.speechSynthesis?.cancel() }catch(e){} }

  function startListen(){
    S.text = ""; S.t0 = Date.now(); S.last = Date.now(); setLive(""); setTyped(""); setElapsed(0)
    if(!SR) return
    const rec = new SR()
    rec.lang = LANGS[getOutLang()].rec; rec.continuous = true; rec.interimResults = true
    rec.onresult = e=>{
      let interim = ""
      for(let i = e.resultIndex; i < e.results.length; i++){ if(e.results[i].isFinal) S.text += e.results[i][0].transcript + " "; else interim += e.results[i][0].transcript }
      S.last = Date.now(); setLive((S.text + interim).trim())
    }
    rec.onerror = e=>{ if(e.error === "not-allowed" || e.error === "service-not-allowed"){ S.want = false; setNote("Microphone is blocked. Allow it in the address bar, or type below.") } }
    rec.onend = ()=>{ if(S.want && S.alive){ try{ rec.start() }catch(e){} } }
    S.rec = rec; S.want = true
    try{ rec.start() }catch(e){}
  }
  function stopListen(){ S.want = false; try{ S.rec?.stop() }catch(e){}; S.rec = null }

  // auto-submit after a natural pause, like a real conversation
  useEffect(()=>{
    if(stage !== "live" || phase !== "listening") return
    const id = setInterval(()=>{
      const secs = Math.round((Date.now() - S.t0) / 1000); setElapsed(secs)
      if(secs >= MAX_SECS) submit()
      else if(SR && wordCount(S.text) >= 4 && Date.now() - S.last > SILENCE_MS) submit()
    }, 400)
    return ()=>clearInterval(id)
  }, [stage, phase, round])

  /* ---------- the debate ---------- */
  async function start(){
    if(S.busy) return
    if(topic.trim().length < 4) return toast("Debate ka topic likho, jaise 'Online classes are better than offline'")
    S.busy = true; setNote(""); S.rows = []; S.log = []; S.round = 1; setRound(1); setLog([]); setFin(null)
    S.topic = topic.trim(); S.ai = sideFor(mine); S.level = level; S.rounds = rounds
    setStage("loading"); if(cam) startCam()
    try{
      const text = (await askText(openingPrompt({ topic: S.topic, aiSide: S.ai, level, hi: isHi() }))).replace(/["{}]/g, "").trim()
      if(text.length < 10) throw new Error("short")
      S.log = [{ role: "pari", text }]; setLog(S.log); setStage("live"); setPhase("speaking")
      await say(text)
      if(S.alive){ setPhase("listening"); startListen() }
    }catch(e){ toast(e?.response?.data?.detail || "Pari ready nahi ho payi. Dobara try karo.", "error"); stopCam(); setStage("setup") }
    finally{ S.busy = false }
  }

  async function submit(){
    if(S.busy || !S.alive) return
    const text = (S.text.trim() || typed.trim())
    if(wordCount(text) < 2) return toast("Pehle apni baat bolo (ya type karo)")
    S.busy = true
    const secs = Math.max(1, Math.round((Date.now() - S.t0) / 1000))
    stopListen(); stopSay(); setPhase("thinking")
    S.log = [...S.log, { role: "you", text }]; setLog(S.log); setLive(""); setTyped("")
    let ev = null
    try{ ev = parseTurn(parseJSONLoose(await askText(turnPrompt({ topic: S.topic, aiSide: S.ai, history: S.log.slice(0, -1), userText: text, level: S.level, round: S.round, rounds: S.rounds, hi: isHi() })))) }catch(e){}
    const row = { text, secs, words: wordCount(text), fillers: fillerCount(text), logic: ev?.logic ?? null, evidence: ev?.evidence ?? null, note: ev?.note || "" }
    S.rows = [...S.rows, row]
    const reply = ev?.reply || (isHi() ? "Hmm, interesting. Aur batao?" : "Hmm, interesting. Tell me more?")
    S.log = [...S.log, { role: "pari", text: reply, ev }]; setLog(S.log)
    S.busy = false
    if(S.round >= S.rounds){
      setPhase("speaking"); await say(reply + " " + (isHi() ? "Chalo, ab result dekhte hain." : "Alright, let's see how you did."))
      return finish()
    }
    S.round += 1; setRound(S.round); setPhase("speaking")
    await say(reply)
    if(S.alive && S.busy === false){ setPhase("listening"); startListen() }
  }

  async function finish(){
    setPhase("thinking")
    let f = null
    try{ f = parseFinal(parseJSONLoose(await askText(finalPrompt(S.topic, S.ai, S.rows.map(r=>({ text: r.text })), isHi())))) }catch(e){}
    setAtt(track && camOn ? gz.summary() : null); setFin(f); stopCam(); stopListen(); setStage("report")
    const a = averages(S.rows)
    setHist(h=>[...h, { at: Date.now(), topic: S.topic, winner: f?.winner || "draw", logic: a.logic, evidence: a.evidence }].slice(-20))
  }
  function endNow(){ stopSay(); stopListen(); S.busy = false; if(S.rows.length) finish(); else { stopCam(); setStage("setup") } }
  function myTurn(){ if(phase === "speaking"){ stopSay(); setPhase("listening"); startListen() } }
  function testVoice(){ stopSay(); say(isHi() ? "Namaste! Main Pari hu. Chalo ek mazedaar debate karte hain." : "Hi! I'm Pari. Let's have a really fun debate.") }

  /* ---------- views ---------- */
  if(stage === "setup" || stage === "loading"){
    return (
      <div className="card dbt-setup" data-testid="dbt-setup">
        <div className="dbt-hero"><Avatar who="pari" state="idle" size={96} /><div><h3>⚖️ Live Debate with Pari</h3><p>Pari se awaaz me bahas karo, camera ke saath. Wo tumhari baat sunti hai, jawab deti hai aur end me batati hai kaun jeeta.</p></div></div>
        <label>Topic<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Social media does more harm than good" maxLength={120} /></label>
        <label>Tumhari side<div className="room-opts">{["For", "Against"].map(x=><button type="button" key={x} className={"chip" + (mine === x ? " on" : "")} onClick={()=>setMine(x)}>{x === "For" ? "👍 Favour" : "👎 Against"}</button>)}</div></label>
        <label>Pari ka style<div className="room-opts">{LEVELS.map(l=><button type="button" key={l.key} className={"chip" + (level === l.key ? " on" : "")} onClick={()=>setLevel(l.key)} title={l.hint}>{l.label}</button>)}</div></label>
        <label>Rounds<div className="room-opts">{ROUNDS.map(n=><button type="button" key={n} className={"chip" + (rounds === n ? " on" : "")} onClick={()=>setRounds(n)}>{n}</button>)}</div></label>
        <label className="dbt-check"><input type="checkbox" checked={cam} onChange={e=>setCam(e.target.checked)} /> Camera on (sirf tumhe dikhega, record ya upload nahi hota)</label>
        {cam && <label className="dbt-check"><input type="checkbox" checked={track} onChange={e=>setTrack(e.target.checked)} /> 👀 Attention tracking (nazar screen pe hai ya nahi, sirf tumhare browser me)</label>}
        {ranked.length > 0 && (
          <label>Pari ki awaaz<div className="dbt-voice"><select value={chosen()?.name || ""} onChange={e=>setVoiceName(e.target.value)}>{ranked.slice(0, 8).map(v=><option key={v.name} value={v.name}>{v.name.replace(/Microsoft |Google /, "")}</option>)}</select><button type="button" className="btn btn-sm" onClick={testVoice}>▶ Test</button></div></label>
        )}
        {!SR && <p className="coach-note">Is browser me mic recognition nahi hai. Chrome ya Edge use karo, ya type karke jawab do.</p>}
        <button type="button" className="btn btn-p" onClick={start} disabled={stage === "loading"}>{stage === "loading" ? <Spin /> : "Start debate"}</button>
        {note && <p className="coach-note">{note}</p>}
        <p className="coach-note">Awaaz aur uski quality tumhare browser/device ki voices pe depend karti hai. Edge aur Chrome me "Natural" voices sabse insaani lagti hain.</p>
      </div>
    )
  }

  if(stage === "report"){
    const a = averages(S.rows), words = S.rows.reduce((s, r)=>s + r.words, 0), secs = S.rows.reduce((s, r)=>s + r.secs, 0), fill = S.rows.reduce((s, r)=>s + r.fillers, 0)
    const pace = wpm(words, secs)
    return (
      <div className="card dbt-report" data-testid="dbt-report">
        <h3>{fin?.winner === "student" ? "🏆 Tum jeet gaye!" : fin?.winner === "pari" ? "😄 Pari jeet gayi" : "🤝 Barabari"}</h3>
        <p className="coach-note">Topic: {S.topic} · tumhari side: {mine}</p>
        <div className="ad-grid" style={{ marginTop: 0 }}>
          <div className="ad-stat"><div className="ad-n">{a.logic}</div><div className="ad-l">Logic /10</div></div>
          <div className="ad-stat"><div className="ad-n">{a.evidence}</div><div className="ad-l">Evidence /10</div></div>
          <div className="ad-stat"><div className="ad-n">{pace || "-"}</div><div className="ad-l">Words/min {paceLabel(pace) && `(${paceLabel(pace)})`}</div></div>
          <div className="ad-stat"><div className="ad-n">{fill}</div><div className="ad-l">Filler words</div></div>
        </div>
        <Attention sm={att} />
        {fin?.best && <p>💪 <b>Sabse strong point:</b> {fin.best}</p>}
        {fin?.weak && <p>🕳 <b>Kamzor point:</b> {fin.weak}</p>}
        {fin?.tips?.length > 0 && <ul>{fin.tips.map((t, i)=><li key={i}>{t}</li>)}</ul>}
        <details><summary>Poori baatcheet</summary>{S.log.map((m, i)=><p key={i}><b>{m.role === "you" ? "You" : "Pari"}:</b> {m.text}</p>)}</details>
        <p className="coach-note">Scores AI ka andaza hain, final sach nahi. Camera video record/upload nahi hota.</p>
        <div className="duel-actions"><button type="button" className="btn btn-p" onClick={()=>setStage("setup")}>Naya debate</button></div>
      </div>
    )
  }

  const you = phase === "listening"
  return (
    <div className="card dbt-live" data-testid="dbt-live">
      <div className="dbt-top"><span>Round {round}/{rounds} · {topic}</span><button type="button" className="btn btn-sm" onClick={endNow}>End & result</button></div>
      <div className="dbt-stage">
        <Avatar who="pari" state={phase} size={170} />
        <div className="dbt-status">{phase === "speaking" ? "Pari bol rahi hai…" : phase === "thinking" ? "Pari soch rahi hai…" : "Tumhari baari 🎤"}</div>
        {camOn && <div className="dbt-camwrap"><video ref={videoRef} autoPlay muted playsInline className="dbt-cam" />{track && gz.state !== "off" && <span className={"att-chip " + gz.state}>{chipText(gz.state)}</span>}</div>}
      </div>
      <div className="dbt-chat">{log.slice(-4).map((m, i)=>(
        <div key={i} className={"tb-b " + (m.role === "you" ? "you" : "student")}><b>{m.role === "you" ? "You" : "Pari"}</b><p>{m.text}</p>{m.ev?.note && <small>💡 {m.ev.note}</small>}</div>
      ))}</div>
      {you && <div className="dbt-live-text" data-testid="dbt-live-text">{live || (SR ? "Bolna shuru karo…" : "Type karo:")}</div>}
      {you && (!SR || note) && <textarea rows={2} value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Apni argument yahan type karo…" />}
      <div className="duel-actions">
        {phase === "speaking" && <button type="button" className="btn" onClick={myTurn}>✋ Meri baari</button>}
        {you && <button type="button" className="btn btn-p" onClick={submit}>Done ✓ {elapsed ? `(${elapsed}s)` : ""}</button>}
      </div>
      {track && camOn && (gz.state === "away" || gz.state === "multi" || gz.state === "noface") && phase === "listening" && <div className="att-nudge" data-testid="att-nudge">{chipText(gz.state)}. Screen ki taraf dekhkar bolo.</div>}
      {gz.error && <p className="coach-note">{gz.error}</p>}
      {note && <p className="coach-note">{note}</p>}
    </div>
  )
}
