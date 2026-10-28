import { useEffect, useState } from "react"
export function currentPage(){
  const m = /^#\/(about|privacy|terms|contact)$/.exec(location.hash)
  return m ? m[1] : null
}
export function usePage(){
  const [p, setP] = useState(currentPage())
  useEffect(()=>{ const f = ()=>setP(currentPage()); window.addEventListener("hashchange", f); return ()=>window.removeEventListener("hashchange", f) },[])
  return p
}
export function useHash(){
  const [, f] = useState(0)
  useEffect(()=>{ const h = ()=>f(n=>n + 1); window.addEventListener("hashchange", h); return ()=>window.removeEventListener("hashchange", h) },[])
}
export function resetToken(){
  const m = /^#\/reset\?token=([\w-]+)$/.exec(location.hash)
  return m ? m[1] : null
}

export function isAdminRoute(){ return location.hash === "#/admin" }
