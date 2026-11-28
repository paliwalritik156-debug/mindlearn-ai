// Live Debate with Pari: prompts, parsing and scoring helpers (pure).
export const LEVELS = [
  { key: "friendly", label: "Friendly", hint: "Pari is gentle and encouraging" },
  { key: "tough", label: "Tough", hint: "Pari pushes back hard, like a real opponent" },
]
export const ROUNDS = [3, 4, 6]
const style = lvl=>lvl === "tough" ? "You are a sharp, confident debater. Challenge weak logic directly but stay respectful." : "You are warm and encouraging but still make real counter-arguments."
const talk = "Talk like a real person on a voice call: short sentences, contractions, natural reactions (\"Hmm\", \"Fair point, but...\"), no lists, no markdown, no emojis, no stage directions."
export const sideFor = (mine)=>mine === "For" ? "Against" : "For"
export function openingPrompt({ topic, aiSide, level, hi }){
  return `You are Pari, a friendly young woman debating with a student. Topic: "${topic}". You argue ${aiSide}. ${style(level)} ${talk}
Give your opening in 2-3 short sentences (max 45 words), then ask the student for their first argument.${hi ? " Speak in natural Hinglish (Hindi in Roman letters)." : ""}`
}
export function turnPrompt({ topic, aiSide, history, userText, level, round, rounds, hi }){
  const h = (history || []).slice(-6).map(m=>(m.role === "you" ? "STUDENT: " : "PARI: ") + m.text).join("\n")
  const last = round >= rounds
  return `You are Pari, debating ${aiSide} on "${topic}" against a student. ${style(level)} ${talk}
${h ? "So far:\n" + h + "\n" : ""}STUDENT: ${userText}
Round ${round} of ${rounds}.${last ? " This is the final round: give a brief closing line, no question." : " Rebut their point in 2-3 short sentences (max 50 words) and end with one pointed question."}
Also judge ONLY the student's last argument.
Reply with ONLY JSON: {"reply":"what Pari says out loud","logic":0-10,"evidence":0-10,"note":"one short coaching tip for the student (max 15 words)"}${hi ? "\nWrite reply and note in natural Hinglish (Hindi in Roman letters)." : ""}`
}
const n10 = v=>Math.max(0, Math.min(10, Math.round(+v || 0)))
export function parseTurn(v){
  if(!v || typeof v !== "object" || Array.isArray(v) || !v.reply) return null
  return { reply: String(v.reply).slice(0, 500), logic: n10(v.logic), evidence: n10(v.evidence), note: String(v.note || "").slice(0, 140) }
}
export function finalPrompt(topic, aiSide, rows, hi){
  const t = rows.map((r, i)=>`Round ${i + 1} student: ${r.text}`).join("\n")
  return `A student debated "${topic}" against Pari (who argued ${aiSide}). Their arguments:\n${t}\nJudge fairly. Reply with ONLY JSON: {"winner":"student|pari|draw","best":"their strongest point in one line","weak":"their weakest point in one line","tips":["2 specific tips"],"score":0-100}${hi ? "\nWrite in simple Hinglish." : ""}`
}
export function parseFinal(v){
  if(!v || typeof v !== "object" || Array.isArray(v)) return null
  const w = ["student", "pari", "draw"].includes(v.winner) ? v.winner : "draw"
  return { winner: w, best: String(v.best || "").slice(0, 220), weak: String(v.weak || "").slice(0, 220), tips: (Array.isArray(v.tips) ? v.tips : []).map(String).slice(0, 3), score: Math.max(0, Math.min(100, Math.round(+v.score || 0))) }
}
export function averages(rows){
  const r = rows.filter(x=>typeof x.logic === "number")
  if(!r.length) return { logic: 0, evidence: 0 }
  const a = k=>Math.round(r.reduce((s, x)=>s + x[k], 0) / r.length * 10) / 10
  return { logic: a("logic"), evidence: a("evidence") }
}
