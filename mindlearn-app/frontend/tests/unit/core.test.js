// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { calcXp, levelOf, streakOf, DAY } from "../../src/core.js"
import { buildPlan, leagueOf } from "../../src/v22.jsx"
import { weekStats } from "../../src/v24.jsx"
import { weekSeries, loadTime } from "../../src/studytime.js"
import { detectWeak, isLite } from "../../src/perf.js"
import { applyHinglish } from "../../src/hinglish.js"
import { FUN_META, SIDEBAR_GROUPS } from "../../src/lib.jsx"

beforeEach(()=>localStorage.clear())

describe("xp / level", () => {
  it("calcXp counts activity, quizzes and 80%+ bonus", () => {
    expect(calcXp([{}, {}], [{ pct:90 }, { pct:50 }])).toBe(2*5 + 2*30 + 1*20)
    expect(calcXp(null, null)).toBe(0)
  })
  it("levelOf starts at level 1 and grows", () => {
    expect(levelOf(0).lvl).toBe(1)
    expect(levelOf(60).lvl).toBe(2)
    expect(levelOf(0).title).toBe("Newbie")
  })
  it("streakOf counts consecutive days ending today or yesterday", () => {
    const now = Date.now()
    expect(streakOf([{ at:now }, { at:now - DAY }, { at:now - 2*DAY }])).toBe(3)
    expect(streakOf([{ at:now - DAY }])).toBe(1)
    expect(streakOf([{ at:now - 3*DAY }])).toBe(0)
  })
})

describe("planner", () => {
  it("returns nothing without an exam date", () => { expect(buildPlan(null, [], 2)).toEqual([]) })
  it("builds a plan ending on exam day", () => {
    const d = new Date(Date.now() + 5*DAY), iso = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0")
    const plan = buildPlan({ date: iso }, ["Physics", "Chem"], 2)
    expect(plan.length).toBe(6)
    expect(plan.at(-1).tasks[0].t).toMatch(/Exam day/)
    expect(plan[0].tasks[0].t).toMatch(/Physics/)
  })
})

describe("league / week stats", () => {
  it("leagueOf is monotonic and has a next step", () => {
    expect(leagueOf(0).pct).toBeGreaterThanOrEqual(0)
    expect(leagueOf(0).next).toBeTruthy()
    expect(leagueOf(10_000_000).next).toBeFalsy()
  })
  it("weekStats summarises the last 7 days", () => {
    const now = Date.now()
    const s = weekStats([{ k:"chat", at:now }, { k:"chat", at:now }, { k:"quiz", at:now - DAY }, { k:"chat", at:now - 20*DAY }], [{ pct:80, date:new Date().toISOString() }])
    expect(s.actions).toBe(3); expect(s.activeDays).toBe(2); expect(s.topKey).toBe("chat"); expect(s.avg).toBe(80)
  })
})

describe("study time", () => {
  it("weekSeries returns 7 days", () => { expect(weekSeries().out).toHaveLength(7); expect(loadTime().hours).toHaveLength(24) })
})

describe("lite mode", () => {
  it("honours the manual override", () => {
    localStorage.setItem("ml_perf", JSON.stringify("lite")); expect(isLite()).toBe(true)
    localStorage.setItem("ml_perf", JSON.stringify("full")); expect(isLite()).toBe(false)
  })
  it("detectWeak returns a boolean", () => { expect(typeof detectWeak()).toBe("boolean") })
})

describe("hinglish", () => {
  it("translates and restores titles + sidebar groups", () => {
    const en = FUN_META.chat.title, g = SIDEBAR_GROUPS[0].label
    applyHinglish("hi"); expect(FUN_META.chat.title).not.toBe(en); expect(SIDEBAR_GROUPS[0].label).toBe("Padhai")
    applyHinglish("en"); expect(FUN_META.chat.title).toBe(en); expect(SIDEBAR_GROUPS[0].label).toBe(g)
  })
})
