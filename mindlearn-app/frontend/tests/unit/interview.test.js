import { describe, it, expect } from "vitest"
import { wordCount, fillerCount, wpm, paceLabel, questionsPrompt, parseQuestions, parseEval, skipped, report, parseSummary } from "../../src/interviewlib.js"
describe("interviewlib", () => {
  it("counts words and fillers", () => {
    expect(wordCount("  hello   brave new world ")).toBe(4)
    expect(wordCount("")).toBe(0)
    expect(fillerCount("Um, so like, basically you know it works. Matlab fine")).toBe(5)
    expect(fillerCount("pulse unlikely bike")).toBe(0)
  })
  it("pace", () => {
    expect(wpm(120, 60)).toBe(120)
    expect(wpm(10, 1)).toBe(0)
    expect(paceLabel(60)).toBe("slow"); expect(paceLabel(130)).toBe("good"); expect(paceLabel(200)).toBe("fast")
  })
  it("prompt mentions type and count", () => {
    const p = questionsPrompt({ type: "tech", focus: "Python", n: 5, lang: "" })
    expect(p).toContain("exactly 5"); expect(p).toContain("Python"); expect(p).toContain("Technical")
    expect(questionsPrompt({ type: "pdf", n: 3 })).toContain("uploaded document")
  })
  it("parses questions in several shapes", () => {
    expect(parseQuestions({ questions: [{ q: "What is entropy in simple words?", topic: "Thermo" }, { q: "hi" }] }, 5)).toHaveLength(1)
    expect(parseQuestions(["Explain recursion with an example please", "Why use a hash map here?"], 1)).toHaveLength(1)
    expect(parseQuestions(null, 3)).toEqual([])
  })
  it("parses eval and clamps score", () => {
    expect(parseEval({ score: 14, reaction: "Nice.", good: "a", improve: "b", ideal: "c" }).score).toBe(10)
    expect(parseEval({ score: "x" })).toBeNull()
    expect(parseEval({ score: 6.26 }).score).toBe(6.3)
    expect(parseEval({ score: 5 }).reaction).toBeTruthy()
  })
  it("report summarises", () => {
    const rows = [{ score: 8, words: 100, secs: 50, fillers: 2 }, { score: 4, words: 60, secs: 40, fillers: 3 }, { ...skipped() }]
    const r = report(rows)
    expect(r.avg).toBe(4); expect(r.pct).toBe(40); expect(r.answered).toBe(2); expect(r.total).toBe(3)
    expect(r.pace).toBe(107); expect(r.fillers).toBe(5); expect(r.best.score).toBe(8); expect(r.worst.score).toBe(0)
  })
  it("summary parsing", () => {
    expect(parseSummary({ verdict: "Good", strengths: ["a"], work_on: "x" })).toEqual({ verdict: "Good", strengths: ["a"], work_on: [] })
    expect(parseSummary(null)).toBeNull()
  })
})
