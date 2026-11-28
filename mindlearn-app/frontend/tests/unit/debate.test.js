import { describe, it, expect } from "vitest"
import { rankVoices, bestVoice, phrases, prosody } from "../../src/voicelib.js"
import { parseTurn, parseFinal, averages, sideFor, turnPrompt } from "../../src/debatelib.js"
const V = (name, lang, local = true)=>({ name, lang, localService: local })
describe("voicelib", () => {
  it("prefers natural female voices in the right language", () => {
    const vs = [V("Microsoft David - English (United States)", "en-US"), V("Microsoft Aria Online (Natural) - English (United States)", "en-US", false), V("Google UK English Female", "en-GB"), V("eSpeak English", "en-US"), V("Microsoft Neerja Online (Natural) - English (India)", "en-IN", false)]
    expect(bestVoice(vs, "en-IN").name).toContain("Neerja")
    expect(rankVoices(vs, "en-US")[0].name).toContain("Aria")
    expect(rankVoices(vs, "en-US").map(v=>v.name)).not.toContain(undefined)
    expect(rankVoices(vs, "hi-IN")).toEqual([])
  })
  it("phrases split into short natural chunks", () => {
    const p = phrases("Hmm, fair point. But think about this, because the cost is huge and nobody talks about it, right? Do you agree?")
    expect(p.length).toBeGreaterThanOrEqual(3); expect(p.every(x=>x.length <= 140)).toBe(true); expect(phrases("")).toEqual([])
  })
  it("prosody stays in a pleasant range", () => { for(let i = 0; i < 20; i++){ const x = prosody("Really?", i); expect(x.rate).toBeGreaterThan(0.9); expect(x.rate).toBeLessThan(1.1); expect(x.pitch).toBeLessThan(1.3) } })
})
describe("debatelib", () => {
  it("parseTurn clamps", () => { const t = parseTurn({ reply: "Hmm", logic: 15, evidence: "7", note: "n" }); expect(t.logic).toBe(10); expect(t.evidence).toBe(7); expect(parseTurn({})).toBeNull() })
  it("parseFinal", () => { expect(parseFinal({ winner: "x", score: 300, tips: ["a", "b", "c", "d"] })).toMatchObject({ winner: "draw", score: 100 }); expect(parseFinal({ winner: "pari" }).winner).toBe("pari") })
  it("averages + sideFor + prompt", () => { expect(averages([{ logic: 6, evidence: 4 }, { logic: 8, evidence: 5 }])).toEqual({ logic: 7, evidence: 4.5 }); expect(sideFor("For")).toBe("Against"); expect(turnPrompt({ topic: "T", aiSide: "Against", history: [], userText: "x", level: "tough", round: 2, rounds: 3, hi: false })).toContain("Round 2 of 3") })
})
