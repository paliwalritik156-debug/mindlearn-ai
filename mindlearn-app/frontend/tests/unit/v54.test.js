import { describe, it, expect } from "vitest"
import { stripMd, chunkText, wizardResult, cardText } from "../../src/v54lib.js"
describe("v54", () => {
  it("stripMd", () => { expect(stripMd("## Heat\n- **Q** = mc\n`code` [x](http://a)")).toBe("Heat\nQ = mc\ncode x") })
  it("chunkText respects max and splits sentences", () => {
    const t = "One. Two is longer! Three? " + "x".repeat(400)
    const c = chunkText(t, 100); expect(c.every(s=>s.length <= 100)).toBe(true); expect(c[0]).toContain("One."); expect(c.join("").length).toBeGreaterThan(400)
    expect(chunkText("")).toEqual([])
  })
  it("wizardResult", () => {
    expect(wizardResult({ exam: "NEET", date: "2027-05-05", hours: 4 })).toEqual({ coach: { exam: "NEET", date: "2027-05-05", hours: 4 }, goals: { daily: 12, exam: "NEET" } })
    expect(wizardResult({ exam: "UPSC", hours: 0 }).coach.hours).toBe(6)
  })
  it("cardText trims", () => { expect(cardText({ kind: "quiz", big: "9/10", sub: "x".repeat(200) }).sub).toHaveLength(60) })
})
