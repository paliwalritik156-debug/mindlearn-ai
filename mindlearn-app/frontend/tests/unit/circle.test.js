import { describe, it, expect } from "vitest"
import { weekStart, weekPoints, normCode, medal, evName } from "../../src/circlelib.js"
describe("circle", () => {
  it("weekStart is Monday", () => { expect(weekStart(new Date(2026, 10, 28, 15).getTime())).toBe("2026-11-23"); expect(weekStart(new Date(2026, 10, 23, 0, 5).getTime())).toBe("2026-11-23"); expect(weekStart(new Date(2026, 10, 22, 23).getTime())).toBe("2026-11-16") })
  it("weekPoints counts only this week", () => {
    const now = new Date(2026, 10, 28, 12).getTime(), mon = new Date(2026, 10, 23, 9).getTime(), old = new Date(2026, 10, 20, 9).getTime()
    expect(weekPoints([{ at: mon }, { at: mon }, { at: old }], [{ date: new Date(mon).toISOString(), pct: 90 }, { date: new Date(old).toISOString(), pct: 90 }], now)).toBe(10 + 30 + 20)
  })
  it("helpers", () => { expect(normCode("ab-c 123x")).toBe("ABC123"); expect(medal(0)).toBe("🥇"); expect(medal(5)).toBe("6"); expect(evName("Duel!")).toBe("tool_open:duel") })
})
