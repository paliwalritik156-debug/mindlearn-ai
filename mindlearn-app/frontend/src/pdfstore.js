// Keeps the uploaded PDFs in the browser (IndexedDB) so answers can be matched back to a page,
// and loads pdf.js from a CDN only when needed.
const DB = "mlpdfs", ST = "files"
const PDFJS_VER = "4.4.168"
const CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/`

function openDb(){
  return new Promise((res, rej)=>{
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = ()=>r.result.createObjectStore(ST)
    r.onsuccess = ()=>res(r.result)
    r.onerror = ()=>rej(r.error)
  })
}
let indexP = null

export function pdfNames(){
  try{ return JSON.parse(localStorage.getItem("ml_pdfs") || "[]") }catch(e){ return [] }
}
export function hasPdfs(){ return pdfNames().length > 0 }

export async function savePdfs(files){
  try{
    const db = await openDb()
    const names = []
    for(const f of Array.from(files)){
      const buf = await f.arrayBuffer()
      await new Promise((res, rej)=>{
        const tx = db.transaction(ST, "readwrite")
        tx.objectStore(ST).put(buf, f.name)
        tx.oncomplete = res; tx.onerror = ()=>rej(tx.error)
      })
      names.push(f.name)
    }
    localStorage.setItem("ml_pdfs", JSON.stringify(names))
    try{ const m = JSON.parse(localStorage.getItem("ml_libmeta")||"{}"); names.forEach(n=>{ m[n]=Date.now() }); localStorage.setItem("ml_libmeta", JSON.stringify(m)) }catch(e){}
    indexP = null
  }catch(e){}
}

export async function getBuffer(name){
  const db = await openDb()
  return new Promise((res, rej)=>{
    const rq = db.transaction(ST).objectStore(ST).get(name)
    rq.onsuccess = ()=>res(rq.result); rq.onerror = ()=>rej(rq.error)
  })
}

let libP = null
export function loadPdfJs(){
  if(!libP){
    libP = import(/* @vite-ignore */ (window.__PDFJS_URL__ || CDN + "pdf.min.mjs")).then(m=>{
      m.GlobalWorkerOptions.workerSrc = window.__PDFJS_WORKER__ || (CDN + "pdf.worker.min.mjs")
      return m
    }).catch(e=>{ libP = null; throw e })
  }
  return libP
}

async function buildIndex(){
  const pdfjs = await loadPdfJs()
  const pages = []
  for(const name of pdfNames()){
    const buf = await getBuffer(name)
    if(!buf) continue
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise
    for(let p = 1; p <= doc.numPages; p++){
      const pg = await doc.getPage(p)
      const tc = await pg.getTextContent()
      pages.push({ pdf:name, page:p, text: tc.items.map(i=>i.str).join(" ").toLowerCase() })
    }
  }
  return pages
}
export function getIndex(){
  if(!indexP) indexP = buildIndex().catch(e=>{ indexP = null; throw e })
  return indexP
}

const STOP = new Set(["the","and","that","this","with","from","into","which","there","their","about","these","those","where","when","what","have","been","were","also","more","than","then","your","will","would","could","should","because","while","each","other","such","only","both","very","using","used","uses"])
export function keywordsOf(text){
  return [...new Set(String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w=>w.length >= 4 && !STOP.has(w)))].slice(0, 60)
}

// best matching page for a piece of AI text (approximate, computed in the browser)
export async function findBest(answer){
  const kws = keywordsOf(answer)
  if(kws.length < 4) return null
  const pages = await getIndex()
  let best = null
  for(const pg of pages){
    let hits = 0
    for(const k of kws) if(pg.text.includes(k)) hits++
    if(!best || hits > best.hits) best = { pdf:pg.pdf, page:pg.page, hits }
  }
  if(!best || best.hits < 3 || best.hits / kws.length < 0.25) return null
  return { ...best, keywords: kws }
}

// ---------------- document library ----------------
export async function listLibrary(){
  const db = await openDb()
  const out = []
  await new Promise((res, rej)=>{
    const rq = db.transaction(ST).objectStore(ST).openCursor()
    rq.onsuccess = ()=>{
      const c = rq.result
      if(c){ out.push({ name: c.key, size: c.value ? c.value.byteLength : 0 }); c.continue() } else res()
    }
    rq.onerror = ()=>rej(rq.error)
  })
  let meta = {}
  try{ meta = JSON.parse(localStorage.getItem("ml_libmeta") || "{}") }catch(e){}
  return out.map(o=>({ ...o, at: meta[o.name] || 0 })).sort((a,b)=>b.at - a.at)
}
export function markLibrary(names){
  let meta = {}
  try{ meta = JSON.parse(localStorage.getItem("ml_libmeta") || "{}") }catch(e){}
  names.forEach(n=>{ meta[n] = Date.now() })
  localStorage.setItem("ml_libmeta", JSON.stringify(meta))
}
export async function getLibraryFile(name){
  const buf = await getBuffer(name)
  if(!buf) throw new Error("File not found in this browser.")
  return new File([buf], name, { type: "application/pdf" })
}
export async function removeFromLibrary(name){
  const db = await openDb()
  await new Promise((res, rej)=>{
    const tx = db.transaction(ST, "readwrite")
    tx.objectStore(ST).delete(name)
    tx.oncomplete = res; tx.onerror = ()=>rej(tx.error)
  })
  try{
    const meta = JSON.parse(localStorage.getItem("ml_libmeta") || "{}"); delete meta[name]
    localStorage.setItem("ml_libmeta", JSON.stringify(meta))
    localStorage.setItem("ml_pdfs", JSON.stringify(pdfNames().filter(n=>n!==name)))
  }catch(e){}
  indexP = null
}
export async function clearLibrary(){
  const db = await openDb()
  await new Promise((res, rej)=>{
    const tx = db.transaction(ST, "readwrite")
    tx.objectStore(ST).clear()
    tx.oncomplete = res; tx.onerror = ()=>rej(tx.error)
  })
  localStorage.removeItem("ml_libmeta"); localStorage.removeItem("ml_pdfs"); indexP = null
}
