import { useEffect, useState } from "react"
import { toast, useLocalState } from "./lib.jsx"
import { FOCUS_OPTS, BREAK_OPTS, roomUrl, decodeRoom, phaseAt, clock } from "./roomlib.js"

const LABEL = { waiting: "Starting soon", focus: "🎯 Focus", break: "☕ Break", done: "✅ Session complete" }
function Clock({ room }){
  const [now, setNow] = useState(Date.now())
  useEffect(()=>{ const t = setInterval(()=>setNow(Date.now()), 500); return ()=>clearInterval(t) }, [])
  const p = phaseAt(room, now)
  useEffect(()=>{ document.title = p.state === "focus" || p.state === "break" ? `${clock(p.left)} ${p.state} · MindLearn` : "MindLearn AI" }, [p.state, p.left])
  return (
    <div className={"room-clock " + p.state} data-testid="room-clock">
      <span>{LABEL[p.state]}</span>
      <b>{p.state === "done" ? "🎉" : clock(p.left)}</b>
      {p.state !== "done" && <small>Round {Math.max(1, p.cycle)} of {p.total}</small>}
    </div>
  )
}

export default function RoomTab(){
  const [name, setName] = useLocalState("ml_duel_name", "")
  const [title, setTitle] = useState("")
  const [focus, setFocus] = useState(25)
  const [brk, setBrk] = useState(5)
  const [cycles, setCycles] = useState(4)
  const [room, setRoom] = useState(null)
  const create = ()=>{ setRoom({ host: name.trim() || "A friend", title: title.trim() || "Study session", start: Date.now() + 10000, focus, brk, cycles }) }
  const send = async ()=>{
    const url = roomUrl(room), text = `${room.host} is studying: "${room.title}". Join the same timer 📚`
    try{ if(navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)){ await navigator.share({ title: "MindLearn Study Room", text, url }); return } }catch(e){ if(e?.name === "AbortError") return }
    try{ await navigator.clipboard.writeText(url); toast("Room link copied! Dost ko bhejo 📚", "success") }catch(e){ window.prompt("Copy this link:", url) }
  }
  if(room) return (
    <div className="card duel-done">
      <h3>📚 {room.title}</h3>
      <Clock room={room} />
      <div className="duel-actions"><button type="button" className="btn btn-p" onClick={send}>Invite a friend</button><button type="button" className="btn" onClick={()=>setRoom(null)}>End room</button></div>
      <p className="coach-note">Dost ke link kholte hi uska timer bhi isi ke saath chalega (same start time se). Ek dusre ko dikhte nahi, bas saath padhte ho. Dono ke phone/laptop ki clock sahi honi chahiye.</p>
    </div>
  )
  return (
    <div className="card duel-setup">
      <h3>📚 Study room</h3>
      <p>Dost ke saath same Pomodoro timer pe padho. Link bhejo, dono ka focus aur break ek saath chalega.</p>
      <label>Tumhara naam<input value={name} onChange={e=>setName(e.target.value)} maxLength={30} placeholder="Ritik" /></label>
      <label>Kya padh rahe ho?<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={60} placeholder="e.g. Physics revision" /></label>
      <label>Focus (min)<div className="room-opts">{FOCUS_OPTS.map(v=><button type="button" key={v} className={"chip" + (focus === v ? " on" : "")} onClick={()=>setFocus(v)}>{v}</button>)}</div></label>
      <label>Break (min)<div className="room-opts">{BREAK_OPTS.map(v=><button type="button" key={v} className={"chip" + (brk === v ? " on" : "")} onClick={()=>setBrk(v)}>{v}</button>)}</div></label>
      <label>Rounds: {cycles}<input type="range" min="1" max="8" value={cycles} onChange={e=>setCycles(+e.target.value)} /></label>
      <button type="button" className="btn btn-p" onClick={create}>Start room</button>
    </div>
  )
}

export function RoomPage({ id }){
  const room = decodeRoom(id)
  return (
    <main className="static-page share-page" style={{ maxWidth: 560, margin: "0 auto", padding: "96px 18px 60px" }} data-testid="room-page">
      {!room ? <div className="card" role="alert">Ye room link kharab hai. Dost se dobara link maango.</div> : (
        <div className="card duel-done">
          <p className="pyq-note small" style={{ margin: 0 }}>{room.host} ke saath padho</p>
          <h2 style={{ fontSize: "1.6rem" }}>📚 {room.title}</h2>
          <Clock room={room} />
          <p className="coach-note">{room.focus} min focus · {room.brk} min break · {room.cycles} rounds</p>
          <a className="btn" href="#/">Try MindLearn AI</a>
        </div>
      )}
    </main>
  )
}
