// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { queueMistakes } from "../../src/revenge.js"
describe("queueMistakes", () => {
  beforeEach(()=>localStorage.clear())
  it("adds valid wrong questions and skips broken ones", () => {
    const n = queueMistakes([
      { question: "What is 2+2?", options: ["3", "4"], answer: "4", topic: "Maths" },
      { question: "No options", options: [], answer: "x" },
      { question: "", options: ["a", "b"], answer: "a" },
    ], "Quiz")
    expect(n).toBe(1)
    const q = JSON.parse(localStorage.getItem("ml_revenge"))
    expect(q).toHaveLength(1); expect(q[0].box).toBe(0); expect(q[0].source).toBe("Quiz"); expect(q[0].due).toBeGreaterThan(Date.now())
  })
  it("same question twice increments misses, not duplicates", () => {
    const it1 = { question: "Capital of France?", options: ["Paris", "Rome"], answer: "Paris" }
    queueMistakes([it1]); queueMistakes([it1])
    const q = JSON.parse(localStorage.getItem("ml_revenge"))
    expect(q).toHaveLength(1); expect(q[0].misses).toBe(2)
  })
  it("accepts q/choices/correct shapes", () => {
    expect(queueMistakes([{ q: "Largest planet in our solar system?", choices: ["Mars", "Jupiter"], correct: "Jupiter" }])).toBe(1)
  })
})
