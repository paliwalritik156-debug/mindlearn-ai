import { describe, it, expect } from "vitest"
import { fitSize } from "../../src/v47lib.js"
import { encodeRoom, decodeRoom, phaseAt, clock } from "../../src/roomlib.js"
const r = { host: "Ritik ✨", title: "Physics", start: 1_000_000, focus: 25, brk: 5, cycles: 2 }
describe("v47", () => {
  it("fitSize", () => { expect(fitSize(4000, 3000, 1400)).toEqual({ w: 1400, h: 1050 }); expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 }); expect(fitSize(0, 5)).toEqual({ w: 1, h: 1 }) })
  it("room roundtrip + validation", () => {
    expect(decodeRoom(encodeRoom(r))).toEqual(r); expect(decodeRoom("zzzz")).toBeNull()
    expect(decodeRoom(encodeRoom({ ...r, focus: 999 }))).toBeNull()
  })
  it("phases", () => {
    const at = s=>phaseAt(r, r.start + s * 1000)
    expect(at(-30)).toMatchObject({ state: "waiting", left: 30 })
    expect(at(0)).toMatchObject({ state: "focus", left: 1500, cycle: 1 })
    expect(at(1500)).toMatchObject({ state: "break", left: 300, cycle: 1 })
    expect(at(1800)).toMatchObject({ state: "focus", cycle: 2 })
    expect(at(1800 + 1500)).toMatchObject({ state: "done" })
    expect(clock(65)).toBe("01:05")
  })
})
