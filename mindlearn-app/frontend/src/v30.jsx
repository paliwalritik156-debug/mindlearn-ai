import { useEffect, useState } from "react"
import { api, toast, Spin } from "./lib.jsx"

/* ---------- floating feedback button + form ---------- */
export function FeedbackButton(){
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState("idea")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(()=>{
    const f = ()=>setOpen(true)
    window.addEventListener("ml-feedback", f); return ()=>window.removeEventListener("ml-feedback", f)
  },[])
  useEffect(()=>{
    if(!open) return
    const f = e=>{ if(e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", f); return ()=>window.removeEventListener("keydown", f)
  },[open])
  async function send(){
    if(msg.trim().length < 3){ toast("Please write a few words first.", "error"); return }
    setBusy(true)
    try{
      await api.post("/feedback", { kind, message: msg.trim(), page: location.hash || "/" })
      toast("Thank you! We read every message. 💜", "success")
      setMsg(""); setOpen(false)
    }catch(e){
      if(e?.response?.status === 429) toast("You've sent a lot of messages. Please try again later.", "error")
      else if(e?.response?.data?.detail && typeof e.response.data.detail === "string") toast(e.response.data.detail, "error")
      else toast("Couldn't send right now. Please try again in a minute.", "error")
    }finally{ setBusy(false) }
  }
  return (
    <>
      <button className="fb-fab" onClick={()=>setOpen(true)} aria-label="Send feedback or report a problem" data-testid="fb-open">💬 <span>Feedback</span></button>
      {open && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Send feedback" onMouseDown={e=>{ if(e.target === e.currentTarget) setOpen(false) }}>
          <div className="fb-card">
            <h3 style={{ margin:"0 0 4px" }}>Tell us what's on your mind</h3>
            <p style={{ margin:"0 0 12px", color:"var(--text-dim)", fontSize:13.5 }}>Found a bug or have an idea? This goes straight to the person building MindLearn.</p>
            <div className="fb-kinds" role="radiogroup" aria-label="Type of message">
              {[["bug","🐞 Something's broken"],["idea","💡 Idea"],["other","💬 Other"]].map(([k, l])=>(
                <button key={k} role="radio" aria-checked={kind === k} className={"chip" + (kind === k ? " on" : "")} onClick={()=>setKind(k)}>{l}</button>
              ))}
            </div>
            <textarea className="inp" rows={5} maxLength={3000} autoFocus value={msg} onChange={e=>setMsg(e.target.value)} aria-label="Your message"
              placeholder={kind === "bug" ? "What happened? What did you click?" : "Write here…"} style={{ marginTop:10, resize:"vertical" }} data-testid="fb-text" />
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:12 }}>
              <button className="btn" onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn btn-p" disabled={busy} onClick={send} data-testid="fb-send">{busy ? <Spin/> : "Send"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- admin stats (#/admin) ---------- */
const when = t=>t ? new Date(t * 1000).toLocaleString() : ""
function Stat({ label, value, tone }){
  return <div className="ad-stat"><div className="ad-n" style={tone ? { color:tone } : null}>{value}</div><div className="ad-l">{label}</div></div>
}
export default function AdminPage({ signedIn }){
  const [d, setD] = useState(null)
  const [err, setErr] = useState("")
  const load = ()=>{
    setErr(""); setD(null)
    api.get("/admin/stats", { silent: true }).then(r=>setD(r.data)).catch(e=>{
      const s = e?.response?.status
      setErr(s === 403 ? "This account is not an admin. Add your email to ADMIN_EMAILS on the server." : s === 401 ? "Please sign in first." : "Couldn't load stats (the server may be waking up — try again in a minute).")
    })
  }
  useEffect(()=>{ if(signedIn) load(); else setErr("Please sign in first.") },[signedIn])
  return (
    <main className="static-page" style={{ maxWidth:980, margin:"0 auto", padding:"96px 18px 60px" }} data-testid="admin-page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <h1 style={{ margin:0, fontFamily:"var(--font-display)" }}>Admin</h1>
        <div style={{ display:"flex", gap:8 }}><button className="btn" onClick={load}>Refresh</button><a className="btn" href="#/">Back</a></div>
      </div>
      {err && <div className="card" style={{ marginTop:16 }} role="alert">{err}</div>}
      {!err && !d && <div style={{ marginTop:20 }}><Spin/> Loading…</div>}
      {d && (
        <>
          <div className="card" style={{ marginTop:16, fontSize:13.5, color:d.database.startsWith("postgres") ? "#34d399" : "#f59e0b" }}>
            Database: <b>{d.database}</b>
          </div>
          <div className="ad-grid">
            <Stat label="Users" value={d.users_total}/>
            <Stat label="New (7 days)" value={d.users_7d}/>
            <Stat label="New (24 h)" value={d.users_24h}/>
            <Stat label="Active today" value={d.active_users_today}/>
            <Stat label="AI requests today" value={d.ai_requests_today}/>
            <Stat label="Documents" value={d.docs_total}/>
            <Stat label="Uploads OK (7d)" value={d.uploads_7d_ok}/>
            <Stat label="Uploads failed (7d)" value={d.uploads_7d_failed} tone={d.uploads_7d_failed ? "#f87171" : null}/>
            <Stat label="Avg upload (s)" value={d.upload_avg_seconds_7d}/>
            <Stat label="App errors (7d)" value={d.errors_7d} tone={d.errors_7d ? "#f87171" : null}/>
            <Stat label="Feedback" value={d.feedback_total}/>
          </div>
          <h3>Feedback</h3>
          {d.recent_feedback.length === 0 && <p className="ad-empty">Nothing yet.</p>}
          {d.recent_feedback.map((f, i)=>(
            <div className="card ad-row" key={i}><b>{f.kind}</b> · {f.email || "anonymous"} · <span className="ad-t">{when(f.created)} · {f.page}</span><div style={{ marginTop:6, whiteSpace:"pre-wrap" }}>{f.message}</div></div>
          ))}
          <h3>Recent app errors</h3>
          {d.recent_errors.length === 0 && <p className="ad-empty">No errors reported. 🎉</p>}
          {d.recent_errors.map((f, i)=>(
            <div className="card ad-row" key={i}><b>{f.message}</b> <span className="ad-t">{when(f.created)} · {f.page}</span><pre className="ad-pre">{f.stack}</pre></div>
          ))}
          <h3>Failed uploads</h3>
          {d.recent_failed_uploads.length === 0 && <p className="ad-empty">None.</p>}
          {d.recent_failed_uploads.map((f, i)=>(
            <div className="card ad-row" key={i}><b>{f.name}</b> <span className="ad-t">{when(f.created)}</span><div>{f.error}</div></div>
          ))}
          <h3>Newest users</h3>
          {d.recent_users.map((f, i)=>(
            <div className="card ad-row" key={i}>{f.name} · {f.email} <span className="ad-t">{(f.created || "").slice(0, 16).replace("T", " ")}</span></div>
          ))}
        </>
      )}
    </main>
  )
}
