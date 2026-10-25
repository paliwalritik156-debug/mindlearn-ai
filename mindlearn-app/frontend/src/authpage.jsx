import { useState, useEffect, useRef, useMemo } from "react"
import { api, setAuthToken, sounds, toast } from "./lib.jsx"
import { LegalModal } from "./production.jsx"
import { Logo } from "./startup.jsx"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function strength(p){
  const checks = [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)]
  const n = checks.filter(Boolean).length
  return { checks, score: p.length < 6 ? Math.min(1, n) : n, label: ["Too weak", "Weak", "Okay", "Good", "Strong"][p.length < 6 ? Math.min(1, n) : n] }
}

/* Mindy: reacts to what you're doing */
function AuthMindy({ mood }){
  // mood: idle | hide (typing a hidden password) | happy | sad
  const eye = mood === "hide" ? <><path d="M38 46 q6 -5 12 0" className="am-lid"/><path d="M70 46 q6 -5 12 0" className="am-lid"/></> :
    mood === "happy" ? <><path d="M38 48 q6 -8 12 0" className="am-lid"/><path d="M70 48 q6 -8 12 0" className="am-lid"/></> :
    <><circle cx="44" cy="46" r="5" className="am-eye"/><circle cx="76" cy="46" r="5" className="am-eye"/></>
  return (
    <svg className={"am am-" + mood} viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
      <line x1="60" y1="8" x2="60" y2="22" className="am-ant"/><circle cx="60" cy="7" r="5" className="am-tip"/>
      <rect x="20" y="22" width="80" height="70" rx="26" className="am-head"/>
      <rect x="28" y="32" width="64" height="44" rx="18" className="am-face"/>
      {eye}
      {mood === "sad" ? <path d="M50 66 q10 -7 20 0" className="am-mouth"/> : mood === "hide" ? <path d="M52 64 h16" className="am-mouth"/> : <path d="M50 62 q10 9 20 0" className="am-mouth"/>}
      {mood === "hide" && <><ellipse cx="34" cy="60" rx="12" ry="14" className="am-hand"/><ellipse cx="86" cy="60" rx="12" ry="14" className="am-hand"/></>}
      <rect x="40" y="94" width="40" height="16" rx="8" className="am-body"/>
    </svg>
  )
}

function Field({ id, label, type = "text", value, onChange, error, ok, autoComplete, right, onFocus, onBlur, autoFocus, ...rest }){
  return (
    <div className={"af" + (error ? " bad" : ok ? " good" : "") + (value ? " has" : "")}>
      <input id={id} className="af-in" type={type} value={value} onChange={onChange} placeholder=" " autoComplete={autoComplete} autoFocus={autoFocus}
        aria-invalid={!!error} aria-describedby={error ? id + "-e" : undefined} onFocus={onFocus} onBlur={onBlur} {...rest} />
      <label htmlFor={id}>{label}</label>
      {right}
      {ok && !error && <span className="af-ok" aria-hidden="true">✓</span>}
      {error && <div className="af-err" id={id + "-e"} role="alert">{error}</div>}
    </div>
  )
}

