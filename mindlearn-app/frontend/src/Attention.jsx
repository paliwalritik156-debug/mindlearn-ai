import { attentionVerdict } from "./gaze.js"

export default function Attention({ sm }){
  if(!sm) return null
  const v = attentionVerdict(sm)
  return (
    <div className={"att-report " + (v.level === "warn" ? "warn" : "")} data-testid="att-report">
      <h4>👀 Attention report <small style={{ fontWeight: 400, opacity: .7 }}>(andaza)</small></h4>
      {v.level !== "na" && (
        <div className="att-row">
          <span>Eye contact: <b>{sm.focus}%</b></span>
          <span>Nazar hati: <b>{sm.lookAwayCount}</b> baar ({sm.awaySecs}s)</span>
          <span>Chehra nahi dikha: <b>{sm.noFaceSecs}s</b></span>
          {sm.multiCount > 0 && <span>Ek se zyada chehre: <b>{sm.multiCount}</b> baar</span>}
        </div>
      )}
      <p style={{ margin: "4px 0" }}>{v.text}</p>
      <p className="coach-note" style={{ margin: "4px 0 0" }}>Ye sirf practice ka approximate indicator hai, cheating ka saboot nahi. Sochte waqt, chashme, roshni ya camera angle se bhi nazar hatti dikh sakti hai. Video kahin save ya upload nahi hota.</p>
    </div>
  )
}
