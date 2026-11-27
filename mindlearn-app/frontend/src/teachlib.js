// Pure helpers for Teach-it-back (Feynman technique): the AI plays a curious student.
export function teachPrompt(topic, history, explanation, hi){
  const h = (history || []).slice(-6).map(m=>(m.role === "you" ? "TEACHER: " : "STUDENT: ") + m.text).join("\n")
  return `You are a curious, slightly confused student. The user is your TEACHER and is explaining "${topic}" to you. Judge ONLY what the teacher actually said; do not add facts they omitted when scoring. Be kind but honest.
${h ? "Conversation so far:\n" + h + "\n" : ""}TEACHER: ${explanation}
Reply with ONLY JSON: {"reply":"your reaction as the student in 1-3 short sentences, then ONE follow-up question that probes the biggest gap or vague part","clarity":0-100,"accuracy":0-100,"depth":0-100,"gaps":["concept the teacher missed or was vague on (max 3)"],"errors":["factual mistake the teacher made, if any (max 3)"]}
${hi ? "Write reply, gaps and errors in simple Hinglish (Hindi in Roman letters)." : ""}`
}
const clamp = v=>Math.max(0, Math.min(100, Math.round(+v || 0)))
export function parseTeach(v){
  if(!v || typeof v !== "object" || Array.isArray(v) || !v.reply) return null
  return { reply: String(v.reply).slice(0, 600), clarity: clamp(v.clarity), accuracy: clamp(v.accuracy), depth: clamp(v.depth),
    gaps: (Array.isArray(v.gaps) ? v.gaps : []).map(String).slice(0, 3), errors: (Array.isArray(v.errors) ? v.errors : []).map(String).slice(0, 3) }
}
export const overall = t=>Math.round(t.clarity * .3 + t.accuracy * .45 + t.depth * .25)
export const grade = n=>n >= 85 ? "You could teach this ✨" : n >= 65 ? "Getting there 👍" : n >= 40 ? "Shaky, fill the gaps" : "Revise first 📖"
