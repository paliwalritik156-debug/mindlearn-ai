// Pure helpers for v46: weak-topic matching on the 3D map, flashcards -> Spaced Repetition, cheat-sheet markdown.
const norm = s=>String(s || "").toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, " ").replace(/\s+/g, " ").trim()
/* names of concepts that match a weak topic (acc < 60 with >= 2 attempts). Loose match: one contains the other. */
export function weakConceptNames(concepts, stats){
  const weak = (stats || []).filter(s=>s.attempts >= 2 && s.acc < 60).map(s=>norm(s.topic)).filter(t=>t.length >= 3)
  if(!weak.length) return []
  return (concepts || []).map(c=>c.name).filter(n=>{ const m = norm(n); return m.length >= 3 && weak.some(w=>m.includes(w) || w.includes(m)) })
}
/* returns { list, added } : new SRS list with cards appended (skips questions already present) */
export function addToSrs(cards, existing, now = Date.now()){
  const list = [...(existing || [])]
  const seen = new Set(list.map(c=>norm(c.q)))
  let added = 0
  ;(cards || []).forEach(c=>{
    const q = String(c?.q || "").trim(), a = String(c?.a || "").trim()
    if(!q || !a || seen.has(norm(q))) return
    seen.add(norm(q)); list.push({ q, a, interval: 1, due: now }); added++
  })
  return { list, added }
}
export const whyWrongPrompt = (q, mine, right, hi)=>`A student answered a multiple-choice question wrongly. Explain in at most 4 short sentences: (1) why their chosen option is tempting but wrong, (2) the exact idea that separates it from the right answer, (3) one tip to avoid this trap next time. Do not be condescending.${hi ? " Reply in simple Hinglish." : ""}
Question: ${q}
Student chose: ${mine}
Correct answer: ${right || "(not given, work it out)"}`
export const cheatPrompt = (focus, hi)=>`Make a one-page CHEAT SHEET for quick revision from the uploaded document${focus ? ` focusing on: ${focus}` : ""}. Use ONLY information from the document. Format in compact Markdown: "## Heading" per topic, then short "- " bullet points (formulas, definitions, key facts, common traps). Max about 350 words total, no intro or outro text.${hi ? " Write in simple Hinglish." : ""}`
const esc = s=>String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const inline = s=>esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
export function cheatHtml(md){
  const out = []; let open = false
  String(md || "").split("\n").forEach(raw=>{
    const l = raw.trim(); if(!l) return
    const h = /^#{1,3}\s+(.*)$/.exec(l), b = /^[-*•]\s+(.*)$/.exec(l)
    if(h){ if(open){ out.push("</ul>"); open = false } out.push(`<h3>${inline(h[1])}</h3>`) }
    else if(b){ if(!open){ out.push("<ul>"); open = true } out.push(`<li>${inline(b[1])}</li>`) }
    else { if(open){ out.push("</ul>"); open = false } out.push(`<p>${inline(l)}</p>`) }
  })
  if(open) out.push("</ul>")
  return out.join("")
}