export default function AuthPage({ onClose, onAuthed, onGuest }){
  const [mode, setMode] = useState("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState(()=>{ try{ return localStorage.getItem("ml_remember_email") || "" }catch(e){ return "" } })
  const [remember, setRemember] = useState(()=>{ try{ return !!localStorage.getItem("ml_remember_email") }catch(e){ return false } })
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [touched, setTouched] = useState({})
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [shake, setShake] = useState(0)
  const [pwFocus, setPwFocus] = useState(false)
  const [legal, setLegal] = useState(null)
  const [forgot, setForgot] = useState(false)
  const [resetMsg, setResetMsg] = useState("")
  const [resetBusy, setResetBusy] = useState(false)
  const reg = mode === "register"
  const st = useMemo(()=>strength(password), [password])
  const mark = k=>setTouched(t=>({ ...t, [k]: true }))

  useEffect(()=>{
    const f = e=>{ if(e.key === "Escape" && !legal) onClose() }
    window.addEventListener("keydown", f); document.body.style.overflow = "hidden"
    return ()=>{ window.removeEventListener("keydown", f); document.body.style.overflow = "" }
  },[legal])
  useEffect(()=>{ setErr(""); setTouched({}); setForgot(false); setResetMsg("") },[mode])

  const errs = {
    name: reg && !name.trim() ? "Tell us your name" : "",
    email: !email ? "Enter your email" : !EMAIL_RE.test(email.trim()) ? "That doesn't look like a valid email" : "",
    password: !password ? "Enter a password" : reg && password.length < 8 ? "Use at least 8 characters" : password.length < 6 ? "At least 6 characters" : "",
  }
  const valid = !errs.name && !errs.email && !errs.password

  async function sendReset(){
    if(!EMAIL_RE.test(email.trim())){ setTouched(t=>({ ...t, email:1 })); setErr("Type your email in the box above first."); return }
    setErr(""); setResetBusy(true)
    try{
      const { data } = await api.post("/auth/forgot", { email: email.trim() })
      setResetMsg(data?.email_enabled === false ? "Email sending isn't set up on this server yet, so no email was sent. Please contact the site owner." : "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder. It works for 30 minutes.")
    }catch(ex){
      setErr(ex?.response?.status === 429 ? (ex.response.data?.detail || "Too many requests. Try again later.") : "Couldn't send the link right now. Please try again.")
    }finally{ setResetBusy(false) }
  }
  async function submit(e){
    e.preventDefault()
    setTouched({ name:1, email:1, password:1 })
    if(!valid){ setShake(n=>n + 1); sounds.error && sounds.error(); return }
    setErr(""); setBusy(true)
    try{
      const body = reg ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password }
      const { data } = await api.post(reg ? "/auth/register" : "/auth/login", body)
      setAuthToken(data.access_token)
      try{ remember ? localStorage.setItem("ml_remember_email", email.trim()) : localStorage.removeItem("ml_remember_email") }catch(e){}
      if(reg){ try{ localStorage.removeItem("ml_onboarded") }catch(e){} }
      setDone(true); sounds.success && sounds.success()
      setTimeout(()=>onAuthed(data), 900)
    }catch(ex){
      const s = ex?.response?.status, d = ex?.response?.data?.detail
      let m = typeof d === "string" ? d : ""
      if(!ex?.response) m = "Can't reach the server. Check your internet or try again in a moment."
      else if(s === 401 || /invalid|incorrect|wrong/i.test(m)) m = "Wrong email or password."
      else if(s === 409 || /already|exists|registered/i.test(m)) m = "This email already has an account. Try signing in instead."
      else if(s >= 500) m = "Our server had a hiccup. Please try again."
      else if(!m) m = "Something went wrong. Check your details and try again."
      setErr(m); setShake(n=>n + 1); sounds.error && sounds.error()
    }finally{ setBusy(false) }
  }

  const mood = done ? "happy" : err ? "sad" : pwFocus && !show ? "hide" : "idle"
  const showErr = k=>(touched[k] ? errs[k] : "")
  const eyeBtn = <button type="button" className="af-eye" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={()=>setShow(s=>!s)}>{show ? "🙈" : "👁️"}</button>

  return (
    <div className="authpage" role="dialog" aria-modal="true" aria-label={reg ? "Create account" : "Sign in"}>
      <div className="authpage-glow" />
      <div className="auth-orbs" aria-hidden="true"><i /><i /><i /></div>
      <button className="authpage-close" aria-label="Close" onClick={onClose}>✕</button>
      <div className="authpage-grid">
        <div className="authpage-left">
          <div className="authpage-logo"><Logo size={30} id="aplg" /> MindLearn <span>AI</span></div>
          <h1>{reg ? "Start studying smarter today." : "Welcome back. Let's pick up where you left off."}</h1>
          <p className="auth-lead">{reg ? "Free to start. No credit card. Your first PDF is one click away." : "Your notes, flashcards, streak and progress are waiting."}</p>
          <ul className="authpage-benefits">
            <li><b>🔒</b><span>Your documents stay private to your account</span></li>
            <li><b>🆓</b><span>Free plan, no card needed</span></li>
            <li><b>🧠</b><span>Tutor, quizzes, flashcards and more from one upload</span></li>
            <li><b>📈</b><span>Streaks, levels and real progress tracking</span></li>
          </ul>
          <div className="auth-mindy"><AuthMindy mood={mood} /><div className="auth-bubble" aria-live="polite">{done ? (reg ? "Welcome aboard! 🎉" : "Welcome back! ✨") : err ? "Hmm, let's try that again." : mood === "hide" ? "I'm not looking, promise 🙈" : reg ? "Hi! I'm Mindy, your study buddy." : "Good to see you again!"}</div></div>
        </div>
        <div className="authpage-right">
          <div className={"authpage-card" + (shake ? " shake" : "")} key={"c" + shake}>
            <div className={"authpage-tabs seg-" + mode} role="tablist">
              <i aria-hidden="true" />
              <button role="tab" aria-selected={!reg} className={!reg ? "active" : ""} onClick={()=>setMode("login")}>Sign In</button>
              <button role="tab" aria-selected={reg} className={reg ? "active" : ""} onClick={()=>setMode("register")}>Create Account</button>
            </div>
            {done ? (
              <div className="auth-done"><div className="auth-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M14 27 l8 8 l16 -18" /></svg></div><b>{reg ? "Account created" : "Signed in"}</b><span>Taking you in…</span></div>
            ) : (
              <form onSubmit={submit} className="authpage-form" noValidate>
                {reg && <Field id="a-name" label="Full name" value={name} onChange={e=>setName(e.target.value)} onBlur={()=>mark("name")} error={showErr("name")} ok={touched.name && !errs.name} autoComplete="name" autoFocus />}
                <Field id="a-email" label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={()=>mark("email")} error={showErr("email")} ok={touched.email && !errs.email} autoComplete={reg ? "email" : "username"} autoFocus={!reg} inputMode="email" />
                <Field id="a-pw" label="Password" type={show ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)}
                  onFocus={()=>setPwFocus(true)} onBlur={()=>{ setPwFocus(false); setCaps(false); mark("password") }}
                  onKeyUp={e=>setCaps(!!e.getModifierState?.("CapsLock"))} error={showErr("password")} autoComplete={reg ? "new-password" : "current-password"} right={eyeBtn} />
                {caps && <div className="af-caps" role="status">⇪ Caps Lock is on</div>}
                {reg && password && (
                  <div className="pw-meter" aria-live="polite">
                    <div className="pw-bars">{[1, 2, 3, 4].map(i=><i key={i} className={i <= st.score ? "on s" + st.score : ""} />)}</div>
                    <span className={"pw-label s" + st.score}>{st.label}</span>
                    <ul className="pw-list">
                      {["8+ characters", "Upper & lowercase", "A number", "A symbol"].map((t, i)=><li key={t} className={st.checks[i] ? "ok" : ""}>{st.checks[i] ? "✓" : "○"} {t}</li>)}
                    </ul>
                  </div>
                )}
                <div className="auth-row">
                  <label className="auth-check-l"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> Remember my email</label>
                  {!reg && <button type="button" className="auth-link" onClick={()=>setForgot(f=>!f)}>Forgot password?</button>}
                </div>
                {forgot && (
                  <div className="auth-note" role="status">
                    {resetMsg ? resetMsg : <>Enter your email above and we'll send you a link to set a new password.{" "}
                      <button type="button" className="auth-link" disabled={resetBusy} onClick={sendReset}>{resetBusy ? "Sending…" : "Send reset link"}</button></>}
                  </div>
                )}
                {err && <div className="auth-err" role="alert">⚠️ {err}{/already/i.test(err) && <button type="button" className="auth-link" onClick={()=>setMode("login")}>Sign in</button>}</div>}
                <button className="btn btn-p auth-submit" disabled={busy} type="submit">{busy ? <><span className="auth-spin" aria-hidden="true" /> Please wait…</> : (reg ? "Create my account →" : "Sign in →")}</button>
                <div className="auth-or"><span>or</span></div>
                <button type="button" className="btn btn-ghost auth-guest" onClick={onGuest}>👀 Try the live demo first (no account)</button>
                <p className="auth-fine">{reg ? <>By creating an account you agree to our <button type="button" className="auth-link" onClick={()=>setLegal("terms")}>Terms</button> and <button type="button" className="auth-link" onClick={()=>setLegal("privacy")}>Privacy Policy</button>.</> : <>New here? <button type="button" className="auth-link" onClick={()=>setMode("register")}>Create a free account</button></>}</p>
              </form>
            )}
          </div>
        </div>
      </div>
      {legal && <LegalModal kind={legal} onClose={()=>setLegal(null)} />}
    </div>
  )
}
