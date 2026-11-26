import { addToQueue } from "./mistakes.js"
const hashOf = s=>{ let h = 5381; const t = String(s); for(let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return "q" + (h >>> 0).toString(36) }
/* Put wrong answers from any tool into the Revenge Queue. Returns how many were added. */
export function queueMistakes(items, source = ""){
  try{
    let q = JSON.parse(localStorage.getItem("ml_revenge") || "[]"), n = 0
    ;(items || []).forEach(it=>{
      const options = (it.options || it.choices || []).map(String)
      const question = String(it.question || it.q || "").trim()
      const answer = it.answer || it.correct
      if(!question || options.length < 2 || !answer) return
      q = addToQueue(q, { id: hashOf(question), question, options, answer: String(answer), topic: it.topic || "General", exam: "general", source })
      n++
    })
    if(n){ localStorage.setItem("ml_revenge", JSON.stringify(q)); window.dispatchEvent(new CustomEvent("ml-ls", { detail: "ml_revenge" })) }
    return n
  }catch(e){ return 0 }
}
