// Offline support: precache the built app (via precache.json), cache-first for static files, network-first for pages. API calls are never touched.
const CACHE = "mindlearn-v31"
self.addEventListener("install", e=>{
  self.skipWaiting()
  e.waitUntil((async()=>{
    const c = await caches.open(CACHE)
    await c.addAll(["/", "/favicon.svg", "/manifest.webmanifest", "/icon-192.png"]).catch(()=>{})
    try{ const list = await (await fetch("/precache.json", { cache:"no-store" })).json(); await Promise.all(list.map(u=>c.add(u).catch(()=>{}))) }catch(err){ /* dev mode: no manifest */ }
  })())
})
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))
})
self.addEventListener("fetch", e=>{
  const req = e.request
  const url = new URL(req.url)
  if(req.method !== "GET" || url.origin !== self.location.origin) return
  if(req.mode === "navigate"){
    e.respondWith(fetch(req).then(r=>{ const copy = r.clone(); caches.open(CACHE).then(c=>c.put("/", copy)); return r }).catch(()=>caches.match("/")))
    return
  }
  e.respondWith(caches.match(req).then(hit=>{
    if(hit) return hit
    return fetch(req).then(r=>{ if(r.ok && !url.pathname.endsWith(".mp4") && !url.pathname.endsWith(".webm")){ const copy = r.clone(); caches.open(CACHE).then(c=>c.put(req, copy)) } return r })
  }))
})
