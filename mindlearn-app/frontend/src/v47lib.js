export function fitSize(w, h, max = 1400){
  if(!(w > 0 && h > 0)) return { w: 1, h: 1 }
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}
