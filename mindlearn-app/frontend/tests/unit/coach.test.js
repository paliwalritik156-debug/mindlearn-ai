import { describe, it, expect } from "vitest"
import { daysLeft, phaseOf, buildPlan, readiness, streak, dayKey, countdownLabel, DAY_MS } from "../../src/coach.js"
const now = new Date(2026, 0, 10, 15).getTime()
describe("coach", () => {
  it("daysLeft", () => { expect(daysLeft("2026-01-20", now)).toBe(10); expect(daysLeft("2026-01-10", now)).toBe(0); expect(daysLeft("2026-01-09", now)).toBe(-1); expect(daysLeft("", now)).toBeNull() })
  it("phases", () => { expect(phaseOf(100).key).toBe("build"); expect(phaseOf(60).key).toBe("practice"); expect(phaseOf(14).key).toBe("revise"); expect(phaseOf(3).key).toBe("final"); expect(phaseOf(-1).key).toBe("done"); expect(phaseOf(null)).toBeNull() })
  it("plan fits budget and prioritises due revenge + weak topic", () => {
    const p = buildPlan({ days: 10, hours: 4, due: 12, weak: [{ topic: "Optics", acc: 30, attempts: 6 }], lastMockDaysAgo: 9 })
    expect(p.reduce((a, t)=>a + t.min, 0)).toBeLessThanOrEqual(240 + 5 * p.length)
    expect(p.find(t=>t.id === "revenge").text).toContain("12")
    expect(p.find(t=>t.id === "weak").text).toContain("Optics")
    expect(p.find(t=>t.id === "mock")).toBeTruthy()
  })
  it("no mock in build phase, none when exam over", () => { expect(buildPlan({ days: 120, hours: 3 }).find(t=>t.id === "mock")).toBeUndefined(); expect(buildPlan({ days: -2 })).toEqual([]) })
  it("readiness is null without data, weighted otherwise", () => { expect(readiness({})).toBeNull(); expect(readiness({ weak: [{ attempts: 10, correct: 8 }], mocks: [{ pct: 60 }], due: 0, queued: 10 })).toBe(Math.round(80 * .5 + 60 * .3 + 100 * .2)) })
  it("streak", () => {
    const k = o=>dayKey(now - o * DAY_MS), d = { done: ["a"] }
    expect(streak({ [k(0)]: d, [k(1)]: d, [k(2)]: d }, now)).toBe(3)
    expect(streak({ [k(1)]: d, [k(2)]: d }, now)).toBe(2)
    expect(streak({ [k(3)]: d }, now)).toBe(0)
  })
  it("label", () => { expect(countdownLabel(5, "NEET")).toBe("NEET in 5 days"); expect(countdownLabel(1)).toBe("Exam in 1 day"); expect(countdownLabel(0)).toContain("today") })
})
