// Pure helpers for the live interview: prompts, parsing and speech statistics.
export const TYPES = [
  { key: "pdf",  icon: "📄", en: "Viva on my PDF",       hi: "Mere PDF pe viva",       hint: "Questions come from your uploaded document" },
  { key: "hr",   icon: "🤝", en: "HR / Behavioural",     hi: "HR / Behavioural",       hint: "Tell me about yourself, strengths, teamwork" },
  { key: "tech", icon: "💻", en: "Technical round",      hi: "Technical round",        hint: "Add a role or subject below, e.g. Python developer" },
  { key: "resume", icon: "📋", en: "Resume interview",   hi: "Resume interview",       hint: "Paste your resume or upload it. Aria asks about YOUR projects, skills and gaps" },
  { key: "upsc", icon: "🏛️", en: "UPSC / Board panel",   hi: "UPSC / Board panel",     hint: "Opinion, ethics and current-affairs style questions" },
]
export const COUNTS = [3, 5, 7]
export const MAX_ANSWER_SECS = 120
export const SILENCE_MS = 4000

const FILLERS = ["um", "umm", "uh", "uhh", "erm", "like", "basically", "actually", "you know", "matlab", "mtlb", "toh", "yaani"]

export function wordCount(text){ return (String(text || "").trim().match(/\S+/g) || []).length }
export function fillerCount(text){
  const t = " " + String(text || "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ") + " "
  let n = 0
  FILLERS.forEach(f=>{ const m = t.split(" " + f + " ").length - 1; if(m > 0) n += m })
  return n
}
export function wpm(words, secs){ return secs >= 3 ? Math.round(words / (secs / 60)) : 0 }
export function paceLabel(v){ return !v ? "" : v < 90 ? "slow" : v > 170 ? "fast" : "good" }

export const RESUME_MAX = 6000
export const cleanResume = t=>String(t || "").replace(/\s+/g, " ").trim().slice(0, RESUME_MAX)
export function questionsPrompt({ type, focus, n, lang, resume }){
  const t = TYPES.find(x=>x.key === type) || TYPES[0]
  const about = type === "pdf" ? "Base EVERY question on the uploaded document's content (use what you can see in it)." :
    type === "resume" ? `Base EVERY question on this candidate's resume. Ask about specific projects, claimed skills, numbers, internships, and gaps, the way a real recruiter would probe. Mix 1 easy warm-up with deeper follow-ups. Do not invent facts that are not in it.\nRESUME:\n"""${cleanResume(resume)}"""` :
    type === "hr" ? "Typical HR and behavioural questions (introduction, strengths, weakness, conflict, goals)." :
    type === "tech" ? "Technical questions that test understanding, not trivia." :
    "Panel-style questions: opinion, ethics, administration and current affairs."
  return `You are Aria, a friendly but sharp interviewer. Interview type: ${t.en}. Focus: ${focus || "general"}. ${about}
Write exactly ${n} questions that get gradually harder. Each must be short enough to say aloud (max 25 words) and answerable by speaking for 30 to 90 seconds. ${lang || ""}
Return ONLY JSON like {"questions":[{"q":"...","topic":"2-3 words"}]}`
}
export function parseQuestions(data, n){
  const arr = Array.isArray(data) ? data : (data?.questions || [])
  const out = arr.map(x=> typeof x === "string" ? { q: x, topic: "" } : { q: String(x?.q || x?.question || "").trim(), topic: String(x?.topic || "").trim() })
    .filter(x=>x.q.length >= 8)
  return out.slice(0, n)
}
export function evalPrompt({ type, question, answer, secs, lang }){
  return `You are Aria, an interviewer. Judge the candidate's spoken answer fairly. ${type === "pdf" ? "Judge accuracy against the uploaded document." : ""} ${lang || ""}
QUESTION: ${question}
CANDIDATE ANSWER (speech-to-text, may contain small recognition errors; ignore those): ${answer}
They spoke for ${secs} seconds.
Return ONLY JSON: {"score":0-10,"reaction":"one short natural sentence a real interviewer would say next, max 16 words, no score","good":"what was good, one line","improve":"the single most useful fix, one line","ideal":"a model answer in 2 sentences"}`
}
export function parseEval(data){
  if(!data || typeof data !== "object") return null
  let s = Number(data.score)
  if(!isFinite(s)) return null
  s = Math.max(0, Math.min(10, Math.round(s * 10) / 10))
  const str = k=>String(data[k] || "").trim()
  return { score: s, reaction: str("reaction") || "Okay, thank you.", good: str("good"), improve: str("improve"), ideal: str("ideal") }
}
export function skipped(){ return { score: 0, reaction: "No problem, let's move on.", good: "", improve: "You skipped this one. Even a short attempt earns marks in a real interview.", ideal: "", skipped: true } }

export function summaryPrompt(rows, lang){
  return `You are Aria. A candidate finished a mock interview. Scores out of 10:\n${rows.map((r, i)=>`${i + 1}. ${r.q} -> ${r.score}`).join("\n")}\n${lang || ""}
Return ONLY JSON: {"verdict":"2 encouraging but honest sentences","strengths":["...","..."],"work_on":["...","..."]}`
}
export function parseSummary(data){
  if(!data || typeof data !== "object") return null
  const list = x=>Array.isArray(x) ? x.map(String).filter(Boolean).slice(0, 3) : []
  return { verdict: String(data.verdict || "").trim(), strengths: list(data.strengths), work_on: list(data.work_on) }
}

export function report(rows){
  const done = rows.filter(r=>!r.skipped)
  const avg = rows.length ? Math.round(rows.reduce((a, r)=>a + r.score, 0) / rows.length * 10) / 10 : 0
  const words = done.reduce((a, r)=>a + (r.words || 0), 0), secs = done.reduce((a, r)=>a + (r.secs || 0), 0)
  const fill = done.reduce((a, r)=>a + (r.fillers || 0), 0)
  const pace = wpm(words, secs)
  const best = rows.length ? rows.reduce((a, r)=>r.score > a.score ? r : a, rows[0]) : null
  const worst = rows.length ? rows.reduce((a, r)=>r.score < a.score ? r : a, rows[0]) : null
  return { avg, pct: Math.round(avg * 10), pace, paceLabel: paceLabel(pace), fillers: fill, fillerPer100: words ? Math.round(fill / words * 1000) / 10 : 0, answered: done.length, total: rows.length, best, worst }
}
