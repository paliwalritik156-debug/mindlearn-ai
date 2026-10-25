import { useEffect, useRef } from "react"
import * as THREE from "three"

export default function AmbientBG(){
  const mountRef = useRef()
  useEffect(()=>{
    const mount = mountRef.current
    if(!mount) return
    const lowPower = window.innerWidth < 768 || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if(lowPower) return

    let width = window.innerWidth, height = window.innerHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, width/height, 0.1, 1000)
    camera.position.z = 20

    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // helper: guarantee a point is inside camera frustum at a given z range
    function frustumPoint(zMin, zMax, fill=0.6){
      const z = -(zMin + Math.random()*(zMax-zMin))
      const dist = Math.abs(z - camera.position.z)
      const vFov = (camera.fov * Math.PI) / 180
      const h = 2 * Math.tan(vFov/2) * dist
      const w = h * camera.aspect
      const x = (Math.random()-0.5) * w * fill
      const y = (Math.random()-0.5) * h * fill
      return new THREE.Vector3(x, y, z)
    }

    const shapesDef = [
      { geo: new THREE.IcosahedronGeometry(6.3, 0), color:0x7C5CFC, name:"ico-violet" },
      { geo: new THREE.OctahedronGeometry(5.1, 0), color:0x22D3EE, name:"octa-cyan" },
      { geo: new THREE.TorusGeometry(5.1, 1.3, 8, 24), color:0xF472B6, name:"torus-pink" },
      { geo: new THREE.IcosahedronGeometry(4.0, 0), color:0x22D3EE, name:"ico-cyan" },
      { geo: new THREE.BoxGeometry(5.4, 6.9, 1.0), color:0xF5B13D, name:"book-amber" },
      { geo: new THREE.CylinderGeometry(0.24, 0.63, 7.8, 8), color:0x7C5CFC, name:"pencil-violet" },
    ]

    const shapes = shapesDef.map((def, i)=>{
      const mat = new THREE.MeshBasicMaterial({ color: def.color, wireframe:true, transparent:true, opacity:0.85 })
      const mesh = new THREE.Mesh(def.geo, mat)
      const p = frustumPoint(10, 55, 0.75)
      mesh.position.copy(p)
      mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI)
      mesh.userData.baseZ = p.z
      mesh.userData.spin = (Math.random()*0.4+0.15) * (i%2===0?1:-1)
      mesh.userData.spin2 = (Math.random()*0.3+0.1) * (i%2===0?-1:1)
      scene.add(mesh)
      return mesh
    })

    let scrollY = 0
    const onScroll = ()=>{ scrollY = window.scrollY }
    window.addEventListener("scroll", onScroll)

    const onResize = ()=>{
      width = window.innerWidth; height = window.innerHeight
      camera.aspect = width/height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener("resize", onResize)

    let raf
    const clock = new THREE.Clock()
    const animate = ()=>{
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const approach = Math.min(scrollY / 900, 1)
      // fade the whole field out once the hero has scrolled past, so shapes
      // never sit on top of content further down the page
      const fadeStart = window.innerHeight * 0.35
      const fadeEnd = window.innerHeight * 0.85
      const visibility = scrollY <= fadeStart ? 1 : Math.max(0, 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart))
      shapes.forEach(mesh=>{
        mesh.rotation.x += 0.002 * mesh.userData.spin
        mesh.rotation.y += 0.0025 * mesh.userData.spin2
        mesh.position.z = mesh.userData.baseZ + approach*7
        const s = 1 + approach*0.35
        mesh.scale.set(s,s,s)
        mesh.material.opacity = (0.85 - approach*0.15) * visibility
      })
      scene.visible = visibility > 0.01
      if(document.hidden || visibility <= 0.01) return
      renderer.render(scene, camera)
    }
    animate()

    return ()=>{
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      mount.removeChild(renderer.domElement)
      shapes.forEach(m=>{ m.geometry.dispose(); m.material.dispose() })
      renderer.dispose()
    }
  },[])

  return <div ref={mountRef} className="ambient-bg" style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", width:"100vw", height:"100vh" }} />
}
