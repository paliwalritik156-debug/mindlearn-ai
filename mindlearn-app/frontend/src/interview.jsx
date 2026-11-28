import { useEffect, useRef, useState } from "react"
import { askText, parseJSONLoose, toast, Spin, useLocalState, LANGS, getOutLang, langInstruction } from "./lib.jsx"
import { bestVoice } from "./voicelib.js"
import { TYPES, COUNTS, MAX_ANSWER_SECS, SILENCE_MS, wordCount, fillerCount, questionsPrompt, parseQuestions, evalPrompt, parseEval, skipped, summaryPrompt, parseSummary, report } from "./interviewlib.js"

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
const isHi = ()=>getOutLang() !== "en"
const mmss = s=>`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

function pickVoice(lang){ try{ return bestVoice(window.speechSynthesis.getVoices() || [], lang) }catch(e){ return null } }

export default function InterviewTab(){
  const [stage, setStage] = useState("setup")       // setup | loading | live | report
  const [type, setType] = useState("pdf")
  const [focus, setFocus] = useState("")
  const [n, setN] = useState(5)
  const [cam, setCam] = useState(true)
  const [qs, setQs] = useState([])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState("speaking")    // speaking | listening | thinking
  const [live, setLive] = useState("")              // live transcript
  const [typed, setTyped] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [rows, setRows] = useState([])
  const [sum, setSum] = useState(null)
  const [note, setNote] = useState("")
  const [camOn, setCamOn] = useState(false)
  const [hist, setHist] = useLocalState("ml_interviews", [])
  const videoRef = useRef(null), streamRef = useRef(null)
  const S = useRef({ alive: true, token: 0, rec: null, want: false, text: "", t0: 0, last: 0, qs: [], rows: [], idx: 0, busy: false, type: "pdf" }).current

  useEffect(()=>{
    S.alive = true
    try{ window.speechSynthesis?.getVoices() }catch(e){}
    return ()=>{ S.alive = false; stopListen(); try{ window.speechSynthesis?.cancel() }catch(e){}; stopCam() }
  },[])

  /* ---------- camera (stays in the browser; never recorded or uploaded) ---------- */
  async function startCam(){
    try{
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640 }, audio: false })
      streamRef.current = st; setCamOn(true)
    }catch(e){ setCamOn(false); setNote("Camera not available or blocked. The interview still works without it.") }
  }
  function stopCam(){ try{ streamRef.current?.getTracks().forEach(t=>t.stop()) }catch(e){}; streamRef.current = null; setCamOn(false) }
  useEffect(()=>{ if(camOn && videoRef.current && streamRef.current){ videoRef.current.srcObject = streamRef.current } },[camOn, stage])

  /* ---------- speech ---------- */
  function say(text){
    return new Promise(res=>{
      const synth = window.speechSynthesis
      const clean = String(text).replace(/[*_#`>~|]/g, " ").replace(/\s+/g, " ").trim()
      if(!synth || !clean){ setTimeout(res, Math.min(6000, clean.length * 45)); return }
      const my = ++S.token
      const u = new SpeechSynthesisUtterance(clean)
      u.lang = LANGS[getOutLang()].tts; u.rate = 0.98; u.pitch = 1.05
      const v = pickVoice(u.lang); if(v) u.voice = v
      let done = false
      const fin = ()=>{ if(done) return; done = true; res() }
      u.onend = fin; u.onerror = fin
      synth.cancel(); synth.speak(u)
      setTimeout(fin, 20000 + clean.length * 60)   // safety net for browsers that never fire onend
    })
  }

  function startListen(){
    S.text = ""; S.t0 = Date.now(); S.last = Date.now(); setLive(""); setTyped(""); setElapsed(0)
    if(!SR){ return }
    const rec = new SR()
    rec.lang = LANGS[getOutLang()].rec; rec.continuous = true; rec.interimResults = true
    rec.onresult = e=>{
      let interim = ""
      for(let i = e.resultIndex; i < e.results.length; i++){
        if(e.results[i].isFinal){ S.text += e.results[i][0].transcript + " " } else interim += e.results[i][0].transcript
      }
      S.last = Date.now(); setLive((S.text + interim).trim())
    }
    rec.onerror = e=>{ if(e.error === "not-allowed" || e.error === "service-not-allowed"){ S.want = false; setNote("Microphone is blocked. Allow it in the address bar, or type your answer below.") } }
    rec.onend = ()=>{ if(S.want && S.alive){ try{ rec.start() }catch(e){} } }   // browsers stop after silence; keep going until Done
    S.rec = rec; S.want = true
    try{ rec.start() }catch(e){}
  }
  function stopListen(){ S.want = false; try{ S.rec?.stop() }catch(e){}; S.rec = null }

  // timer + auto-submit after a pause (feels like a real conversation)
  useEffect(()=>{
    if(stage !== "live" || phase !== "listening") return
    const id = setInterval(()=>{
      const secs = Math.round((Date.now() - S.t0) / 1000); setElapsed(secs)
      if(secs >= MAX_ANSWER_SECS) finishAnswer(false)
      else if(SR && wordCount(S.text) >= 6 && Date.now() - S.last > SILENCE_MS) finishAnswer(false)
    }, 400)
    return ()=>clearInterval(id)
  },[stage, phase, idx])

  /* ---------- interview flow ---------- */
  async function start(){
    if(S.busy) return; S.busy = true
    S.type = type; setNote(""); setRows([]); S.rows = []; setSum(null); setStage("loading")
    if(cam) startCam()
    try{
      const text = await askText(questionsPrompt({ type, focus: focus.trim(), n, lang: langInstruction() }))
      const list = parseQuestions(parseJSONLoose(text), n)
      if(list.length < 2) throw new Error("bad")
      S.qs = list; S.idx = 0; setQs(list); setIdx(0); setStage("live")
      const hello = isHi() ? "Namaste, main Aria hu. Chaliye interview shuru karte hain." : "Hello, I'm Aria. Let's begin your interview."
      await ask(0, hello)
    }catch(e){
      toast(e?.response?.data?.detail || "Couldn't prepare the interview. Try again.", "error")
      stopCam(); setStage("setup")
    }finally{ S.busy = false }
  }

  async function ask(i, lead){
    if(!S.alive) return
    S.idx = i; setIdx(i); setPhase("speaking"); setLive(""); setTyped("")
    await say((lead ? lead + " " : "") + S.qs[i].q)
    if(!S.alive) return
    setPhase("listening"); startListen()
  }

  async function finishAnswer(skip){
    if(S.busy || !S.alive) return; S.busy = true
    const answer = (S.text + (SR ? "" : "")).trim() || typed.trim()
    const secs = Math.max(1, Math.round((Date.now() - S.t0) / 1000))
    stopListen(); try{ window.speechSynthesis?.cancel() }catch(e){}
    setPhase("thinking")
    const q = S.qs[S.idx]
    let row
    if(skip || wordCount(answer) < 2){ row = { ...skipped(), q: q.q, topic: q.topic, answer: "" } }
    else{
      try{
        const text = await askText(evalPrompt({ type: S.type, question: q.q, answer, secs, lang: langInstruction() }))
        const ev = parseEval(parseJSONLoose(text))
        if(!ev) throw new Error("bad")
        row = { ...ev, q: q.q, topic: q.topic, answer, secs, words: wordCount(answer), fillers: fillerCount(answer) }
      }catch(e){
        row = { score: 5, reaction: "Thank you, noted.", good: "", improve: "I couldn't score this answer (AI hiccup).", ideal: "", q: q.q, topic: q.topic, answer, secs, words: wordCount(answer), fillers: fillerCount(answer), unscored: true }
      }
    }
    S.rows = [...S.rows, row]; setRows(S.rows)
    S.busy = false
    if(S.idx + 1 < S.qs.length){ await ask(S.idx + 1, row.reaction) }
    else{
      setPhase("speaking")
      const bye = isHi() ? "Yeh aakhri sawal tha. Main aapki report bana rahi hu." : "That was the last question. Let me prepare your report."
      say((row.reaction ? row.reaction + " " : "") + bye)
      await buildReport()
    }
  }

  async function buildReport(){
    let s = null
    try{ s = parseSummary(parseJSONLoose(await askText(summaryPrompt(S.rows, langInstruction())))) }catch(e){}
    setSum(s); stopCam(); stopListen(); setStage("report")
    const r = report(S.rows)
    setHist(h=>[...h, { at: Date.now(), type: S.type, avg: r.avg, n: r.total }].slice(-20))
  }
  function endNow(){
    try{ window.speechSynthesis?.cancel() }catch(e){}
    stopListen(); S.token++; S.busy = false
    if(S.rows.length){ buildReport() } else { stopCam(); setStage("setup") }
  }
  function again(){ setStage("setup"); setRows([]); S.rows = []; setSum(null) }
  function repeat(){ if(phase === "listening"){ stopListen(); setPhase("speaking"); say(S.qs[S.idx].q).then(()=>{ if(S.alive){ setPhase("listening"); startListen() } }) } }

  /* ---------- views ---------- */
  if(stage === "setup" || stage === "loading"){
    const t = TYPES.find(x=>x.key === type)
    return (
      <div className="card iv-setup" data-testid="iv-setup">
        <h3 style={{ marginTop: 0 }}>🎥 Live interview with Aria</h3>
        <p className="pyq-note" style={{ marginTop: 0 }}>Aria asks questions out loud, you answer with your voice, and she reacts like a real interviewer. Your camera is only for you to practise eye contact. It is not recorded or uploaded.</p>
        <div className="iv-types">
          {TYPES.map(x=>(<button key={x.key} className={"iv-type" + (type === x.key ? " on" : "")} onClick={()=>setType(x.key)} data-testid={"iv-type-" + x.key}><span>{x.icon}</span><b>{isHi() ? x.hi : x.en}</b></button>))}
        </div>
        <p className="pyq-note small">{t.hint}</p>
        <label className="iv-lab">Role / subject (optional)<input className="input" value={focus} maxLength={80} onChange={e=>setFocus(e.target.value)} placeholder={type === "tech" ? "e.g. Python developer, DBMS, Thermodynamics" : "e.g. Software intern at a startup"} /></label>
        <div className="iv-row">
          <div>Questions: {COUNTS.map(c=><button key={c} className={"chip" + (n === c ? " on" : "")} onClick={()=>setN(c)}>{c}</button>)}</div>
          <label className="voice-toggle"><input type="checkbox" checked={cam} onChange={e=>setCam(e.target.checked)} /> 📷 Camera on</label>
        </div>
        {!SR && <div className="form-err">Your browser can't listen to speech. You can still type your answers. Chrome or Edge works best for voice.</div>}
        {note && <div className="form-err">{note}</div>}
        <div className="pyq-acts"><button className="btn btn-p" disabled={stage === "loading"} onClick={start} data-testid="iv-start">{stage === "loading" ? <><Spin /> Aria is preparing…</> : "Start interview"}</button></div>
        <p className="pyq-note small">Language: <b>{LANGS[getOutLang()].label}</b> (change in the sidebar). Each interview uses about {n + 2} AI requests from your daily limit.</p>
        {hist.length > 0 && <div className="iv-hist">Recent: {hist.slice(-5).map((h, i)=><span key={i} className="chip">{h.avg}/10</span>)}</div>}
      </div>
    )
  }

  if(stage === "report"){
    const r = report(rows)
    const col = r.avg >= 7 ? "#34d399" : r.avg >= 5 ? "#f59e0b" : "#f87171"
    return (
      <div className="card iv-report" data-testid="iv-report">
        <div className="iv-top">
          <div className="iv-ring" style={{ "--p": r.pct, "--c": col }}><b>{r.avg}</b><i>/10</i></div>
          <div>
            <h3 style={{ margin: 0 }}>Interview report</h3>
            {sum?.verdict && <p style={{ margin: "6px 0 0" }}>{sum.verdict}</p>}
          </div>
        </div>
        <div className="ad-grid">
          <div className="ad-stat"><div className="ad-n">{r.answered}/{r.total}</div><div className="ad-l">Answered</div></div>
          <div className="ad-stat"><div className="ad-n">{r.pace || "–"}</div><div className="ad-l">Words / min {r.paceLabel && `(${r.paceLabel})`}</div></div>
          <div className="ad-stat"><div className="ad-n">{r.fillers}</div><div className="ad-l">Filler words</div></div>
          <div className="ad-stat"><div className="ad-n">{hist.length > 1 ? (r.avg - hist[hist.length - 2].avg >= 0 ? "+" : "") + Math.round((r.avg - hist[hist.length - 2].avg) * 10) / 10 : "–"}</div><div className="ad-l">vs last time</div></div>
        </div>
        {sum && (sum.strengths.length > 0 || sum.work_on.length > 0) && (
          <div className="iv-two">
            <div><h4>💪 Strengths</h4><ul>{sum.strengths.map((x, i)=><li key={i}>{x}</li>)}</ul></div>
            <div><h4>🎯 Work on</h4><ul>{sum.work_on.map((x, i)=><li key={i}>{x}</li>)}</ul></div>
          </div>
        )}
        <h4>Question by question</h4>
        {rows.map((x, i)=>(
          <details key={i} className="iv-q"><summary><b>{i + 1}.</b> {x.q} <span className="chip" style={{ marginLeft: 8 }}>{x.skipped ? "skipped" : x.score + "/10"}</span></summary>
            {x.answer && <p><b>You said:</b> {x.answer}</p>}
            {x.good && <p>✅ {x.good}</p>}
            {x.improve && <p>🔧 {x.improve}</p>}
            {x.ideal && <p><b>Model answer:</b> {x.ideal}</p>}
          </details>
        ))}
        <div className="pyq-acts"><button className="btn btn-p" onClick={again} data-testid="iv-again">Practise again</button></div>
        <p className="pyq-note small">Scores are an AI's judgement of your speech-to-text, so treat them as practice feedback, not a prediction.</p>
      </div>
    )
  }

  // live
  const q = qs[idx]
  const label = { speaking: "Aria is speaking…", listening: SR ? "Your turn. Speak, I'm listening" : "Your turn. Type your answer", thinking: "Aria is thinking…" }[phase]
  return (
    <div className="card iv-live" data-testid="iv-live">
      <div className="iv-bar"><span>Question {idx + 1} of {qs.length}{q?.topic ? " · " + q.topic : ""}</span><button className="btn btn-ghost btn-sm" onClick={endNow} data-testid="iv-end">End interview</button></div>
      <div className={"iv-stage " + phase}>
        <div className="iv-avatar" aria-hidden="true"><i /><i /><i /><span>A</span></div>
        <div className="iv-name">Aria <em>· Interviewer</em></div>
        <div className="iv-status">{label}</div>
        <div className="iv-question" data-testid="iv-question">{q?.q}</div>
        {camOn && <div className="iv-pip"><video ref={videoRef} autoPlay muted playsInline /><em>You · not recorded</em></div>}
      </div>
      {phase === "listening" && (
        <div className="iv-answer">
          <div className="iv-meter"><i style={{ width: Math.min(100, elapsed / MAX_ANSWER_SECS * 100) + "%" }} /><span>{mmss(elapsed)}</span></div>
          {SR ? <div className="iv-live-text" data-testid="iv-live-text">{live || <span style={{ opacity: .5 }}>…</span>}</div>
              : <textarea className="input" rows={3} value={typed} onChange={e=>{ setTyped(e.target.value); S.text = e.target.value }} placeholder="Type your answer…" />}
          <div className="pyq-acts">
            <button className="btn btn-p" onClick={()=>finishAnswer(false)} data-testid="iv-done">✅ Done answering</button>
            <button className="btn" onClick={repeat}>🔁 Repeat question</button>
            <button className="btn btn-ghost" onClick={()=>finishAnswer(true)} data-testid="iv-skip">⏭ Skip</button>
          </div>
          <p className="pyq-note small">Tip: look at the camera lens, not the screen. If you pause for a few seconds, Aria moves on.</p>
        </div>
      )}
      {phase === "thinking" && <div className="iv-answer"><Spin /> Reading your answer…</div>}
      {note && <div className="form-err">{note}</div>}
    </div>
  )
}
