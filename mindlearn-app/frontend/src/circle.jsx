import { useEffect, useState, useCallback } from "react"
import { api, toast, Spin, useLocalState } from "./lib.jsx"
import { weekStart, weekPoints, normCode, medal } from "./circlelib.js"
import { streakOf } from "./core.js"

function readLS(k, d){ try{ return JSON.parse(localStorage.getItem(k) || "null") ?? d }catch(e){ return d } }

export default function CircleTab(){
  const [name, setName] = useLocalState("ml_duel_name", "")
  const [mine, setMine] = useState(null)
  const [open, setOpen] = useState(null)      // code
  const [board, setBoard] = useState(null)
  const [cname, setCname] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const loadMine = useCallback(()=>api.get("/circle/mine", { silent: true }).then(r=>{ setMine(r.data); if(r.data.length && !open) setOpen(r.data[0].code) }).catch(()=>setMine([])), [open])
  useEffect(()=>{ loadMine() }, [])
  const loadBoard = useCallback(async c=>{
    if(!c) return setBoard(null)
    try{
      const act = readLS("ml_activity", []), sc = readLS("ml_scores", [])
      await api.post(`/circle/${c}/score`, { week: weekStart(), points: weekPoints(act, sc), streak: streakOf(act) }, { silent: true })
      setBoard((await api.get(`/circle/${c}`, { silent: true })).data)
    }catch(e){ setBoard(null) }
  }, [])
  useEffect(()=>{ loadBoard(open) }, [open])
  const create = async ()=>{
    if(cname.trim().length < 2) return toast("Circle ka naam likho")
    setBusy(true)
    try{ const { data } = await api.post("/circle/create", { name: cname.trim(), display: name.trim() }); setCname(""); await loadMine(); setOpen(data.code); toast(`Circle ban gaya! Code: ${data.code}`, "success") }
    catch(e){ toast(e?.response?.data?.detail || "Circle nahi ban paya") }
    setBusy(false)
  }
  const join = async ()=>{
    const c = normCode(code); if(c.length !== 6) return toast("6 akshar ka code daalo")
    setBusy(true)
    try{ await api.post("/circle/join", { code: c, display: name.trim() }); setCode(""); await loadMine(); setOpen(c); toast("Circle join ho gaya 🎉", "success") }
    catch(e){ toast(e?.response?.data?.detail || "Join nahi ho paya") }
    setBusy(false)
  }
  const leave = async c=>{
    if(!window.confirm("Is circle se bahar niklu?")) return
    try{ await api.post(`/circle/${c}/leave`, {}); setOpen(null); setBoard(null); await loadMine() }catch(e){ toast("Nahi ho paya") }
  }
  const invite = async c=>{
    const text = `Join my MindLearn study circle! Code: ${c}  (MindLearn AI → Circles → Join)  https://mindlearn-ai.vercel.app`
    try{ if(navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)){ await navigator.share({ text }); return } }catch(e){ if(e?.name === "AbortError") return }
    try{ await navigator.clipboard.writeText(text); toast("Invite copy ho gaya, dost ko bhejo", "success") }catch(e){ window.prompt("Copy this:", text) }
  }
  return (
    <div className="card tb" data-testid="circle">
      <h3>👥 Study circles</h3>
      <p>Dosto ke saath weekly leaderboard. Points tumhari padhai (chat, quiz, mock) se banti hain aur har Monday reset hoti hain. Sirf tumhara display naam dikhta hai, email nahi.</p>
      <label>Tumhara naam (circle me dikhega)<input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="Ritik" /></label>
      {mine === null && <Spin />}
      {mine && mine.length > 0 && <div className="room-opts">{mine.map(m=><button type="button" key={m.code} className={"chip" + (open === m.code ? " on" : "")} onClick={()=>setOpen(m.code)}>{m.name} · {m.members}</button>)}</div>}
      {board && (
        <div className="circle-board" data-testid="circle-board">
          <div className="coach-plan-head"><h4 style={{ margin: 0 }}>{board.name}</h4><span>Code <b>{board.code}</b> · week of {board.week}</span></div>
          {board.members.map((m, i)=>(
            <div key={i} className={"circle-row" + (m.me ? " me" : "")}><span className="cr-r">{medal(i)}</span><span className="cr-n">{m.display}{m.me ? " (you)" : ""}</span><span className="cr-s">{m.streak ? `🔥 ${m.streak}` : ""}</span><b>{m.points} pts</b></div>
          ))}
          <div className="duel-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}><button type="button" className="btn btn-p btn-sm" onClick={()=>invite(board.code)}>Invite friends</button><button type="button" className="btn btn-sm" onClick={()=>loadBoard(open)}>Refresh</button><button type="button" className="btn btn-sm" onClick={()=>leave(board.code)}>Leave</button></div>
        </div>
      )}
      <div className="duel-setup" style={{ padding: 0 }}>
        <label>Naya circle banao<input value={cname} onChange={e=>setCname(e.target.value)} maxLength={24} placeholder="e.g. NEET batch 2027" /></label>
        <button type="button" className="btn btn-p" onClick={create} disabled={busy}>Create circle</button>
        <label>Ya code se join karo<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123" /></label>
        <button type="button" className="btn" onClick={join} disabled={busy}>Join</button>
      </div>
      <p className="coach-note">Points tumhare browser se aate hain, to ye dosti ka khel hai, tamper-proof competition nahi. Ek circle me max 30 log.</p>
    </div>
  )
}
