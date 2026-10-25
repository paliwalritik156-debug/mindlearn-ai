import { useEffect, useState, useCallback } from "react"
import { api, toast, useLocalState, askText, langInstruction } from "./lib.jsx"
import Rich from "./rich.jsx"

const go = k => window.dispatchEvent(new CustomEvent("ml-goto", { detail: k }))

/* ---------------- document picker (multi-PDF library on the server) ---------------- */
export function DocPicker(){
  const [open, setOpen] = useState(false)
  const [lib, setLib] = useState(null)       // null = unknown / old backend
  const [usage, setUsage] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async()=>{
    try{ const { data } = await api.get("/library", { silent:true }); setLib(data) }catch(e){ setLib(null) }
    try{ const { data } = await api.get("/usage", { silent:true }); setUsage(data) }catch(e){}
  },[])
  useEffect(()=>{ load() },[])
  useEffect(()=>{ const f = ()=>load(); window.addEventListener("ml-library", f); return ()=>window.removeEventListener("ml-library", f) },[load])
  useEffect(()=>{ if(open) load() },[open])
  if(!lib || !lib.docs) return null
  const active = lib.docs.filter(d=>d.active)
  const toggle = async id=>{
    const cur = new Set(active.map(d=>d.id)); cur.has(id) ? cur.delete(id) : cur.add(id)
    if(!cur.size){ toast("Keep at least one document on.", "error"); return }
    setBusy(true)
    try{ await api.put("/library/active", { doc_ids:[...cur] }); await load() }catch(e){ toast("Couldn't change the selection.", "error") }
    finally{ setBusy(false) }
  }
  const del = async d=>{
    if(!window.confirm(`Delete "${d.name}" from your library?`)) return
    setBusy(true)
    try{ await api.delete("/library/" + d.id); await load(); toast("Document deleted.", "ok") }catch(e){ toast("Couldn't delete it.", "error") }
    finally{ setBusy(false) }
  }
  const label = !lib.docs.length ? "No documents" : active.length === 1 ? active[0].name : `${active.length} documents`
  return (
    <div className="docpick">
      <button className="btn btn-ghost btn-sm" aria-expanded={open} aria-haspopup="true" onClick={()=>setOpen(o=>!o)}>📚 <span className="dp-label">{label}</span> ▾</button>
      {open && (
        <div className="dp-pop" role="dialog" aria-label="Your documents">
          <div className="dp-head"><b>Ask across…</b><button aria-label="Close" onClick={()=>setOpen(false)}>✕</button></div>
          {lib.docs.length === 0 && <p className="profile-email">Upload a PDF to get started.</p>}
          {lib.docs.map(d=>(
            <div key={d.id} className="dp-row">
              <label><input type="checkbox" checked={d.active} disabled={busy} onChange={()=>toggle(d.id)} /><span title={d.name}>{d.name}</span></label>
              <small>{d.pages}p{d.ocr ? " · OCR" : ""}</small>
              <button aria-label={"Delete " + d.name} disabled={busy} onClick={()=>del(d)}>🗑</button>
            </div>
          ))}
          <div className="dp-foot">
            <span>{lib.docs.length}/{lib.max} documents</span>
            {usage && usage.limit > 0 && <span title="Resets every day">AI today: {usage.used}/{usage.limit}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- quick ask (Home) ---------------- */
export function QuickAsk(){
  const [q, setQ] = useState("")
  const sug = ["Summarise my document", "What are the key terms?", "Quiz me on the hardest part"]
  const ask = t=>{ const v = (t ?? q).trim(); if(!v) return; try{ localStorage.setItem("ml_prefill", v) }catch(e){}; setQ(""); go("chat") }
  return (
    <div className="quickask">
      <form onSubmit={e=>{ e.preventDefault(); ask() }}>
        <span aria-hidden="true">✨</span>
        <input aria-label="Ask a question about your document" placeholder="Ask anything about your document…" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="btn btn-p btn-sm" type="submit" disabled={!q.trim()}>Ask</button>
      </form>
      <div className="qa-sug">{sug.map(s=><button key={s} className="chip" onClick={()=>ask(s)}>{s}</button>)}</div>
    </div>
  )
}

/* ---------------- first win: instant summary right after the first upload ---------------- */
export function FirstWin(){
  const [doc] = useLocalState("ml_doc", "")
  const [done, setDone] = useLocalState("ml_firstwin", "")
  const [txt, setTxt] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(false)
  const run = useCallback(async()=>{
    setBusy(true); setErr(false)
    try{ setTxt(String(await askText("Summarise this document in 5 short bullet points a student can read in 30 seconds. " + langInstruction())).trim()) }
    catch(e){ setErr(true) } finally{ setBusy(false) }
  },[])
  const name = typeof doc === "string" ? doc : ""
  useEffect(()=>{ if(name && done !== name && !txt && !busy) run() },[name])
  if(!name || done === name) return null
  return (
    <div className="firstwin">
      <div className="fw-head"><b>⚡ Here's your document in 30 seconds</b><button aria-label="Dismiss" onClick={()=>setDone(name)}>✕</button></div>
      {busy && <p className="profile-email">Reading <b>{name}</b>…</p>}
      {err && <p className="profile-email">Couldn't summarise right now. <button className="auth-link" onClick={run}>Try again</button></p>}
      {txt && <Rich text={txt} />}
      {txt && <div className="fw-acts"><button className="btn btn-p btn-sm" onClick={()=>go("flashcards")}>🗂️ Make flashcards</button><button className="btn btn-ghost btn-sm" onClick={()=>go("quiz")}>🎯 Take a quiz</button><button className="btn btn-ghost btn-sm" onClick={()=>go("chat")}>💬 Ask a question</button></div>}
    </div>
  )
}
