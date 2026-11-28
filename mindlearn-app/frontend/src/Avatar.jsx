import { useEffect, useState } from "react"

// Original illustrated AI persona (not a real person). Blinks, looks around, and moves her mouth while speaking.
const LOOKS = {
  aria: { hair: "#2a1a14", hair2: "#4a2c20", skin: "#f1c6a6", skin2: "#e2a982", top: "#2f4a7a", top2: "#1d2f55", iris: "#5a3a22", bg1: "#2b3a67", bg2: "#6f86c9", lip: "#c4605e", accent: "#ffd37a" },
  pari: { hair: "#1b1220", hair2: "#3b2347", skin: "#f4cdb1", skin2: "#e6b08e", top: "#b5306f", top2: "#7d1f4d", iris: "#3b2a1c", bg1: "#6a2a6f", bg2: "#ff8fb8", lip: "#d2506a", accent: "#ffe0a0" },
}

export default function Avatar({ who = "pari", state = "idle", size = 180 }){
  const L = LOOKS[who] || LOOKS.pari
  const [blink, setBlink] = useState(false)
  const [mouth, setMouth] = useState(0)
  const [gx, setGx] = useState(0)

  useEffect(()=>{
    let dead = false, t
    const loop = ()=>{ if(dead) return; setBlink(true); setTimeout(()=>!dead && setBlink(false), 130); t = setTimeout(loop, 2200 + Math.random() * 3200) }
    t = setTimeout(loop, 1500)
    return ()=>{ dead = true; clearTimeout(t) }
  }, [])
  useEffect(()=>{
    if(state !== "speaking"){ setMouth(0); return }
    const id = setInterval(()=>setMouth(Math.random() < .18 ? 0.08 : 0.25 + Math.random() * .75), 110)
    return ()=>clearInterval(id)
  }, [state])
  useEffect(()=>{
    const id = setInterval(()=>setGx(state === "thinking" ? -4 + Math.random() * -2 : state === "listening" ? (Math.random() - .5) * 1.2 : (Math.random() - .5) * 2.4), 1700)
    return ()=>clearInterval(id)
  }, [state])

  const open = 2 + mouth * 13, smile = state === "listening" ? 3 : 1.5
  const eyeH = blink ? 0.5 : 8.5
  const id = "av" + who
  return (
    <div className={"avatar av-" + state} style={{ width: size, height: size }} data-testid="avatar" data-state={state} aria-label={(who === "aria" ? "Aria" : "Pari") + " " + state}>
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <defs>
          <linearGradient id={id + "bg"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={L.bg1} /><stop offset="1" stopColor={L.bg2} /></linearGradient>
          <linearGradient id={id + "sk"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={L.skin} /><stop offset="1" stopColor={L.skin2} /></linearGradient>
          <linearGradient id={id + "hr"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={L.hair2} /><stop offset="1" stopColor={L.hair} /></linearGradient>
          <linearGradient id={id + "tp"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={L.top} /><stop offset="1" stopColor={L.top2} /></linearGradient>
          <radialGradient id={id + "bl"}><stop offset="0" stopColor="#ff8a8a" stopOpacity=".45" /><stop offset="1" stopColor="#ff8a8a" stopOpacity="0" /></radialGradient>
          <clipPath id={id + "cl"}><rect width="200" height="200" rx="100" /></clipPath>
        </defs>
        <g clipPath={`url(#${id}cl)`}>
          <rect width="200" height="200" fill={`url(#${id}bg)`} />
          <circle cx="150" cy="40" r="46" fill="#fff" opacity=".08" />
          {/* hair back */}
          <path d="M44 96C40 40 78 18 100 18s60 22 56 78c-2 38 6 62 14 78H30c8-16 16-40 14-78z" fill={`url(#${id}hr)`} />
          {/* shoulders */}
          <path d="M22 200c4-34 30-52 78-52s74 18 78 52z" fill={`url(#${id}tp)`} />
          <path d="M80 150c6 14 34 14 40 0l-6-6H86z" fill={L.skin2} />
          {/* neck */}
          <rect x="86" y="128" width="28" height="26" rx="10" fill={L.skin2} />
          {/* face */}
          <ellipse cx="100" cy="98" rx="42" ry="50" fill={`url(#${id}sk)`} />
          <ellipse cx="62" cy="104" rx="5" ry="9" fill={L.skin2} /><ellipse cx="138" cy="104" rx="5" ry="9" fill={L.skin2} />
          {/* blush */}
          <circle cx="76" cy="112" r="12" fill={`url(#${id}bl)`} /><circle cx="124" cy="112" r="12" fill={`url(#${id}bl)`} />
          {/* brows */}
          <path d={`M68 ${state === "thinking" ? 74 : 78}q10-7 22-1`} stroke={L.hair} strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d={`M110 77q12-6 22 ${state === "thinking" ? -3 : 1}`} stroke={L.hair} strokeWidth="3.2" strokeLinecap="round" fill="none" />
          {/* eyes */}
          {[79, 121].map((cx, k)=>(
            <g key={k}>
              <ellipse cx={cx} cy="92" rx="10.5" ry={eyeH} fill="#fff" />
              <circle cx={cx + gx} cy="92" r={blink ? 0 : 5.6} fill={L.iris} />
              <circle cx={cx + gx} cy="92" r={blink ? 0 : 2.6} fill="#0b0b10" />
              <circle cx={cx + gx + 1.8} cy="90" r={blink ? 0 : 1.4} fill="#fff" />
              <path d={`M${cx - 11} 91q11-${blink ? 2 : 11} 22 0`} stroke="#2b1b1b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              {!blink && <path d={`M${cx - 10} 98q10 5 20 0`} stroke={L.skin2} strokeWidth="1.4" fill="none" opacity=".6" />}
            </g>
          ))}
          {/* nose */}
          <path d="M100 96q-4 14-1 18q3 2 7 0" stroke={L.skin2} strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* mouth */}
          {open > 3.2
            ? <g><path d={`M84 128q16 ${open + 3} 32 0q-16 ${-4} -32 0z`} fill="#5a1f2a" /><path d={`M85 127q15 -3 30 0q-15 ${open * .55} -30 0z`} fill="#fff" opacity=".9" /><path d={`M84 128q16 ${-3 + smile} 32 0`} stroke={L.lip} strokeWidth="2.6" fill="none" strokeLinecap="round" /></g>
            : <path d={`M84 127q16 ${smile * 3} 32 0`} stroke={L.lip} strokeWidth="3.4" fill="none" strokeLinecap="round" />}
          {/* hair front */}
          <path d="M56 98C54 56 78 34 104 36c-18 8-30 22-34 44-2 8-6 14-14 18z" fill={`url(#${id}hr)`} />
          <path d="M144 98c2-40-16-58-40-62c20 8 32 24 34 46 1 8 3 12 6 16z" fill={`url(#${id}hr)`} />
          <path d="M60 60C76 30 124 30 142 62C128 44 76 42 60 60z" fill={L.hair} opacity=".55" />
          {/* earring / accent */}
          <circle cx="60" cy="116" r="2.6" fill={L.accent} /><circle cx="140" cy="116" r="2.6" fill={L.accent} />
        </g>
      </svg>
    </div>
  )
}
