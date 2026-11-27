import { describe, it, expect } from "vitest"
import { parseDuelQs, score, encodeDuel, decodeDuel, verdict, shareText } from "../../src/duellib.js"
import { parseTeach, overall, grade, teachPrompt } from "../../src/teachlib.js"
const qs = [{ q: "Hindi: क्या है?", o: ["a", "b", "c", "d"], a: 2 }, { q: "2+2", o: ["3", "4", "5", "6"], a: 1 }]
describe("duel", () => {
  it("parses and filters questions", () => {
    const r = parseDuelQs([{ q: "x", o: ["1", "2", "3", "4"], a: "C" }, { q: "bad", o: ["1"], a: 0 }, { q: "y", options: ["1", "2", "3", "4"], answer: 9 }])
    expect(r).toHaveLength(1); expect(r[0].a).toBe(2)
  })
  it("score + roundtrip (unicode safe)", () => {
    expect(score(qs, [2, 0])).toBe(1)
    const d = decodeDuel(encodeDuel({ title: "Test ✨", name: "Ritik", qs, score: 4, secs: 33 }))
    expect(d.qs).toEqual(qs); expect(d.title).toBe("Test ✨"); expect(d.score).toBe(4); expect(d.secs).toBe(33)
    expect(decodeDuel("garbage!!")).toBeNull()
  })
  it("verdict uses score then time", () => {
    expect(verdict({ score: 4, secs: 50 }, { score: 3, secs: 10 })).toBe("win")
    expect(verdict({ score: 3, secs: 20 }, { score: 3, secs: 30 })).toBe("win")
    expect(verdict({ score: 3, secs: 30 }, { score: 3, secs: 30 })).toBe("draw")
    expect(shareText("A", "T", 3, 5, 20, "lose")).toContain("you won")
  })
})
describe("teach", () => {
  it("parses & clamps", () => {
    const t = parseTeach({ reply: "Why?", clarity: 150, accuracy: "70", depth: -5, gaps: ["a", "b", "c", "d"] })
    expect(t.clarity).toBe(100); expect(t.depth).toBe(0); expect(t.gaps).toHaveLength(3); expect(parseTeach({})).toBeNull()
    expect(overall({ clarity: 100, accuracy: 100, depth: 100 })).toBe(100); expect(grade(30)).toContain("Revise")
  })
  it("prompt includes topic + explanation", () => { const p = teachPrompt("Osmosis", [], "water moves", false); expect(p).toContain("Osmosis"); expect(p).toContain("water moves") })
})
