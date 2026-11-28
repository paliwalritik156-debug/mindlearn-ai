import { describe, it, expect } from "vitest"
import { GazeTracker, pose, attentionVerdict, LM } from "../../src/gaze.js"

function face({ yaw = 0, pitch = 0, iris = 0 } = {}){
  const lm = Array.from({ length: 478 }, ()=>({ x: .5, y: .5 }))
  lm[LM.cheekL] = { x: .3, y: .5 }; lm[LM.cheekR] = { x: .7, y: .5 }
  lm[LM.fore] = { x: .5, y: .2 }; lm[LM.chin] = { x: .5, y: .8 }
  lm[LM.nose] = { x: .5 + yaw * .4, y: .5 + pitch * .6 }
  lm[LM.eyeLo] = { x: .38, y: .42 }; lm[LM.eyeLi] = { x: .46, y: .42 }; lm[LM.eyeRi] = { x: .54, y: .42 }; lm[LM.eyeRo] = { x: .62, y: .42 }
  lm[LM.irisL] = { x: .42 + iris * .08, y: .42 }; lm[LM.irisR] = { x: .58 + iris * .08, y: .42 }
  return lm
}
function run(tr, faces, from, ms, step = 150){ let t = from; for(; t < from + ms; t += step) tr.update(faces, t); return t }

describe("gaze", () => {
  it("pose reads yaw", () => { expect(pose(face({ yaw: .3 })).yaw).toBeCloseTo(.3, 1); expect(pose(null)).toBeNull() })
  it("calibrates then reports ok", () => {
    const tr = new GazeTracker(); let t = run(tr, [face()], 0, 2500)
    expect(tr.state).toBe("ok"); expect(tr.summary().calibrated).toBe(true)
  })
  it("brief glance is not counted, long look-away is", () => {
    const tr = new GazeTracker(); let t = run(tr, [face()], 0, 2500)
    t = run(tr, [face({ yaw: .4 })], t, 600); t = run(tr, [face()], t, 1500)
    expect(tr.summary().lookAwayCount).toBe(0)
    t = run(tr, [face({ yaw: .4 })], t, 3000)
    expect(tr.state).toBe("away"); expect(tr.summary().lookAwayCount).toBe(1)
    t = run(tr, [face()], t, 1000); expect(tr.state).toBe("ok")
  })
  it("flags no face and multiple faces", () => {
    const tr = new GazeTracker(); let t = run(tr, [face()], 0, 2500)
    t = run(tr, [], t, 3000); expect(tr.state).toBe("noface"); expect(tr.summary().noFaceSecs).toBeGreaterThan(1)
    t = run(tr, [face(), face()], t, 1500); expect(tr.state).toBe("multi"); expect(tr.summary().multiCount).toBe(1)
  })
  it("eyes moving sideways counts as away", () => {
    const tr = new GazeTracker(); let t = run(tr, [face()], 0, 2500)
    run(tr, [face({ iris: 2.5 })], t, 2500); expect(tr.state).toBe("away")
  })
  it("verdict", () => {
    expect(attentionVerdict(null).level).toBe("na")
    expect(attentionVerdict({ calibrated: true, trackedSecs: 100, focus: 95, lookAwayCount: 1, multiCount: 0 }).level).toBe("good")
    expect(attentionVerdict({ calibrated: true, trackedSecs: 100, focus: 40, lookAwayCount: 9, multiCount: 0 }).level).toBe("warn")
  })
})
