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
    // iridescent "glass" shader: dark body, rim light that shifts cyan -> violet -> pink
    const coreMat = new THREE.ShaderMaterial({
      uniforms:{ uTime:{ value:0 }, uBoost:{ value:0 } },
      vertexShader:`varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
      fragmentShader:`uniform float uTime; uniform float uBoost; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.2);
          float t = uTime*0.35 + vP.x*0.12 + vP.y*0.09;
          vec3 a = vec3(0.13,0.83,0.93), b = vec3(0.49,0.36,0.99), c = vec3(1.0,0.44,0.71);
          vec3 rim = mix(mix(a,b,0.5+0.5*sin(t)), c, 0.5+0.5*sin(t*0.7+2.0));
          float stripe = 0.5 + 0.5*sin(vP.y*2.2 + uTime*1.3);
          vec3 body = vec3(0.035,0.03,0.09) + b*0.10*stripe;
          vec3 col = body + rim*(f*1.5 + 0.12) + rim*uBoost*0.35;
          gl_FragColor = vec4(col, 1.0);
        }`
    })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    centerGroup.add(coreMesh)

    const wireGeo = new THREE.TorusKnotGeometry(3.75, 1.18, 90, 12)
    const wireMat = new THREE.MeshBasicMaterial({ color:0x22D3EE, wireframe:true, transparent:true, opacity:0.35 })
    const wireMesh = new THREE.Mesh(wireGeo, wireMat)
    centerGroup.add(wireMesh)

    // soft additive glow sprite behind the core (fake bloom)
    const mkTex = (inner)=>{
      const c = document.createElement("canvas"); c.width = c.height = 128
      const g = c.getContext("2d"); const gr = g.createRadialGradient(64,64,0,64,64,64)
      gr.addColorStop(0, inner); gr.addColorStop(1, "rgba(0,0,0,0)")
      g.fillStyle = gr; g.fillRect(0,0,128,128)
      return new THREE.CanvasTexture(c)
    }
    const glowTex = mkTex("rgba(124,92,252,0.55)")
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:0.9 }))
    glowSprite.scale.set(26, 26, 1); glowSprite.position.z = -3
    centerGroup.add(glowSprite)
    scene.add(centerGroup)

    // spiral galaxy of light dust around the core
    const dotTex = mkTex("rgba(255,255,255,1)")
    nodeMat.map = dotTex; nodeMat.alphaTest = 0.08; nodeMat.size = 0.5; nodeMat.needsUpdate = true
    const GCOUNT = 1600
    const gPos = new Float32Array(GCOUNT*3), gCol = new Float32Array(GCOUNT*3)
    const cA = new THREE.Color(0x22D3EE), cB = new THREE.Color(0x8B6BFF), cC = new THREE.Color(0xFF6FB5)
    for(let i=0;i<GCOUNT;i++){
      const arm = i % 3, rr = 5 + Math.pow(Math.random(), 0.7) * 11
      const ang = rr * 0.55 + arm * (Math.PI*2/3) + (Math.random()-0.5) * 0.5
      gPos[i*3] = Math.cos(ang) * rr
      gPos[i*3+1] = (Math.random()-0.5) * (1.4 + rr*0.12)
      gPos[i*3+2] = Math.sin(ang) * rr
      const col = (arm===0?cA:arm===1?cB:cC).clone().lerp(cB, Math.random()*0.4)
      gCol[i*3]=col.r; gCol[i*3+1]=col.g; gCol[i*3+2]=col.b
    }
    const gGeo = new THREE.BufferGeometry()
    gGeo.setAttribute("position", new THREE.BufferAttribute(gPos,3))
    gGeo.setAttribute("color", new THREE.BufferAttribute(gCol,3))
    const gMat = new THREE.PointsMaterial({ size:0.36, map:dotTex, vertexColors:true, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false })
    const galaxy = new THREE.Points(gGeo, gMat)
    galaxy.rotation.x = 0.9; galaxy.rotation.z = -0.25
    scene.add(galaxy)


    // ===== signature: a PDF page that dissolves into a mind, then into flashcards =====
    const MN = 7000
    const rnd = (a,b)=>a + Math.random()*(b-a)
    const shapePage = ()=>{
      const out = new Float32Array(MN*3)
      const W = 8, H = 10.8
      for(let i=0;i<MN;i++){
        let x, y, r = Math.random()
        if(r < 0.58){            // text lines
          const row = Math.floor(rnd(0, 13)); y = H/2 - 2.3 - row*0.62
          const seg = (row*37 % 5) / 5; x = rnd(-W/2+0.9, W/2-0.9 - seg*2.2)
          if(row === 0){ y = H/2 - 1.2; x = rnd(-W/2+0.9, 0.5) }   // title line
        }else if(r < 0.84){      // page outline with a folded corner
          const e = Math.floor(rnd(0,4)), u = Math.random()
          if(e===0){ x = rnd(-W/2, W/2-1.6); y = H/2 } else if(e===1){ x = -W/2; y = rnd(-H/2, H/2) }
          else if(e===2){ x = rnd(-W/2, W/2); y = -H/2 } else { x = W/2; y = rnd(-H/2, H/2-1.6) }
          if(e===0 && u > 0.5){ const t = Math.random(); x = W/2 - 1.6 + t*1.6; y = H/2 - t*1.6 }
        }else{                   // a figure block
          x = rnd(-W/2+0.9, W/2-0.9); y = rnd(-H/2+0.8, -H/2+2.4)
        }
        out[i*3] = x; out[i*3+1] = y; out[i*3+2] = rnd(-0.12, 0.12)
      }
      return out
    }
    const shapeMind = ()=>{
      const out = new Float32Array(MN*3)
      for(let i=0;i<MN;i++){
        const y = 1 - (i/(MN-1))*2, r = Math.sqrt(1-y*y), th = Math.PI*(1+Math.sqrt(5))*i
        const R = 5.4 + (Math.random()<0.18 ? rnd(-1.4,1.4) : rnd(-0.12,0.12))
        out[i*3] = Math.cos(th)*r*R; out[i*3+1] = y*R; out[i*3+2] = Math.sin(th)*r*R
      }
      return out
    }
    const shapeCards = ()=>{
      const out = new Float32Array(MN*3)
      const cards = [ { x:-1.6, y:1.2, z:-1.6, rz:0.16 }, { x:0.4, y:0, z:0, rz:-0.07 }, { x:2.0, y:-1.3, z:1.7, rz:0.13 } ]
      const cw = 7.2, ch = 4.7
      for(let i=0;i<MN;i++){
        const c = cards[i % 3]; let x, y
        if(Math.random() < 0.6){ const e = Math.floor(rnd(0,4)); x = e<2 ? rnd(-cw/2,cw/2) : (e===2?-cw/2:cw/2); y = e<2 ? (e===0?ch/2:-ch/2) : rnd(-ch/2,ch/2) }
        else if(Math.random() < 0.5){ x = rnd(-cw/2+0.7, cw/2-0.7); y = Math.round(rnd(-1,1))*0.9 + 0.4 }   // text rows
        else{ x = rnd(-cw/2,cw/2); y = rnd(-ch/2,ch/2) }
        const cs = Math.cos(c.rz), sn = Math.sin(c.rz)
        out[i*3] = c.x + x*cs - y*sn; out[i*3+1] = c.y + x*sn + y*cs; out[i*3+2] = c.z + rnd(-0.1,0.1)
      }
      return out
    }
    const mGeo = new THREE.BufferGeometry()
    const sP = shapePage(), sM = shapeMind(), sC = shapeCards()
    mGeo.setAttribute("position", new THREE.BufferAttribute(sP,3))
    mGeo.setAttribute("aB", new THREE.BufferAttribute(sM,3))
    mGeo.setAttribute("aC", new THREE.BufferAttribute(sC,3))
    const rr = new Float32Array(MN*4); for(let i=0;i<rr.length;i++) rr[i] = Math.random()
    mGeo.setAttribute("aR", new THREE.BufferAttribute(rr,4))
    const mMat = new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uPhase:{ value:0 }, uTime:{ value:0 }, uMouse:{ value:new THREE.Vector2(99,99) }, uBoost:{ value:0 }, uPx:{ value:renderer.getPixelRatio() } },
      vertexShader:`attribute vec3 aB; attribute vec3 aC; attribute vec4 aR;
        uniform float uPhase, uTime, uBoost, uPx; uniform vec2 uMouse; varying vec3 vCol; varying float vA;
        vec3 pick(float i, vec3 a, vec3 b, vec3 c){ return i < 0.5 ? a : (i < 1.5 ? b : c); }
        void main(){
          float ph = mod(uPhase, 3.0); float i0 = floor(ph); float f = fract(ph);
          float i1 = mod(i0 + 1.0, 3.0);
          float e = f*f*(3.0-2.0*f);
          vec3 p0 = pick(i0, position, aB, aC), p1 = pick(i1, position, aB, aC);
          vec3 p = mix(p0, p1, clamp(e*1.25 - aR.x*0.25, 0.0, 1.0));
          float burst = sin(e*3.14159);
          p += (aR.xyz - 0.5) * 9.0 * burst;                              // dissolve in transit
          p.xz += vec2(cos(uTime*0.6 + aR.w*6.28), sin(uTime*0.5 + aR.w*6.28)) * 0.05;
          p.y += sin(uTime*1.2 + aR.w*20.0) * 0.06;
          vec2 d = p.xy - uMouse; float dl = length(d);                       // cursor pushes dust away
          p.xy += normalize(d + 0.0001) * smoothstep(3.6, 0.0, dl) * 2.6;
          p.z += smoothstep(3.6, 0.0, dl) * 1.6;
          vec3 cPage = vec3(0.78,0.92,1.0), cMind = vec3(0.55,0.42,1.0), cCard = vec3(1.0,0.50,0.75);
          vec3 c0 = pick(i0, cPage, cMind, cCard), c1 = pick(i1, cPage, cMind, cCard);
          vCol = mix(c0, c1, e) + vec3(0.0,0.25,0.3) * smoothstep(0.55, 1.0, aR.x) * 0.5;
          vA = 0.55 + 0.45*aR.y + uBoost*0.3;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = (0.7 + aR.z*1.1 + burst*0.8 + uBoost*0.6) * uPx * (22.0 / -mv.z) * 2.1;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader:`varying vec3 vCol; varying float vA;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if(d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vCol * (0.6 + a), a * vA); }`
    })
    const morph = new THREE.Points(mGeo, mMat)
    morph.frustumCulled = false
    const morphGroup = new THREE.Group(); morphGroup.add(morph); morphGroup.position.y = 2.2; morphGroup.scale.setScalar(0.92); scene.add(morphGroup)
    coreMesh.visible = false; wireMesh.visible = false
    let lastPhase = -1
    const HOLD = 3.4, MOVE = 1.8
    const phaseAt = (t)=>{ const cyc = HOLD + MOVE, k = Math.floor(t / cyc), r = t - k*cyc; return (k % 3) + (r < HOLD ? 0 : (r - HOLD) / MOVE) }
    const mouseLocal = new THREE.Vector2(99, 99)
    const onMountMove = (e)=>{
      const r = mount.getBoundingClientRect()
      const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * camera.position.z, hw = hh * camera.aspect
      mouseLocal.set(((e.clientX - r.left)/r.width - 0.5) * 2 * hw, -((e.clientY - r.top)/r.height - 0.5) * 2 * hh)
    }
    const onMountLeave = ()=>mouseLocal.set(99, 99)
    window.addEventListener("mousemove", onMountMove)
    mount.parentElement?.addEventListener("mouseleave", onMountLeave)

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
      const ph = phaseAt(t * (1 + boost * 1.5))
      mMat.uniforms.uPhase.value = ph; mMat.uniforms.uTime.value = t; mMat.uniforms.uBoost.value = boost
      mMat.uniforms.uMouse.value.lerp(mouseLocal, 0.25)
      morphGroup.rotation.y = Math.sin(t*0.35) * 0.35 + mouseX * 0.25
      morphGroup.rotation.x = -mouseY * 0.15
      const pi = Math.floor(ph % 3 + 0.5) % 3
      if(pi !== lastPhase){ lastPhase = pi; window.dispatchEvent(new CustomEvent("ml-hero-phase", { detail: pi })) }
      morphGroup.visible = (1 - scrollFactor*1.3) > 0.02
      coreMat.uniforms.uTime.value = t
      coreMat.uniforms.uBoost.value = boost
      galaxy.rotation.y = t * (0.05 + boost * 0.25)
      glowSprite.material.opacity = 0.75 + Math.sin(t*1.2) * 0.12 + boost * 0.25
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
      centerGroup.visible = op > 0.02
      outerGroup.visible = op > 0.02

      // cinematic camera drift following the pointer
      camera.position.x += (mouseX * 2.2 - camera.position.x) * 0.04
      camera.position.y += (-mouseY * 1.4 - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)
      galaxy.visible = op > 0.02
      gMat.opacity = 0.85 * op
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
      window.removeEventListener("mousemove", onMountMove)
      mount.parentElement?.removeEventListener("mouseleave", onMountLeave)
      mGeo.dispose(); mMat.dispose()
      gGeo.dispose(); gMat.dispose(); dotTex.dispose(); glowTex.dispose(); glowSprite.material.dispose()
      renderer.dispose()
    }
  },[])

  return <div ref={mountRef} style={{ position:"absolute", inset:0, zIndex:1, pointerEvents:"none" }} />
}
