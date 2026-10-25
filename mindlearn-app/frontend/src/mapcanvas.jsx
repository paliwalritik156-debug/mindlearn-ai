import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

function labelSprite(text){
  const c = document.createElement("canvas")
  c.width = 512; c.height = 128
  const g = c.getContext("2d")
  g.font = "600 46px Space Grotesk, Arial, sans-serif"
  g.textAlign = "center"; g.textBaseline = "middle"
  g.shadowColor = "rgba(0,0,0,0.9)"; g.shadowBlur = 10
  g.fillStyle = "#F6F4FF"
  let t = text.length > 22 ? text.slice(0, 21) + "…" : text
  g.fillText(t, 256, 64)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sp = new THREE.Sprite(mat)
  sp.scale.set(4.2, 1.05, 1)
  return sp
}

export default function MapCanvas({ concepts, selected, onSelect }){
  const mountRef = useRef()
  const selRef = useRef(selected)
  selRef.current = selected
  const api2 = useRef({})
  const [noGL, setNoGL] = useState(false)

  useEffect(()=>{
    const mount = mountRef.current
    if(!mount || !concepts.length) return
    let renderer
    try{ renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true }) }catch(e){ setNoGL(true); return }
    const W = ()=>mount.clientWidth, H = ()=>mount.clientHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setSize(W(), H())
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.touchAction = "none"
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, W()/H(), 0.1, 200)
    let zoomF = 1
    const baseZ = ()=>17 / Math.min(1, (W()/H()) * 1.15)
    camera.position.z = baseZ()
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const l1 = new THREE.PointLight(0x8B6BFF, 60, 80); l1.position.set(10, 8, 12); scene.add(l1)
    const l2 = new THREE.PointLight(0x2DE3F0, 50, 80); l2.position.set(-10, -6, 10); scene.add(l2)

    const group = new THREE.Group(); scene.add(group)
    const n = concepts.length
    const R = n < 6 ? 5 : 7.2
    const pos = concepts.map((_, i)=>{
      const y = n === 1 ? 0 : 1 - (i/(n-1)) * 2
      const r = Math.sqrt(Math.max(0, 1 - y*y)), th = Math.PI * (1 + Math.sqrt(5)) * i
      return new THREE.Vector3(Math.cos(th)*r*R, y*R, Math.sin(th)*r*R)
    })
    const disposables = []
    const nodes = concepts.map((c, i)=>{
      const col = new THREE.Color().setHSL(0.72 - (i/Math.max(1,n-1)) * 0.22, 0.85, 0.62)
      const geo = new THREE.SphereGeometry(0.5, 24, 24)
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.35 })
      const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(pos[i]); mesh.userData.i = i
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false }))
      mesh.add(halo)
      const label = labelSprite(c.name); label.position.set(0, 1.15, 0); mesh.add(label)
      group.add(mesh)
      disposables.push(geo, mat, halo.geometry, halo.material, label.material, label.material.map)
      return mesh
    })

    // edges from "related" lists, plus nearest-neighbour fallback so nothing floats alone
    const idx = Object.fromEntries(concepts.map((c,i)=>[c.name.toLowerCase(), i]))
    const edges = new Set()
    const add = (a,b)=>{ if(a!==b && a!==undefined && b!==undefined) edges.add(a<b ? a+"-"+b : b+"-"+a) }
    concepts.forEach((c,i)=>(c.related||[]).forEach(r=>add(i, idx[String(r).toLowerCase()])))
    const deg = new Array(n).fill(0)
    edges.forEach(e=>{ const [a,b] = e.split("-").map(Number); deg[a]++; deg[b]++ })
    deg.forEach((d,i)=>{ if(d === 0 && n > 1){
      let best = -1, bd = 1e9
      pos.forEach((p,j)=>{ if(j!==i){ const dd = p.distanceTo(pos[i]); if(dd < bd){ bd = dd; best = j } } })
      add(i, best)
    }})
    const edgeList = [...edges].map(e=>e.split("-").map(Number))
    const baseGeo = new THREE.BufferGeometry()
    baseGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgeList.flatMap(([a,b])=>[pos[a].x,pos[a].y,pos[a].z,pos[b].x,pos[b].y,pos[b].z])), 3))
    const baseMat = new THREE.LineBasicMaterial({ color: 0x6B54D8, transparent: true, opacity: 0.4 })
    group.add(new THREE.LineSegments(baseGeo, baseMat))
    const hiGeo = new THREE.BufferGeometry()
    const hiMat = new THREE.LineBasicMaterial({ color: 0x2DE3F0, transparent: true, opacity: 0.95 })
    const hi = new THREE.LineSegments(hiGeo, hiMat); group.add(hi)
    disposables.push(baseGeo, baseMat, hiGeo, hiMat)
    let hiFor = -2
    function updateHi(s){
      if(s === hiFor) return
      hiFor = s
      const pts = []
      if(s >= 0) edgeList.forEach(([a,b])=>{ if(a===s || b===s) pts.push(pos[a].x,pos[a].y,pos[a].z,pos[b].x,pos[b].y,pos[b].z) })
      hiGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3))
    }

    // interaction: drag to orbit, wheel / pinch-free zoom, click to select
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2()
    let down = false, moved = 0, lx = 0, ly = 0, vx = 0, vy = 0, idle = 0, hover = -1
    const dom = renderer.domElement
    function pick(e){
      const r = dom.getBoundingClientRect()
      mouse.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1)
      ray.setFromCamera(mouse, camera)
      const hits = ray.intersectObjects(nodes, false)
      return hits.length ? hits[0].object.userData.i : -1
    }
    const onDown = e=>{ down = true; moved = 0; lx = e.clientX; ly = e.clientY; idle = 0; dom.setPointerCapture?.(e.pointerId) }
    const onMove = e=>{
      if(down){
        const dx = e.clientX - lx, dy = e.clientY - ly
        moved += Math.abs(dx) + Math.abs(dy)
        vy = dx * 0.006; vx = dy * 0.006
        group.rotation.y += vy; group.rotation.x = Math.max(-1.2, Math.min(1.2, group.rotation.x + vx))
        lx = e.clientX; ly = e.clientY; idle = 0
      }else{
        hover = pick(e); dom.style.cursor = hover >= 0 ? "pointer" : "grab"
      }
    }
    const onUp = e=>{
      if(down && moved < 6){ const i = pick(e); onSelect(i >= 0 ? concepts[i].name : null) }
      down = false
    }
    const onWheel = e=>{ e.preventDefault(); zoomF = Math.max(0.5, Math.min(1.7, zoomF + e.deltaY * 0.0009)) }
    dom.addEventListener("pointerdown", onDown); dom.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp); dom.addEventListener("wheel", onWheel, { passive:false })
    dom.style.cursor = "grab"

    const ro = new ResizeObserver(()=>{ camera.aspect = W()/H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()) })
    ro.observe(mount)

    let raf
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const clock = new THREE.Clock()
    const wp = new THREE.Vector3()
    const tick = ()=>{
      raf = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()
      camera.position.z += (baseZ() * zoomF - camera.position.z) * 0.2
      if(!down){
        idle += 1
        if(!reduce && idle > 120) group.rotation.y += 0.0028
        vy *= 0.95; group.rotation.y += vy * 0.2
      }
      const si = idx[(selRef.current || "").toLowerCase()] ?? -1
      updateHi(si)
      nodes.forEach((m,i)=>{
        const target = i === si ? 1.35 : (i === hover ? 1.2 : 1)
        const s = m.scale.x + (target - m.scale.x) * 0.15
        m.scale.setScalar(s)
        const lab = m.children[1]
        lab.scale.set(4.2 / s, 1.05 / s, 1)
        m.getWorldPosition(wp)
        const depth = Math.max(0, Math.min(1, (wp.z + R) / (2 * R)))
        lab.material.opacity = i === si ? 1 : 0.22 + 0.78 * depth
        m.material.emissiveIntensity = i === si ? 0.9 : 0.35 + Math.sin(t*1.5 + i) * 0.08
        m.children[0].material.opacity = i === si ? 0.3 : 0.12
      })
      baseMat.opacity = si >= 0 ? 0.18 : 0.4
      renderer.render(scene, camera)
    }
    tick()
    api2.current.focus = (name)=>{
      const i = idx[(name||"").toLowerCase()]
      if(i === undefined) return
      const p = pos[i].clone().normalize()
      // rotate group so the node faces the camera
      group.rotation.y = -Math.atan2(p.x, p.z)
    }

    return ()=>{
      cancelAnimationFrame(raf); ro.disconnect()
      dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp); dom.removeEventListener("wheel", onWheel)
      disposables.forEach(d=>d && d.dispose && d.dispose())
      renderer.dispose(); mount.removeChild(dom)
    }
  },[JSON.stringify(concepts.map(c=>[c.name,c.related]))])

  if(noGL) return <div className="kmap-fallback">{concepts.map(c=><button key={c.name} className={"chip"+(selected===c.name?" on":"")} onClick={()=>onSelect(c.name)}>{c.name}</button>)}</div>
  return <div className="kmap-canvas" ref={mountRef} />
}
