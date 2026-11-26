import { describe, it, expect } from "vitest"
import { SCHEMES, defaultMinutes, fmtClock, scorable, scoreMock, topicBreakdown } from "../../src/mock.js"
const same = (a, b)=>a === b
const qs = [
  { id: "1", answer: "A", options: ["A", "B"], topic: "Phy" }, { id: "2", answer: "B", options: ["A", "B"], topic: "Phy" },
  { id: "3", answer: "A", options: ["A", "B"], topic: "Chem" }, { id: "4", answer: "B", options: ["A", "B"], topic: "Chem" },
]
describe("mock", () => {
  it("scores NEET style", () => {
    const r = scoreMock(qs, { 1: "A", 2: "A", 3: "A" }, SCHEMES[0], same)   // right, wrong, right, skipped
    expect(r.right).toBe(2); expect(r.wrong).toBe(1); expect(r.skipped).toBe(1)
    expect(r.score).toBe(7); expect(r.max).toBe(16); expect(r.pct).toBe(44)
  })
  it("never shows a negative percentage", () => {
    expect(scoreMock(qs, { 1: "B", 2: "A", 3: "B", 4: "A" }, SCHEMES[0], same).pct).toBe(0)
  })
  it("quarter negative marking", () => {
    expect(scoreMock(qs, { 1: "A", 2: "A" }, SCHEMES[2], same).score).toBe(0.75)
  })
  it("only questions with an official answer can be scored", () => {
    expect(scorable([...qs, { id: "5", options: ["A", "B"] }, { id: "6", answer: "A", options: ["A"] }])).toHaveLength(4)
  })
  it("clock and default time", () => {
    expect(fmtClock(65)).toBe("1:05"); expect(fmtClock(3725)).toBe("1:02:05"); expect(fmtClock(-5)).toBe("0:00")
    expect(defaultMinutes(180)).toBe(198); expect(defaultMinutes(2)).toBe(5)
  })
  it("topic breakdown sorts weakest first", () => {
    const r = scoreMock(qs, { 1: "A", 2: "B", 3: "B", 4: "A" }, SCHEMES[1], same)
    const t = topicBreakdown(r.rows)
    expect(t[0].topic).toBe("Chem"); expect(t[0].pct).toBe(0); expect(t[1].pct).toBe(100)
  })
})
