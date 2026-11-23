import { describe, it, expect } from "vitest"
import { addToQueue, gradeItem, dueItems, waitingItems, pushLog, setLogCause, mistakeDna, BOX_DAYS, DAY, LOG_MAX, QUEUE_MAX, daysUntil } from "../../src/mistakes.js"

const T0 = 1_700_000_000_000
const item = id=>({ id, question: "Q " + id, options: ["A", "B"], topic: "Physics", answer: "A" })

describe("revenge queue (Leitner)", ()=>{
  it("a missed question is due in 1 day, not now", ()=>{
    const q = addToQueue([], item("a"), T0)
    expect(q[0].box).toBe(0); expect(q[0].due).toBe(T0 + DAY)
    expect(dueItems(q, T0)).toHaveLength(0); expect(dueItems(q, T0 + DAY)).toHaveLength(1); expect(waitingItems(q, T0)).toHaveLength(1)
  })
  it("correct reviews climb the boxes with growing gaps, then master", ()=>{
    let q = addToQueue([], item("a"), T0); let now = T0 + DAY
    const gaps = []
    for(let i = 0; i < BOX_DAYS.length - 1; i++){ q = gradeItem(q, "a", true, now); gaps.push(Math.round((q[0].due - now) / DAY)); now = q[0].due }
    expect(gaps).toEqual([3, 7, 14, 30])
    q = gradeItem(q, "a", true, now)
    expect(q[0].mastered).toBe(true); expect(dueItems(q, now + 999 * DAY)).toHaveLength(0)
  })
  it("a wrong review sends it back to box 0 and counts the miss", ()=>{
    let q = addToQueue([], item("a"), T0); q = gradeItem(q, "a", true, T0 + DAY); q = gradeItem(q, "a", false, T0 + 5 * DAY)
    expect(q[0].box).toBe(0); expect(q[0].due).toBe(T0 + 6 * DAY); expect(q[0].misses).toBe(2)
  })
  it("missing the same question again resets it instead of duplicating", ()=>{
    let q = addToQueue([], item("a"), T0); q = gradeItem(q, "a", true, T0 + DAY); q = addToQueue(q, item("a"), T0 + 10 * DAY)
    expect(q).toHaveLength(1); expect(q[0].box).toBe(0); expect(q[0].misses).toBe(2)
  })
  it("queue is capped", ()=>{
    let q = []; for(let i = 0; i < QUEUE_MAX + 20; i++) q = addToQueue(q, item("x" + i), T0)
    expect(q).toHaveLength(QUEUE_MAX); expect(q[q.length - 1].id).toBe("x" + (QUEUE_MAX + 19))
  })
  it("daysUntil never goes negative", ()=>{ expect(daysUntil(T0 - 5 * DAY, T0)).toBe(0); expect(daysUntil(T0 + 2.2 * DAY, T0)).toBe(3) })
})

describe("answer log", ()=>{
  it("keeps newest entries only and can attach a cause to the latest wrong answer", ()=>{
    let log = []; for(let i = 0; i < LOG_MAX + 5; i++) log = pushLog(log, { id: "q" + i, topic: "T", ok: i % 2 === 0, secs: 10, at: i })
    expect(log).toHaveLength(LOG_MAX)
    let l2 = pushLog([], { id: "z", topic: "T", ok: false, secs: 4, at: 1 }); l2 = setLogCause(l2, "z", "silly")
    expect(l2[0].cause).toBe("silly")
    expect(setLogCause(l2, "nope", "rush")).toBe(l2)
  })
})

describe("Mistake DNA", ()=>{
  const mk = (arr)=>arr.map(([ok, topic, cause, secs], i)=>({ id: "q" + i, ok, topic, cause, secs, at: i }))
  it("says it needs more data when there is little", ()=>{
    const d = mistakeDna(mk([[true, "A", null, 10], [false, "A", "silly", 10]]))
    expect(d.enough).toBe(false); expect(d.advice).toEqual([])
  })
  it("finds the dominant cause, the leaky topic and the speed pattern", ()=>{
    const d = mistakeDna(mk([
      [true, "Optics", null, 60], [true, "Optics", null, 70], [true, "Heat", null, 65], [true, "Heat", null, 55],
      [false, "Optics", "silly", 20], [false, "Optics", "silly", 15], [false, "Optics", "silly", 25], [false, "Heat", "concept", 30],
    ]))
    expect(d.enough).toBe(true); expect(d.accuracy).toBe(50)
    expect(d.byCause[0]).toMatchObject({ key: "silly", count: 3 }); expect(Math.round(d.byCause[0].pct * 100)).toBe(75)
    expect(d.topTopics[0]).toMatchObject({ topic: "Optics", wrong: 3, cause: "silly" })
    expect(d.avgRight).toBe(63); expect(d.avgWrong).toBe(23)
    expect(d.advice.join(" ")).toMatch(/75% of your misses are silly mistakes/)
    expect(d.advice.join(" ")).toMatch(/too fast/)
    expect(d.advice.join(" ")).toMatch(/Biggest leak: Optics/)
  })
  it("gives Hinglish advice on request and no cause advice when causes are mixed", ()=>{
    const mixed = mk([[true, "A", null, 30], [true, "A", null, 30], [true, "B", null, 30], [false, "A", "silly", 30], [false, "B", "concept", 30], [false, "B", "guess", 30], [false, "A", "rush", 30]])
    expect(mistakeDna(mixed).advice.join(" ")).not.toMatch(/of your misses are/)
    const hi = mistakeDna(mk([[true, "A", null, 30], [true, "A", null, 30], [true, "A", null, 30], [false, "A", "concept", 30], [false, "A", "concept", 30]]), "hinglish")
    expect(hi.advice.join(" ")).toMatch(/concept gap/)
  })
  it("works with an empty log", ()=>{ const d = mistakeDna([]); expect(d).toMatchObject({ n: 0, accuracy: 0, enough: false }) })
})
