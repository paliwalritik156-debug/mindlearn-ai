import { useEffect, useRef, useState } from "react"
import { GazeTracker } from "./gaze.js"

let loading = null
function loadMesh(){
  if(window.FaceMesh) return Promise.resolve()
  if(loading) return loading
  loading = new Promise((res, rej)=>{
    const s = document.createElement("script"); s.src = "/mediapipe/face_mesh.js"; s.async = true
    s.onload = ()=>window.FaceMesh ? res() : rej(new Error("nomesh")); s.onerror = ()=>{ loading = null; rej(new Error("load")) }
    document.head.appendChild(s)
  })
  return loading
}

/** useGaze(videoRef, enabled) -> { state, summary(), error }. Runs only while enabled and the video has frames. Local only. */
export function useGaze(videoRef, enabled){
  const [state, setState] = useState("off")
  const [error, setError] = useState("")
  const trk = useRef(new GazeTracker())
  const refs = useRef({})
  useEffect(()=>{
    if(!enabled){ setState("off"); return }
    let dead = false, timer = null, mesh = null, busy = false
    trk.current.reset(); setState("calibrating"); setError("")
    ;(async ()=>{
      try{
        await loadMesh()
        mesh = new window.FaceMesh({ locateFile: f=>"/mediapipe/" + f })
        mesh.setOptions({ maxNumFaces: 2, refineLandmarks: true, minDetectionConfidence: .5, minTrackingConfidence: .5 })
        mesh.onResults(r=>{ if(dead) return; const st = trk.current.update(r.multiFaceLandmarks || [], performance.now()); setState(prev=>prev === st ? prev : st) })
        refs.current.mesh = mesh
        timer = setInterval(async ()=>{
          const v = videoRef.current
          if(dead || busy || !v || v.readyState < 2 || !v.videoWidth) return
          busy = true
          try{ await mesh.send({ image: v }) }catch(e){}
          busy = false
        }, 160)
      }catch(e){ if(!dead){ setError("Attention tracking load nahi hui (internet/browser). Baaki sab normal chalega."); setState("off") } }
    })()
    return ()=>{ dead = true; clearInterval(timer); try{ mesh?.close() }catch(e){} }
  }, [enabled])
  return { state, error, summary: ()=>trk.current.summary() }
}
