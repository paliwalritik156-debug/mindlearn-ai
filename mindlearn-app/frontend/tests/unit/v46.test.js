import { describe, it, expect } from "vitest"
import { weakConceptNames, addToSrs, cheatHtml, whyWrongPrompt } from "../../src/v46lib.js"
describe("v46", () => {
  it("weak concept matching", () => {
    const c = [{ name: "Newton's Laws" }, { name: "Optics" }, { name: "Ray optics basics" }]
    const s = [{ topic: "optics", attempts: 4, acc: 25 }, { topic: "newton", attempts: 1, acc: 0 }, { topic: "Heat", attempts: 5, acc: 90 }]
    expect(weakConceptNames(c, s)).toEqual(["Optics", "Ray optics basics"])
    expect(weakConceptNames(c, [])).toEqual([])
  })
  it("addToSrs dedupes and shapes cards", () => {
    const r = addToSrs([{ q: "What is X?", a: "y" }, { q: "what is x", a: "z" }, { q: "", a: "a" }, { q: "New", a: "b" }], [{ q: "New", a: "b", interval: 3, due: 0 }], 123)
    expect(r.added).toBe(1); expect(r.list).toHaveLength(2); expect(r.list[1]).toEqual({ q: "What is X?", a: "y", interval: 1, due: 123 })
  })
  it("cheatHtml escapes and structures", () => {
    const h = cheatHtml("## Heat\n- **Q** = mc<script>\n- next\nplain")
    expect(h).toContain("<h3>Heat</h3>"); expect(h).toContain("<b>Q</b>"); expect(h).not.toContain("<script>"); expect(h.match(/<li>/g)).toHaveLength(2); expect(h).toContain("<p>plain</p>")
  })
  it("why-wrong prompt", () => { expect(whyWrongPrompt("Q?", "A", "B", true)).toContain("Hinglish") })
})
