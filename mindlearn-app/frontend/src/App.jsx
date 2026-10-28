import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { api, setAuthToken, sounds, isSoundOn, setSoundOn, useLocalState, useDark, Spin, ALL_FUNCTION_KEYS, toast, uploadPdfs, syncPull, syncPushSoon } from "./lib.jsx"

import { savePdfs } from "./pdfstore.js"

import AuthPage from "./authpage.jsx"
import { useUiLang, UiLangToggle, StickyCta } from "./lang.jsx"
import { useSpotlight, ScrollProgress, Words, NavLinks, UseCases, BeforeAfter, Pricing, Compare, ProfilePanel, Logo, Roadmap, ScrollBook } from "./startup.jsx"
import { NotifCenter, useApplyTheme, LiveDemo, StoryScroll, FactsStrip, GrainMesh } from "./lite.jsx"

import { ToastHost, UploadStrip, LegalModal } from "./production.jsx"
const HeroScene = lazy(()=>import("./HeroScene.jsx"))
const AmbientBG = lazy(()=>import("./AmbientBG.jsx"))
const Dashboard = lazy(()=>import("./dashboard.jsx"))
const StaticPage = lazy(()=>import("./pages.jsx"))
import { usePage, useHash, resetToken, isAdminRoute } from "./route.js"
import { FeedbackButton } from "./v30.jsx"
const AdminPage = lazy(()=>import("./v30.jsx"))
const ResetPassword = lazy(()=>import("./reset.jsx"))
import { applyPerf, isLite } from "./perf.js"
import { applyHinglish } from "./hinglish.js"
import { startTelemetry, track } from "./telemetry.js"
import { startStudyTimer } from "./studytime.js"
import { startReminders } from "./reminders.js"

function extractText(data){
  if(!data) return ""
  if(typeof data === "string") return data
  return data.answer || data.reply || data.response || data.notes || data.essay || data.explanation ||
         data.result || data.text || data.content || JSON.stringify(data)
}

/* ============================= FunHeader ============================= */
function Reveal({ children, className="", index=0 }){
  const ref = useRef()
  const [shown, setShown] = useState(false)
  useEffect(()=>{
    const el = ref.current
    if(!el) return
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting) setShown(true) })
    }, { threshold:0.15 })
    obs.observe(el)
    return ()=>obs.disconnect()
  },[])
  return <div ref={ref} className={`reveal ${shown?"in":""} ${className}`} style={{ transitionDelay: shown ? `${Math.min(index,6)*70}ms` : "0ms" }}>{children}</div>
}

