import { useState, useEffect } from "react"
import { useLocalState } from "./lib.jsx"

/* ---------------- UI language (English / Hinglish) ---------------- */
const DICT = {
  en: {
    badge: n=>`${n} AI-powered study tools · one upload`,
    h1: "Your PDF, awake.",
    sub: "Upload one PDF and get a tutor, quizzes, flashcards and dozens more study tools — all answering from your own pages, not from the internet's guesses.",
    drop: "📄 Drop a PDF here, or click to browse",
    cta: "Upload a PDF — start studying",
    how: "See how it works ↓",
    s1: "AI tools", s2: "Grounded in your docs", s3: "Setup required",
    n_how: "How it works", n_try: "Try demo", n_feat: "Features", n_price: "Pricing", n_road: "Roadmap", n_faq: "FAQ",
    sticky: "Study smarter from your own PDFs", sticky_btn: "Try it free",
  },
  hi: {
    badge: n=>`${n} AI study tools · bas ek upload`,
    h1: "Aapka PDF, ab jaag gaya.",
    sub: "Ek PDF upload karo aur pao tutor, quiz, flashcards aur bahut saare study tools — sab jawab tumhare apne pages se, internet ke andaazon se nahi.",
    drop: "📄 PDF yahan drop karo, ya click karke chuno",
    cta: "PDF upload karo — padhai shuru",
    how: "Kaise kaam karta hai ↓",
    s1: "AI tools", s2: "Tumhare docs par based", s3: "Setup ki zaroorat",
    n_how: "Kaise chalta hai", n_try: "Demo try karo", n_feat: "Features", n_price: "Pricing", n_road: "Roadmap", n_faq: "FAQ",
    sticky: "Apne PDFs se smart padho", sticky_btn: "Free try karo",
  },
}
export function useUiLang(){
  const [lang, setLang] = useLocalState("ml_uilang", "en")
  const l = lang === "hi" ? "hi" : "en"
  const t = (k, ...a)=>{ const v = DICT[l][k] ?? DICT.en[k]; return typeof v === "function" ? v(...a) : v }
  return { lang: l, setLang, t }
}
export function UiLangToggle(){
  const { lang, setLang } = useUiLang()
  return (
    <div className="uilang" role="group" aria-label="Interface language">
      <button className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={()=>setLang("en")}>EN</button>
      <button className={lang === "hi" ? "on" : ""} aria-pressed={lang === "hi"} onClick={()=>setLang("hi")}>हिं</button>
    </div>
  )
}

/* ---------------- sticky CTA on the landing page ---------------- */
export function StickyCta({ onAuth }){
  const [show, setShow] = useState(false)
  const { t } = useUiLang()
  useEffect(()=>{
    const f = ()=>{
      const y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight
      setShow(y > 720 && y < max - 700)
    }
    f(); window.addEventListener("scroll", f, { passive:true }); return ()=>window.removeEventListener("scroll", f)
  },[])
  return (
    <div className={"sticky-cta" + (show ? " show" : "")} aria-hidden={!show}>
      <span>{t("sticky")}</span>
      <button className="btn btn-p btn-sm" tabIndex={show ? 0 : -1} onClick={onAuth}>{t("sticky_btn")}</button>
    </div>
  )
}

