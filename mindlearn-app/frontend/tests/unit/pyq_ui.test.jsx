// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import React, { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"

const store = {}
const posts = []
vi.mock("../../src/lib.jsx", () => ({
  api: { get: async()=>({ data: { docs: [] } }), post: async(url, body)=>{ posts.push(url)
    if(url === "/pyq/solve") return { data: { correct_option: "B. 4", steps: ["s1"], concept: "c", confidence: "high" } }
    if(url === "/pyq/twin") return { data: { question: "What is 3+3 now?", options: ["A. 5", "B. 6"], answer: "B. 6", explanation: "six", topic: "Algebra", twin: true } }
    return { data: {} } } },
  toast: ()=>{}, Spin: ()=><i>…</i>, getOutLang: ()=>"en", recordAnswers: vi.fn(),
  useLocalState: (k, d)=>{ const [v, s] = useState(()=>store[k] ?? d); useEffect(()=>{ store[k] = v }, [v]); return [v, s] },
}))
import PyqTab from "../../src/pyq.jsx"

const tick = ()=>act(async()=>{ await new Promise(r=>setTimeout(r, 10)) })
const click = async el=>{ await act(async()=>{ el.dispatchEvent(new MouseEvent("click", { bubbles: true })) }); await tick() }
const $ = (r, t)=>r.querySelector(`[data-testid="${t}"]`)

describe("PYQ v33 UI", ()=>{
  beforeEach(()=>{ for(const k in store) delete store[k]; posts.length = 0; globalThis.IS_REACT_ACT_ENVIRONMENT = true })
  it("wrong answer -> cause chip -> DNA; queue -> revenge -> twin", async()=>{
    store.ml_pyq = { doc_id: "d", name: "Paper", exam: "general", page_from: 1, page_to: 2, total_pages: 2, answers: {}, solutions: {},
      questions: [{ id: "q1", question: "What is 2+2?", options: ["A. 3", "B. 4"], answer: "B. 4", topic: "Algebra" }] }
    const host = document.createElement("div"); document.body.appendChild(host)
    const root = createRoot(host)
    await act(async()=>{ root.render(<PyqTab />) }); await tick()
    // wrong answer
    await click([...host.querySelectorAll(".pyq-o")].find(b=>b.textContent.includes("3")))
    expect($(host, "cause-chips")).toBeTruthy()
    await click($(host, "cause-silly"))
    expect($(host, "cause-chips")).toBeFalsy()
    expect(store.ml_mistakes.length).toBe(1)
    expect(store.ml_mistakes[0].cause).toBe("silly")
    expect(store.ml_revenge.length).toBe(1)
    expect(store.ml_revenge[0].answer).toBe("B. 4")
    // DNA tab
    await click($(host, "tab-dna")); expect($(host, "dna")).toBeTruthy()
    // revenge tab: item is due tomorrow, so make it due
    store.ml_revenge[0].due = Date.now() - 1000
    await act(async()=>{ root.unmount() }); const root2 = createRoot(host)
    await act(async()=>{ root2.render(<PyqTab />) }); await tick()
    await click($(host, "tab-revenge")); expect($(host, "revenge")).toBeTruthy()
    await click([...host.querySelectorAll(".pyq-o")].find(b=>b.textContent.includes("4")))
    expect($(host, "revenge-outcome").textContent).toMatch(/Moved up/)
    await click($(host, "twin-make"))
    expect(posts).toContain("/pyq/twin")
    expect(host.textContent).toContain("twin question")
    await act(async()=>{ root2.unmount() })
  })
})