/* ============================= Tilt card (3D hover) ============================= */
function Tilt({ children, className="", strength=10 }){
  const ref = useRef()
  function onMove(e){
    const el = ref.current
    if(!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left)/r.width - 0.5
    const py = (e.clientY - r.top)/r.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${px*strength}deg) rotateX(${-py*strength}deg) translateY(-4px)`
  }
  function onLeave(){
    const el = ref.current
    if(el) el.style.transform = ""
  }
  return (
    <div ref={ref} className={"tilt " + className} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  )
}

/* ============================= Marquee strip ============================= */
function MarqueeStrip(){
  const items = ["Chat","Notes","Flashcards","Quiz","Essay Writer","Code Debugger","Mock Interview","Spaced Repetition","Concept Map","YouTube Notes","Self-Debate","Study Planner"]
  const loop = [...items, ...items]
  return (
    <div className="marquee">
      <div className="marquee-track">
        {loop.map((it,i)=>(<span key={i} className="marquee-item">{it}</span>))}
      </div>
    </div>
  )
}

/* ============================= Ripple button wrapper ============================= */
function onBtnRipple(e){
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const span = document.createElement("span")
  const size = Math.max(rect.width, rect.height)
  span.className = "ripple"
  span.style.width = span.style.height = size + "px"
  span.style.left = (e.clientX - rect.left - size/2) + "px"
  span.style.top = (e.clientY - rect.top - size/2) + "px"
  btn.appendChild(span)
  setTimeout(()=>span.remove(), 600)
}

/* ============================= Auth Modal (full screen) ============================= */
const kbd = fn => e=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); fn(e) } }

/* ============================= Nav ============================= */
function Nav({ dark, setDark, user, onMenu, onAuth, onProfile, landing, onOpenApp }){
  const [scrolled, setScrolled] = useState(false)
  const { t: navT } = useUiLang()
  useEffect(()=>{
    const onScroll = ()=> setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", onScroll)
    return ()=>window.removeEventListener("scroll", onScroll)
  },[])
  return (
    <nav className={"nav" + (scrolled ? " scrolled" : "")}>
      <div className="nav-left">
        <button className="dash-menu-btn" onClick={onMenu}>☰</button>
        <div className="logo"><Logo size={26} id="nvg" /> MindLearn <span>AI</span></div>
      </div>
      {landing && <NavLinks t={navT} />}
      <div className="nav-right">
        <UiLangToggle />
        <button className="icon-btn" aria-label="Toggle theme" onClick={()=>setDark(d=>!d)}>{dark ? "🌙" : "☀️"}</button>
        <NotifCenter />
        {user ? (
          <>{landing && onOpenApp && <button className="btn btn-p btn-sm" onClick={onOpenApp}>Dashboard →</button>}<button className="btn btn-ghost btn-sm" onClick={onProfile}>{user.name?.split(" ")[0] || "Profile"}</button></>
        ) : (
          <button className="btn btn-p btn-sm" onClick={onAuth}>Sign In</button>
        )}
      </div>
    </nav>
  )
}

/* ============================= Hero / Landing ============================= */
function Hero({ onUpload, uploading, user, onAuth }){
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()
  const heroRef = useRef()
  const [heading, setHeading] = useState("")
  const { t } = useUiLang()
  const fullHeading = t("h1")
  const [spot, setSpot] = useState({ x: 50, y: 50 })

  useEffect(()=>{
    let i = 0
    const chars = "!<>-_\\/[]{}—=+*^?#"
    const id = setInterval(()=>{
      setHeading(fullHeading.slice(0,i).split("").map((c,idx)=> idx > i-3 && Math.random()>0.5 ? chars[Math.floor(Math.random()*chars.length)] : c).join(""))
      i++
      if(i > fullHeading.length){ clearInterval(id); setHeading(fullHeading) }
    }, 28)
    return ()=>clearInterval(id)
  },[fullHeading])

  // phones: tilt the hero card with the device's gyroscope (Android; iOS needs a permission we don't ask for)
  useEffect(()=>{
    const h = e=>{
      if(e.gamma == null || !heroRef.current) return
      heroRef.current.style.setProperty("--px", Math.max(-1, Math.min(1, e.gamma / 30)))
      heroRef.current.style.setProperty("--py", Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30)))
    }
    if(!("ontouchstart" in window)) return
    window.addEventListener("deviceorientation", h); return ()=>window.removeEventListener("deviceorientation", h)
  },[])

  function onMove(e){
    const r = heroRef.current?.getBoundingClientRect()
    if(!r) return
    setSpot({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 })
    // -1..1 mouse offset from hero centre, drives layered depth parallax in CSS
    r && heroRef.current.style.setProperty("--px", (((e.clientX - r.left)/r.width) - 0.5) * 2)
    r && heroRef.current.style.setProperty("--py", (((e.clientY - r.top)/r.height) - 0.5) * 2)
    // magnetic CTA buttons: pull gently towards the cursor when it is near
    if(window.matchMedia && window.matchMedia("(pointer: fine)").matches){
      heroRef.current.querySelectorAll(".hero-cta-row .btn").forEach(b=>{
        const br = b.getBoundingClientRect()
        const cx = br.left + br.width/2, cy = br.top + br.height/2
        const dx = e.clientX - cx, dy = e.clientY - cy
        const dist = Math.hypot(dx, dy)
        if(dist < 130){ b.style.translate = (dx*0.22)+"px "+(dy*0.3)+"px" }
        else b.style.translate = ""
      })
    }
  }
  function onLeave(){
    heroRef.current?.querySelectorAll(".hero-cta-row .btn").forEach(b=>{ b.style.translate = "" })
  }

  function handleFiles(files){
    if(!user){ onAuth(); return }
    if(files && files.length) onUpload(files)
  }

  return (
    <section className="hero" ref={heroRef} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ "--spot-x": spot.x+"%", "--spot-y": spot.y+"%" }}>
      <div className="hero-spotlight" />
      <div className="hero-fade" />
      <div className="hero-grid">
        <div className="hero-text">
          <div className="badge">{t("badge", ALL_FUNCTION_KEYS.length - 2)}</div>
          <h1 className="scramble-heading">{heading}</h1>
          <RotatingWords/>
          <p className="hero-sub">{t("sub")}</p>
          <div className={"dropzone" + (dragOver ? " drag" : "")}
            onDragOver={e=>{ e.preventDefault(); setDragOver(true) }}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{ e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={()=>fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="application/pdf" multiple hidden onChange={e=>handleFiles(e.target.files)} />
            {uploading ? <Spin/> : <>{t("drop")}</>}
          </div>
          <div className="hero-cta-row">
            <button className="btn btn-p" onClick={()=>fileRef.current?.click()}>{t("cta")}</button>
            <a href="#how-it-works" className="btn btn-ghost">{t("how")}</a>
          </div>
          <div className="hero-stats">
            <div><b><CountUp to={ALL_FUNCTION_KEYS.length - 2}/></b><span>{t("s1")}</span></div>
            <div><b><CountUp to={100} suffix="%"/></b><span>{t("s2")}</span></div>
            <div><b><CountUp to={0}/></b><span>{t("s3")}</span></div>
          </div>
        </div>
        <div className="hero-visual">
          {!isLite() && <Suspense fallback={null}><HeroScene energy={dragOver || uploading}/></Suspense>}
          <div className="hero-orb" aria-hidden="true"><i/><i/><i/></div>
          <div className="hero-visual-ring" />
          <DemoWalkthrough/>
          <div className="hero-float-card hero-float-2">
            <b>96%</b> quiz score
          </div>
          <div className="hero-float-card hero-float-3">
            🔥 7-day streak
          </div>
        </div>
      </div>
      <MarqueeStrip/>
      <a href="#how-it-works" className="scroll-hint" aria-label="Scroll to how it works"><span/></a>
    </section>
  )
}

function CountUp({ to, suffix="", duration=1400 }){
  const [v, setV] = useState(0)
  useEffect(()=>{
    let raf, start
    const delay = setTimeout(()=>{
      const step = (ts)=>{
        if(!start) start = ts
        const p = Math.min((ts - start)/duration, 1)
        setV(Math.round(to * (1 - Math.pow(1-p, 3))))
        if(p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, 650)
    return ()=>{ clearTimeout(delay); cancelAnimationFrame(raf) }
  },[to, duration])
  return <>{v}{suffix}</>
}

function RotatingWords(){
  const words = ["a patient tutor","a pop quiz","a flashcard deck","a debate partner","a code reviewer","a study planner"]
  const [i, setI] = useState(0)
  useEffect(()=>{
    const id = setInterval(()=>setI(n=>(n+1)%words.length), 2300)
    return ()=>clearInterval(id)
  },[])
  return (
    <div className="hero-rotor">
      <span className="hero-rotor-pre">It becomes</span>
      <span className="hero-rotor-word" key={i}>{words[i]}</span>
    </div>
  )
}

/* Live demo window: types out a question + grounded answer, then loops */
function ChatPreview(){
  const demos = [
    { q:"Why do plants need chlorophyll?", a:"Chlorophyll absorbs red and blue light and uses that energy to turn CO₂ and water into glucose.", src:"Biology.pdf · p. 42" },
    { q:"Explain Big-O like I'm 5", a:"It's how much slower a task gets as the pile grows. Sorting 10 toys is easy; 10,000 takes way longer.", src:"Algorithms.pdf · p. 7" },
    { q:"Quiz me on the French Revolution", a:"Q1. Which event on 14 July 1789 marked the start of the Revolution?  A) Tennis Court Oath  B) Storming of the Bastille", src:"History.pdf · p. 118" },
  ]
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState("")
  const [phase, setPhase] = useState("typing")
  useEffect(()=>{
    const d = demos[i]
    if(phase === "typing"){
      if(typed.length < d.a.length){
        const t = setTimeout(()=>setTyped(d.a.slice(0, typed.length + 2)), 22)
        return ()=>clearTimeout(t)
      }
      const t = setTimeout(()=>setPhase("hold"), 2400)
      return ()=>clearTimeout(t)
    }
    const t = setTimeout(()=>{ setTyped(""); setI(n=>(n+1)%demos.length); setPhase("typing") }, 200)
    return ()=>clearTimeout(t)
  },[typed, phase, i])
  const d = demos[i]
  return (
    <div className="chat-preview">
      <div className="cp-bar"><span/><span/><span/><div className="cp-title">{d.src.split(" · ")[0]}</div></div>
      <div className="cp-body">
        <div className="cp-q">{d.q}</div>
        <div className="cp-a">{typed}{phase==="typing" && <i className="cp-caret"/>}</div>
        {phase==="hold" || typed.length >= d.a.length ? <div className="cp-src">📎 {d.src}</div> : null}
      </div>
    </div>
  )
}

/* Sample walkthrough: upload → summary → quiz → flashcard. Illustrative content, labelled as a sample. */
function DemoWalkthrough(){
  const stages = ["Upload","Summary","Quiz","Flashcard"]
  const [s, setS] = useState(0)
  const [video, setVideo] = useState(false)
  // Drop a real screen recording at public/demo.mp4 and it replaces this sample automatically
  useEffect(()=>{
    fetch("/demo.mp4", { method:"HEAD" }).then(r=>{ if(r.ok && (r.headers.get("content-type")||"").startsWith("video")) setVideo(true) }).catch(()=>{})
  },[])
  useEffect(()=>{
    if(video) return
    const id = setTimeout(()=>setS(n=>(n+1)%stages.length), 3600)
    return ()=>clearTimeout(id)
  },[s, video])
  if(video) return (
    <div className="chat-preview demo-wt">
      <div className="cp-bar"><span/><span/><span/><div className="cp-title">Product walkthrough · sample document</div></div>
      <video className="wt-video" autoPlay muted loop playsInline preload="auto"><source src="/demo.webm" type="video/webm" /><source src="/demo.mp4" type="video/mp4" /></video>
    </div>
  )
  return (
    <div className="chat-preview demo-wt">
      <div className="cp-bar"><span/><span/><span/><div className="cp-title">Sample walkthrough</div></div>
      <div className="wt-tabs" role="tablist">
        {stages.map((n,i)=>(
          <button key={n} role="tab" aria-selected={i===s} className={"wt-tab"+(i===s?" on":"")} onClick={()=>setS(i)}>{i+1}. {n}</button>
        ))}
      </div>
      <div className="cp-body wt-body" key={s}>
        {s===0 && (
          <>
            <div className="wt-file"><span>📄</span><div><b>Biology_Ch4.pdf</b><i>Reading your document…</i></div></div>
            <div className="wt-progress"><div/></div>
            <div className="cp-src">✓ Indexed and ready</div>
          </>
        )}
        {s===1 && (
          <>
            <div className="wt-h">Key points</div>
            <ul className="wt-list">
              <li style={{"--i":0}}>Chlorophyll absorbs red and blue light</li>
              <li style={{"--i":1}}>Light reactions make ATP + NADPH</li>
              <li style={{"--i":2}}>Calvin cycle fixes CO₂ into glucose</li>
            </ul>
          </>
        )}
        {s===2 && (
          <>
            <div className="wt-h">Where does the Calvin cycle happen?</div>
            <div className="wt-opts">
              <div className="wt-opt">Thylakoid membrane</div>
              <div className="wt-opt right">Stroma</div>
              <div className="wt-opt">Mitochondria</div>
            </div>
          </>
        )}
        {s===3 && (
          <div className="wt-card"><div className="wt-card-in">
            <div className="wt-face front">What does chlorophyll absorb?</div>
            <div className="wt-face back">Red and blue light</div>
          </div></div>
        )}
      </div>
      <div className="wt-note">Illustrative sample</div>
    </div>
  )
}

function SoundToggle(){
  const [on, setOn] = useState(isSoundOn())
  return (
    <button className={"sound-toggle"+(on?" on":"")} aria-pressed={on} aria-label={on?"Turn sound off":"Turn sound on"}
      title={on?"Sound on":"Sound off"}
      onClick={()=>{ const n = !on; setSoundOn(n); setOn(n); if(n) sounds.pop() }}>
      {on ? "🔊" : "🔇"}
    </button>
  )
}

/* Soft glow that follows the cursor (fine pointers only) */
function CursorGlow(){
  const ref = useRef()
  useEffect(()=>{
    if(!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let x = innerWidth/2, y = innerHeight/2, tx = x, ty = y, raf
    const mv = e=>{ tx = e.clientX; ty = e.clientY }
    window.addEventListener("mousemove", mv)
    const tick = ()=>{
      x += (tx - x) * 0.14; y += (ty - y) * 0.14
      if(ref.current) ref.current.style.transform = `translate3d(${x-210}px,${y-210}px,0)`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return ()=>{ window.removeEventListener("mousemove", mv); cancelAnimationFrame(raf) }
  },[])
  return <div className="cursor-glow" ref={ref} aria-hidden="true" />
}

function HowItWorks(){
  const steps = [
    { n:"1", icon:"📄", title:"Upload your PDF", body:"Lecture notes, a textbook chapter, past papers — anything you need to study." },
    { n:"2", icon:"🧭", title:"Pick a tool", body:"Dozens of ways in: chat, quiz, flashcards, essay, code debugger, mock interview, and more." },
    { n:"3", icon:"🚀", title:"Study, grounded", body:"Every answer traces back to your document — no generic, made-up explanations." },
  ]
  return (
    <section className="section" id="how-it-works">
      <Words text="From PDF to understanding, in three steps" />
      <div className="steps-grid">
        {steps.map((s,i)=>(
          <Reveal key={i} index={i}>
            <div className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function SubjectCloud(){
  const subjects = ["Engineering","Medicine & NEET","Law","MBA & Case Studies","JEE / Competitive Exams","Computer Science","Humanities","Finance & CA","UPSC & Civil Services","School Boards"]
  return (
    <section className="section subject-section">
      <Words text="Built for whatever you're studying" />
      <Reveal>
        <div className="subject-cloud">
          {subjects.map((s,i)=>(<span key={i} className="subject-pill">{s}</span>))}
        </div>
      </Reveal>
    </section>
  )
}

function FeatureShowcase(){
  const feats = [
    { icon:"💬", title:"Conversational, not robotic", body:"Ask follow-ups like you would a tutor — the chat remembers context across the session, and switches personality on request.", big:true },
    { icon:"🗂️", title:"Every format you use", body:"Notes, flashcards, quizzes, essays, code — generated from the same source." },
    { icon:"🔁", title:"Built for retention", body:"Spaced repetition schedules reviews before you forget, not after." },
    { icon:"💻", title:"Code tools included", body:"Debug, review and generate code from the same workspace." },
    { icon:"⚡", title:"Zero setup", body:"Upload a PDF, start studying. No config, no templates to fill in." },
  ]
  return (
    <section className="section" id="features">
      <Words text="What's actually in here" />
      <div className="bento-grid">
        {feats.map((f,i)=>(
          <Reveal key={i} index={i} className={f.big ? "bento-big" : ""}>
            <Tilt className="feature-card" strength={6}>
              <div className="feature-icon">{f.icon}</div><h3>{f.title}</h3><p>{f.body}</p>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Avatar({ name, gradient }){
  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2)
  return <div className="testi-avatar" style={{ background: gradient }}>{initials}</div>
}

function Testimonials(){
  const quotes = [
    { name:"Priya S.", role:"Final-year CS student", text:"I used the code debugger more than my actual IDE during finals week.", g:"linear-gradient(135deg, var(--v), var(--cy))" },
    { name:"Arjun M.", role:"NEET aspirant", text:"Spaced repetition on my biology notes genuinely changed how much I retained.", g:"linear-gradient(135deg, var(--pink), var(--amber))" },
    { name:"Neha K.", role:"MBA student", text:"The self-debate tool prepped me better for case discussions than re-reading slides ever did.", g:"linear-gradient(135deg, var(--cy), var(--pink))" },
  ]
  return (
    <section className="section">
      <Words text="Who it's for" />
      <div className="testi-grid">
        {quotes.map((q,i)=>(
          <Reveal key={i} index={i}>
            <Tilt className="testi-card" strength={5}>
              <p>"{q.text}"</p>
              <div className="testi-person">
                <Avatar name={q.name} gradient={q.g} />
                <div>
                  <div className="testi-name">{q.name}</div>
                  <div className="testi-role">{q.role}</div>
                </div>
              </div>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function FAQ(){
  const [open, setOpen] = useState(null)
  const faqs = [
    { q:"Is my document private?", a:"Your PDFs are tied to your account. To answer your questions, parts of the text are sent to an AI provider (Groq). A copy for page highlighting stays only in your browser. Please don't upload anything you aren't allowed to share." },
    { q:"What files can I upload?", a:"PDFs up to 50 MB. Scanned PDFs that are just images aren't readable yet. Paste a YouTube link separately for video notes." },
    { q:"Is it free?", a:"Yes, everything is free right now. A Pro plan is planned for cloud sync and scanned PDFs, but it isn't on sale yet." },
    { q:"Which languages does it answer in?", a:"English, Hinglish and Hindi. Switch any time from the sidebar or Settings." },
    { q:"Can the AI be wrong?", a:"Yes. It can misread a page or make mistakes, so check important facts against your source. Answers link to the closest matching page of your PDF to make that easy." },
    { q:"Does it work offline?", a:"You can install it as an app. Saved notes, decks and your library open offline, but AI answers need an internet connection." },
    { q:"Do I need to sign up to try it?", a:"You can try the sample demo on this page without an account. Uploading your own document needs a free account." },
  ]
  return (
    <section className="section" id="faq">
      <Words text="Questions" />
      <div className="faq-list">
        {faqs.map((f,i)=>(
          <div key={i} className={"faq-item" + (open===i ? " open" : "")}>
            <button className="faq-q" aria-expanded={open===i} onClick={()=>setOpen(o=>o===i?null:i)}><span>{f.q}</span><i aria-hidden="true">{open===i ? "−" : "+"}</i></button>
            {open===i && <div className="faq-a">{f.a}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}

function CTABanner({ onAuth }){
  return (
    <section className="cta-banner">
      <Reveal>
        <h2>Upload your next exam's worth of material.</h2>
        <p className="cta-sub">Free to start. Your first quiz is a minute away.</p>
        <button className="btn btn-p" onClick={onAuth}>Get started free</button>
      </Reveal>
    </section>
  )
}

function FooterEnhanced({ onAuth }){
  const [legal, setLegal] = useState(null)
  const scrollTo = id=>()=>{ const el = document.getElementById(id); el ? el.scrollIntoView({ behavior:"smooth", block:"start" }) : window.scrollTo({ top:0, behavior:"smooth" }) }
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-col footer-brand">
          <div className="logo">MindLearn <span>AI</span></div>
          <p>Your documents, understood.</p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <button className="footer-link" onClick={scrollTo("how-it-works")}>How it works</button>
          <button className="footer-link" onClick={scrollTo("features")}>Features</button>
          <button className="footer-link" onClick={scrollTo("pricing")}>Pricing</button>
          <button className="footer-link" onClick={scrollTo("faq")}>FAQ</button>
        </div>
        <div className="footer-col">
          <h4>Account</h4>
          <button className="footer-link" onClick={onAuth}>Sign in / Create account</button>
        </div>
        <div className="footer-col">
          <h4>Legal</h4>
          <button className="footer-link" onClick={()=>setLegal("privacy")}>Privacy Policy</button>
          <button className="footer-link" onClick={()=>setLegal("terms")}>Terms of Use</button>
          <a className="footer-link" href="#/about">About</a>
          <a className="footer-link" href="#/contact">Contact</a>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} MindLearn AI. Answers are AI-generated, so verify important facts.</div>
      {legal && <LegalModal kind={legal} onClose={()=>setLegal(null)} />}
    </footer>
  )
}

/* ============================= Dashboard shell ============================= */
export default function App(){
  const [dark, setDark] = useDark()
  useApplyTheme()
  useSpotlight()
  const [ok, setOk] = useState(false)
  const [user, setUser] = useLocalState("ml_user", null)
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [portal, setPortal] = useState(false)

  useEffect(()=>{
    const token = localStorage.getItem("ml_token")
    if(token){
      setAuthToken(JSON.parse(token))
      // returning user with a processed PDF: go straight back to the dashboard
      api.get("/status").then(r=>{ if(r.data?.pdf_loaded) setOk(true) }).catch(()=>{ try{ if(localStorage.getItem("ml_doc")) setOk(true) }catch(e){} })
    }
    applyPerf(); startTelemetry(); startStudyTimer(); startReminders()
  },[])
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(()=>{ const a = ()=>setOnline(true), b = ()=>setOnline(false); window.addEventListener("online", a); window.addEventListener("offline", b); return ()=>{ window.removeEventListener("online", a); window.removeEventListener("offline", b) } },[])
  const page = usePage()
  useHash()
  const rToken = resetToken()
  const { lang: uiLang } = useUiLang()
  applyHinglish(uiLang)
  const lite = isLite()

  useEffect(()=>{
    const id = api.interceptors.response.use(
      r=>r,
      err=>{
        if(err?.response?.status === 401){
          localStorage.removeItem("ml_token")
          setAuthToken(null)
          setUser(null)
          setOk(false)
        }
        return Promise.reject(err)
      }
    )
    return ()=>api.interceptors.response.eject(id)
  },[])

  const [upPct, setUpPct] = useState(null)
  async function doUpload(files){
    setUploading(true); setUpPct(0)
    try{
      await uploadPdfs(files, setUpPct)
      savePdfs(files)
      try{ const names = Array.from(files).map(f=>f.name); localStorage.setItem("ml_doc", JSON.stringify(names.length>1 ? names[0]+" +"+(names.length-1) : names[0])) }catch(e){}
      // portal: expanding glow covers the page, dashboard mounts underneath, then it fades away
      setPortal(true)
      sounds.whoosh()
      setTimeout(()=>{ sounds.success() }, 700)
      setTimeout(()=>{ setOk(true); window.scrollTo(0,0) }, 750)
      setTimeout(()=>setPortal(false), 1500)
    }catch(ex){
      const st = ex?.response?.status
      toast(st === 401 ? "Please sign in first, then upload again." : (ex?.response?.data?.detail || ex?.message || "Upload failed. Please try again."), "error")
    }finally{ setUploading(false); setUpPct(null) }
  }

  function handleAuthed(data){
    localStorage.setItem("ml_token", JSON.stringify(data.access_token))
    setUser(data.user || { name: data.name, email: data.email })
    setShowAuth(false)
    if(pendingFiles){ doUpload(pendingFiles); setPendingFiles(null) }
  }

  function requestAuth(files){
    if(files) setPendingFiles(files)
    setShowAuth(true)
  }

  function logout(){
    localStorage.removeItem("ml_token")
    setAuthToken(null)
    setUser(null)
    setOk(false)
    setShowProfile(false)
  }

  // optional cloud sync: pull after sign-in, push (debounced) on any local data change
  useEffect(()=>{ if(user) syncPull() },[user?.email])
  useEffect(()=>{ const f = ()=>syncPushSoon(); window.addEventListener("ml-ls", f); return ()=>window.removeEventListener("ml-ls", f) },[])

  const [booting, setBooting] = useState(true)
  const [bootPct, setBootPct] = useState(0)
  useEffect(()=>{
    const t = setTimeout(()=>setBooting(false), 1700)
    const start = performance.now()
    const id = setInterval(()=>{
      const p = Math.min((performance.now()-start)/1250, 1)
      setBootPct(Math.round(100*(1-Math.pow(1-p,2))))
      if(p>=1) clearInterval(id)
    }, 40)
    return ()=>{ clearTimeout(t); clearInterval(id) }
  },[])

  return (
    <div className="app-root" onMouseDown={e=>{ const b = e.target.closest?.(".btn"); if(b) onBtnRipple({ currentTarget:b, clientX:e.clientX, clientY:e.clientY }) }}>
      <a className="skip-link" href="#main-content" onClick={e=>{ e.preventDefault(); const m = document.getElementById("main-content"); m?.focus(); m?.scrollIntoView() }}>Skip to content</a>
      <ToastHost/>
      <div className="up-fixed"><UploadStrip pct={upPct} /></div>
      {booting && (
        <div className={"app-loader" + (booting ? "" : " out")}>
          <div className="app-loader-mark"><Logo size={96} id="ldg" /></div>
          <div className="app-loader-logo">MindLearn <span>AI</span></div>
          <div className="app-loader-bar"><div style={{ width: bootPct+"%" }}/></div>
          <div className="app-loader-pct">{bootPct}%</div>
        </div>
      )}
      {portal && (
        <div className="portal">
          <div className="portal-core" />
          <div className="portal-text">Reading your PDF…</div>
        </div>
      )}
      {!ok && !lite && <Suspense fallback={null}><AmbientBG/></Suspense>}
      {!ok && <GrainMesh/>}
      {!ok && <ScrollProgress/>}
      <CursorGlow/>
      {!ok && <StickyCta onAuth={()=>requestAuth(null)} />}
      <SoundToggle/>
      <FeedbackButton/>
      {!online && <div className="offline-bar" role="status">📴 You're offline. Flashcards, notes, planner and sketch still work.</div>}
      <Nav onOpenApp={()=>setOk(true)} dark={dark} setDark={setDark} user={user} onMenu={()=>window.dispatchEvent(new Event("ml-menu"))} onAuth={()=>requestAuth(null)} onProfile={()=>setShowProfile(true)} landing={!ok} />

      {isAdminRoute() ? (
        <Suspense fallback={null}><AdminPage signedIn={!!user} /></Suspense>
      ) : rToken ? (
        <Suspense fallback={null}><ResetPassword token={rToken} onDone={data=>{ handleAuthed(data) }} /></Suspense>
      ) : page ? (
        <Suspense fallback={null}><StaticPage page={page} /></Suspense>
      ) : ok ? (
        <Suspense fallback={<div className="dash-loading" role="status" aria-live="polite" style={{ padding:60, textAlign:"center", color:"var(--text-dim)" }}>Loading your workspace…</div>}>
          <Dashboard key={uiLang} user={user} onLogout={logout} onProfile={()=>setShowProfile(true)} />
        </Suspense>
      ) : (
        <>
          <Hero onUpload={doUpload} uploading={uploading} user={user} onAuth={()=>requestAuth(null)} />
          <FactsStrip tools={ALL_FUNCTION_KEYS.length - 2} />
          <UseCases/>
          <StoryScroll/>
          <BeforeAfter/>
          <ScrollBook/>
          <LiveDemo/>
          <FeatureShowcase/>
          <Compare/>
          <SubjectCloud/>
          <Roadmap/>
          <Pricing onStart={()=>requestAuth(null)} />
          <FAQ/>
          <CTABanner onAuth={()=>requestAuth(null)} />
          <FooterEnhanced onAuth={()=>requestAuth(null)} />
        </>
      )}

      {showAuth && !rToken && <AuthPage onClose={()=>setShowAuth(false)} onAuthed={handleAuthed} onGuest={()=>{ setShowAuth(false); setTimeout(()=>document.getElementById("try")?.scrollIntoView({ behavior:"smooth" }), 150) }} />}
      {showProfile && <ProfilePanel user={user} onClose={()=>setShowProfile(false)} onLogout={logout} />}
    </div>
  )
}
