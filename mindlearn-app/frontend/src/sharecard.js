import { cardText } from "./v54lib.js"
/* Draws a 1080x1080 share image on a canvas and returns a PNG blob. No network, no tracking. */
export function drawCard(opts){
  const t = cardText(opts), S = 1080, c = document.createElement("canvas"); c.width = c.height = S
  const g = c.getContext("2d"), light = document.documentElement.classList.contains("light")
  const a = light ? "#EA580C" : "#8B6BFF", b = light ? "#FBBF24" : "#2DE3F0"
  const bg = g.createLinearGradient(0, 0, S, S); bg.addColorStop(0, light ? "#FFF4E8" : "#0B0A18"); bg.addColorStop(1, light ? "#FFE1BF" : "#171433")
  g.fillStyle = bg; g.fillRect(0, 0, S, S)
  const glow = g.createRadialGradient(S * .5, S * .45, 40, S * .5, S * .45, 520); glow.addColorStop(0, a + "55"); glow.addColorStop(1, "transparent")
  g.fillStyle = glow; g.fillRect(0, 0, S, S)
  const ink = light ? "#2A1608" : "#F6F4FF", dim = light ? "#6B5545" : "#B8B4D6"
  g.textAlign = "center"; g.fillStyle = dim; g.font = "600 40px system-ui, sans-serif"; g.fillText(t.k.toUpperCase(), S / 2, 250)
  const tg = g.createLinearGradient(240, 0, 840, 0); tg.addColorStop(0, a); tg.addColorStop(1, b)
  g.fillStyle = tg; g.font = "800 230px system-ui, sans-serif"; g.fillText(t.big, S / 2, 560)
  g.fillStyle = ink; g.font = "600 50px system-ui, sans-serif"; g.fillText(t.sub, S / 2, 680)
  if(t.who){ g.fillStyle = dim; g.font = "500 38px system-ui, sans-serif"; g.fillText(t.who, S / 2, 750) }
  g.fillStyle = ink; g.font = "800 46px system-ui, sans-serif"; g.fillText("MindLearn AI", S / 2, 930)
  g.fillStyle = dim; g.font = "500 30px system-ui, sans-serif"; g.fillText("mindlearn-ai.vercel.app", S / 2, 980)
  return new Promise(res=>c.toBlob(res, "image/png"))
}
export async function shareCard(opts, filename = "mindlearn.png"){
  const blob = await drawCard(opts)
  if(!blob) return "fail"
  const file = new File([blob], filename, { type: "image/png" })
  try{ if(navigator.canShare?.({ files: [file] })){ await navigator.share({ files: [file], text: "Beat me on MindLearn AI" }); return "shared" } }catch(e){ if(e?.name === "AbortError") return "cancel" }
  const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2000)
  return "downloaded"
}
