import { useState } from "react"
import { api, setAuthToken, toast } from "./lib.jsx"

// Page opened from the link in the reset email: #/reset?token=...
export default function ResetPassword({ token, onDone }){
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  async function submit(e){
    e.preventDefault(); setErr("")
    if(pw.length < 8) return setErr("Use at least 8 characters.")
    if(pw !== pw2) return setErr("The two passwords don't match.")
    setBusy(true)
    try{
      const { data } = await api.post("/auth/reset", { token, password: pw })
      setAuthToken(data.access_token)
      history.replaceState(null, "", location.pathname)
      toast("Password changed. You're signed in.", "ok")
      onDone(data)
    }catch(ex){
      setErr(!ex?.response ? "Can't reach the server. Try again in a moment." : (ex.response.data?.detail || "Something went wrong."))
    }finally{ setBusy(false) }
  }
  return (
    <main className="static-page" id="main-content" tabIndex={-1}>
      <h1>Set a new password</h1>
      <form className="card reset-card" onSubmit={submit}>
        <label className="reset-l">New password<input className="inp" type="password" autoComplete="new-password" value={pw} onChange={e=>setPw(e.target.value)} autoFocus /></label>
        <label className="reset-l">Repeat it<input className="inp" type="password" autoComplete="new-password" value={pw2} onChange={e=>setPw2(e.target.value)} /></label>
        {err && <div className="auth-err" role="alert">⚠️ {err}</div>}
        <button className="btn btn-p" disabled={busy} type="submit">{busy ? "Saving…" : "Save password"}</button>
        <p className="profile-email">Link expired? Go back, tap “Forgot password?” and request a new one.</p>
        <a className="btn btn-ghost btn-sm" href="#/" onClick={()=>{ history.replaceState(null, "", location.pathname); window.dispatchEvent(new Event("hashchange")) }}>← Back to home</a>
      </form>
    </main>
  )
}
