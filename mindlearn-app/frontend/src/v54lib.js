// Pure helpers for v54: audio revision text, setup wizard result, share-card text.
export function stripMd(md){
  return String(md || "").replace(/```[\s\S]*?```/g, " ").replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/[*_`>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "").replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}
/* split into speakable chunks (<= max chars), at sentence/line ends, since long utterances get cut by browsers */
export function chunkText(text, max = 180){
  const parts = stripMd(text).split(/(?<=[.!?।])\s+|\n+/).map(s=>s.trim()).filter(Boolean)
  const out = []
  let cur = ""
  parts.forEach(p=>{
    if(p.length > max){ if(cur){ out.push(cur); cur = "" } for(let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max)); return }
    if((cur + " " + p).trim().length > max){ out.push(cur); cur = p } else cur = (cur + " " + p).trim()
  })
  if(cur) out.push(cur)
  return out
}
export const audioPrompt = (focus, hi)=>`Write a spoken revision script (about 250 words) from the uploaded document${focus ? `, focusing on: ${focus}` : ""}. Use ONLY the document. Plain sentences like a friendly teacher talking: no markdown, no bullet symbols, no headings, no emojis. Start with "Let's revise." and finish with one line recap.${hi ? " Speak in simple Hinglish (Hindi in Roman letters)." : ""}`
export const EXAM_PRESETS = { NEET: 4, JEE: 5, Boards: 3, UPSC: 6, GATE: 4, CAT: 3, Other: 2 }
export function wizardResult({ exam, date, hours }){
  return { coach: { exam, date: date || "", hours: +hours || EXAM_PRESETS[exam] || 3 }, goals: { daily: Math.max(3, Math.min(20, Math.round((+hours || 3) * 3))), exam: exam || null } }
}
export function cardText({ kind, big, sub, who }){
  const k = { quiz: "Quiz score", duel: "Duel", mock: "Timed mock", streak: "Streak" }[kind] || "MindLearn"
  return { k, big: String(big).slice(0, 12), sub: String(sub || "").slice(0, 60), who: String(who || "").slice(0, 24) }
}
