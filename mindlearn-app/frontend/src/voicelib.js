// Pure helpers: choose the most natural-sounding female voice available, and speak in a human rhythm.
const NATURAL = /natural|neural|online|enhanced|premium/i
const FEMALE = /female|woman|aria|jenny|neerja|swara|heera|zira|samantha|karen|moira|tessa|veena|serena|susan|ava|allison|google (uk english female|us english|हिन्दी|hindi)|sara|emma|libby|sonia|kalpana|lekha|priya/i
const MALE = /\bmale\b|david|mark|george|ryan|guy|prabhat|madhur|hemant|rishi|ravi|alex|daniel|fred|thomas|james/i
export function scoreVoice(v, lang){
  let s = 0
  const n = v.name || "", l = (v.lang || "").replace("_", "-")
  if(l.toLowerCase() === lang.toLowerCase()) s += 40
  else if(l.slice(0, 2).toLowerCase() === lang.slice(0, 2).toLowerCase()) s += 22
  else return -1
  if(NATURAL.test(n)) s += 50
  if(/google/i.test(n)) s += 18
  if(FEMALE.test(n)) s += 30
  if(MALE.test(n) && !FEMALE.test(n)) s -= 45
  if(/compact|espeak|robot|novelty|bad news|bubbles|whisper|zarvox|trinoids/i.test(n)) s -= 80
  if(v.localService === false) s += 4
  return s
}
export function rankVoices(voices, lang){
  return (voices || []).map(v=>({ v, s: scoreVoice(v, lang) })).filter(x=>x.s >= 0).sort((a, b)=>b.s - a.s).map(x=>x.v)
}
export const bestVoice = (voices, lang)=>rankVoices(voices, lang)[0] || null
/* split a reply into short natural phrases so the voice breathes between them */
export function phrases(text){
  const clean = String(text || "").replace(/[*_#`>~|]/g, " ").replace(/\s+/g, " ").trim()
  if(!clean) return []
  const out = []
  clean.split(/(?<=[.!?।…])\s+/).forEach(s=>{
    if(s.length <= 140){ out.push(s); return }
    let cur = ""; s.split(/(?<=[,;:—-])\s+/).forEach(p=>{ if((cur + " " + p).trim().length > 130){ if(cur) out.push(cur); cur = p } else cur = (cur + " " + p).trim() }); if(cur) out.push(cur)
  })
  return out.filter(Boolean)
}
/* tiny human variation: [rate, pitch] per phrase; questions rise a little, stays within a pleasant range */
export function prosody(phrase, i, base = { rate: 1, pitch: 1.08 }){
  const q = /\?\s*$/.test(phrase), ex = /!\s*$/.test(phrase)
  const j = ((i * 37) % 7) / 100          // deterministic 0..0.06 so tests are stable
  return { rate: +(base.rate - 0.03 + j).toFixed(2), pitch: +(base.pitch + (q ? 0.07 : ex ? 0.05 : 0) - j / 2).toFixed(2), pause: q ? 260 : /[,;:—-]$/.test(phrase) ? 120 : 190 }
}
