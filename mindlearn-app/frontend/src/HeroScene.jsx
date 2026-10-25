import { useEffect, useRef } from "react"
import * as THREE from "three"

export default function HeroScene({ energy = false }){
  const mountRef = useRef()
  const energyRef = useRef(energy)
  energyRef.current = energy
  useEffect(()=>{
    const mount = mountRef.current
    if(!mount) return
    const lowPower = window.innerWidth < 768 || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if(lowPower) return

    let width = mount.clientWidth, height = mount.clientHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, width/height, 0.1, 1000)
    camera.position.z = 23

    // distant starfield for depth
    const starCount = 300
    const starPos = new Float32Array(starCount*3)
    for(let i=0;i<starCount;i++){
      const r = 60 + Math.random()*60
      const theta = Math.random()*Math.PI*2
      const phi = Math.acos(2*Math.random()-1)
      starPos[i*3] = r*Math.sin(phi)*Math.cos(theta)
      starPos[i*3+1] = r*Math.sin(phi)*Math.sin(theta)
      starPos[i*3+2] = r*Math.cos(phi)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos,3))
    const starMat = new THREE.PointsMaterial({ color:0xCFC9FF, size:0.22, transparent:true, opacity:0.5 })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)
    const pLight1 = new THREE.PointLight(0x7C5CFC, 2.2, 100)
    pLight1.position.set(15, 10, 15)
    scene.add(pLight1)
    const pLight2 = new THREE.PointLight(0x22D3EE, 2.0, 100)
    pLight2.position.set(-15, -10, 10)
    scene.add(pLight2)

    // neural constellation
    const outerGroup = new THREE.Group()
    const NODE_COUNT = 120
    const radius = 11
    const nodePositions = []
    for(let i=0;i<NODE_COUNT;i++){
      const y = 1 - (i / (NODE_COUNT-1)) * 2
      const r = Math.sqrt(1 - y*y)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      nodePositions.push(new THREE.Vector3(x*radius, y*radius, z*radius))
    }
    const nodeGeo = new THREE.BufferGeometry()
    const nodeArr = new Float32Array(nodePositions.length*3)
    nodePositions.forEach((p,i)=>{ nodeArr[i*3]=p.x; nodeArr[i*3+1]=p.y; nodeArr[i*3+2]=p.z })
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodeArr,3))
    const nodeMat = new THREE.PointsMaterial({ color:0x9C8CFF, size:0.35, transparent:true, opacity:0.85 })
    const points = new THREE.Points(nodeGeo, nodeMat)
    outerGroup.add(points)

    const edgePositions = []
    const maxDist = 5.4
    for(let i=0;i<nodePositions.length;i++){
      for(let j=i+1;j<nodePositions.length;j++){
        if(nodePositions[i].distanceTo(nodePositions[j]) < maxDist){
          edgePositions.push(nodePositions[i].x, nodePositions[i].y, nodePositions[i].z)
          edgePositions.push(nodePositions[j].x, nodePositions[j].y, nodePositions[j].z)
        }
      }
    }
    const edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgePositions),3))
    const edgeMat = new THREE.LineBasicMaterial({ color:0x4C3CBF, transparent:true, opacity:0.22 })
    const edges = new THREE.LineSegments(edgeGeo, edgeMat)
    outerGroup.add(edges)
    scene.add(outerGroup)

    // center torus knot
    const centerGroup = new THREE.Group()
    const glowGeo = new THREE.IcosahedronGeometry(5.2, 1)
    const glowMat = new THREE.MeshBasicMaterial({ color:0x7C5CFC, transparent:true, opacity:0.06, side:THREE.BackSide })
    const glowMesh = new THREE.Mesh(glowGeo, glowMat)
    centerGroup.add(glowMesh)

    const coreGeo = new THREE.TorusKnotGeometry(3.6, 1.1, 180, 24)
    const coreMat = new THREE.MeshStandardMaterial({ color:0x7C5CFC, metalness:0.7, roughness:0.25, emissive:0x2A1F66, emissiveIntensity:0.5 })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    centerGroup.add(coreMesh)

    const wireGeo = new THREE.TorusKnotGeometry(3.75, 1.18, 90, 12)
    const wireMat = new THREE.MeshBasicMaterial({ color:0x22D3EE, wireframe:true, transparent:true, opacity:0.35 })
    const wireMesh = new THREE.Mesh(wireGeo, wireMat)
    centerGroup.add(wireMesh)

    scene.add(centerGroup)

    // orbiting rings with travelling light beads (adds a sense of time/motion)
    const orbitGroup = new THREE.Group()
    const orbitDefs = [
      { r:7.2, tilt:[1.1, 0.2],  color:0x2DE3F0, speed:0.7 },
      { r:8.8, tilt:[0.4, 0.9],  color:0x8B6BFF, speed:-0.5 },
      { r:10.4, tilt:[1.4, -0.6], color:0xFF6FB5, speed:0.35 },
    ]
    const orbitDisposables = []
    const beads = orbitDefs.map(def=>{
      const pivot = new THREE.Group()
      pivot.rotation.set(def.tilt[0], def.tilt[1], 0)
      const ringGeo = new THREE.TorusGeometry(def.r, 0.025, 8, 160)
      const ringMat = new THREE.MeshBasicMaterial({ color:def.color, transparent:true, opacity:0.35 })
      pivot.add(new THREE.Mesh(ringGeo, ringMat))
      const beadGeo = new THREE.SphereGeometry(0.32, 16, 16)
      const beadMat = new THREE.MeshBasicMaterial({ color:def.color })
      const bead = new THREE.Mesh(beadGeo, beadMat)
      const haloGeo = new THREE.SphereGeometry(0.75, 16, 16)
      const haloMat = new THREE.MeshBasicMaterial({ color:def.color, transparent:true, opacity:0.18 })
      bead.add(new THREE.Mesh(haloGeo, haloMat))
      pivot.add(bead)
      orbitGroup.add(pivot)
      orbitDisposables.push(ringGeo, ringMat, beadGeo, beadMat, haloGeo, haloMat)
      return { bead, def }
    })
    scene.add(orbitGroup)

    let mouseX = 0, mouseY = 0
    const onMouseMove = (e)=>{
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", onMouseMove)

    let scrollFactor = 0
    const onScroll = ()=>{
      scrollFactor = Math.min(window.scrollY / 1200, 1)
    }
    window.addEventListener("scroll", onScroll)

    const onResize = ()=>{
      width = mount.clientWidth; height = mount.clientHeight
      camera.aspect = width/height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener("resize", onResize)

    let raf, running = true, onScreen = true
    const clock = new THREE.Clock()
    let boost = 0, spin = 0
    // performance: pause when hero is off-screen or tab hidden; drop resolution if FPS is low
    const io = new IntersectionObserver(([en])=>{ onScreen = en.isIntersecting }, { threshold:0 })
    io.observe(mount)
    const onVis = ()=>{ running = !document.hidden }
    document.addEventListener("visibilitychange", onVis)
    let frames = 0, fpsStart = performance.now(), lastTs = performance.now(), checked = false
    const animate = ()=>{
      raf = requestAnimationFrame(animate)
      if(!running || !onScreen){ lastTs = performance.now(); return }
      const now = performance.now()
      const dt = Math.min((now - lastTs)/1000, 0.05); lastTs = now
      if(!checked){
        frames++
        if(now - fpsStart > 1500){
          checked = true
          const fps = frames / ((now - fpsStart)/1000)
          if(fps < 40){ renderer.setPixelRatio(1); renderer.setSize(width, height) }
        }
      }
      const t = clock.getElapsedTime()
      // energy: eases towards 1 while a PDF is dragged over / uploading, then back to 0
      boost += ((energyRef.current ? 1 : 0) - boost) * 0.07
      spin += dt * 60 * 0.016 * (1 + boost * 5)
      coreMesh.rotation.x = spin * 0.25
      coreMesh.rotation.y = spin * 0.35
      wireMesh.rotation.x = -spin * 0.2
      wireMesh.rotation.y = -spin * 0.3
      const pulse = 1 + boost * (0.1 + Math.sin(t*9) * 0.02)
      centerGroup.scale.set(pulse, pulse, pulse)
      pLight1.intensity = 2.2 + boost * 4
      pLight2.intensity = 2.0 + boost * 4
      glowMat.opacity = 0.06 + boost * 0.14
      wireMat.opacity = 0.35 + boost * 0.4
      outerGroup.rotation.y = t * 0.06
      outerGroup.rotation.x = Math.sin(t*0.05) * 0.1
      stars.rotation.y = t * 0.01

      beads.forEach(({bead, def})=>{
        const a = t * def.speed
        bead.position.set(Math.cos(a)*def.r, Math.sin(a)*def.r, 0)
      })
      orbitGroup.rotation.y = mouseX * 0.25
      orbitGroup.rotation.x = mouseY * 0.2
      orbitGroup.visible = (1 - scrollFactor*1.3) > 0.02
      centerGroup.rotation.y += (mouseX*0.4 - centerGroup.rotation.y) * 0.02
      centerGroup.rotation.x += (mouseY*0.3 - centerGroup.rotation.x) * 0.02

      const op = Math.max(1 - scrollFactor*1.3, 0)
      outerGroup.children.forEach(c=>{ if(c.material) c.material.opacity = (c===points?0.85:0.22) * op })
      coreMat.opacity = 1
      centerGroup.visible = op > 0.02
      outerGroup.visible = op > 0.02

      camera.position.z = 23 + scrollFactor*16
      renderer.render(scene, camera)
    }
    animate()

    return ()=>{
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      mount.removeChild(renderer.domElement)
      orbitDisposables.forEach(d=>d.dispose())
      starGeo.dispose(); starMat.dispose()
      nodeGeo.dispose(); nodeMat.dispose(); edgeGeo.dispose(); edgeMat.dispose()
      glowGeo.dispose(); glowMat.dispose(); coreGeo.dispose(); coreMat.dispose(); wireGeo.dispose(); wireMat.dispose()
      renderer.dispose()
    }
  },[])

  return <div ref={mountRef} style={{ position:"absolute", inset:0, zIndex:1, pointerEvents:"none" }} />
}
