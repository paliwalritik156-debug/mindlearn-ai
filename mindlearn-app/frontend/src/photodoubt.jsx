import { useRef, useState } from "react"
import { api, toast, Spin, getOutLang, LANGS } from "./lib.jsx"
import { fitSize } from "./v47lib.js"

function downscale(file, max = 1400){
  return new Promise((res, rej)=>{
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = ()=>{
      const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, max)
      const c = document.createElement("canvas"); c.width = w; c.height = h
      c.getContext("2d").drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82))
    }
    img.onerror = ()=>{ URL.revokeObjectURL(url); rej(new Error("bad image")) }
    img.src = url
  })
}

export default function PhotoDoubtTab(){
  const [img, setImg] = useState("")
  const [note, setNote] = useState("")
  const [ans, setAns] = useState("")
  const [busy, setBusy] = useState(false)
  const ref = useRef()
  const pick = async f=>{
    if(!f) return
    if(!/^image\//.test(f.type)) return toast("Sirf photo (JPG/PNG) chuno")
    try{ setImg(await downscale(f)); setAns("") }catch(e){ toast("Ye photo khul nahi payi, dusri try karo.") }
  }
  const solve = async ()=>{
    setBusy(true); setAns("")
    try{
      const l = LANGS[getOutLang()]
      const { data } = await api.post("/doubt/photo", { image: img, note: note.trim(), language: l?.prompt || "English" })
      setAns(data.answer)
    }catch(e){ toast(e?.response?.data?.detail || "Photo solve nahi ho payi. Dobara try karo.") }
    setBusy(false)
  }
  return (
    <div className="card tb" data-testid="photo-doubt">
      <h3>📸 Photo doubt</h3>
      <p>Kisi sawal ki photo kheencho (haath ka likha bhi chalega). AI padh ke step-by-step solve karega.</p>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={e=>{ pick(e.target.files[0]); e.target.value = "" }} />
      <div className="duel-actions"><button type="button" className="btn" onClick={()=>ref.current?.click()}>{img ? "Change photo" : "📷 Take / choose photo"}</button></div>
      {img && <img src={img} alt="Your question" className="pd-img" />}
      {img && <label>Note (optional)<input value={note} onChange={e=>setNote(e.target.value)} maxLength={300} placeholder="e.g. Class 11, find the acceleration" /></label>}
      {img && <button type="button" className="btn btn-p" onClick={solve} disabled={busy}>{busy ? <Spin /> : "Solve it"}</button>}
      {ans && <div className="pd-ans" data-testid="pd-ans">{ans.split("\n").map((l, i)=><p key={i}>{l}</p>)}</div>}
      {ans && <p className="coach-note">AI ne photo se padha hai, galat padh ya galat solve kar sakta hai. Answer ko apni book se verify karo. Photo sirf solve karne ke liye bheji jaati hai, hum save nahi karte.</p>}
    </div>
  )
}
