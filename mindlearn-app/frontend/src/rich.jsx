import { useEffect, useMemo, useRef, useState } from "react"

/* Small, dependency-free Markdown renderer (headings, bold/italic, code, lists, tables, quotes, links, math).
   Everything is built as React elements, so there is no innerHTML and nothing to sanitise. */

let katexState = "idle", katexCbs = []
function loadKatex(){
  return new Promise(res=>{
    if(window.katex) return res(window.katex)
    katexCbs.push(res)
    if(katexState === "loading") return
    katexState = "loading"
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"; document.head.appendChild(css)
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"
    s.onload = ()=>{ katexState = "ready"; katexCbs.splice(0).forEach(f=>f(window.katex)) }
    s.onerror = ()=>{ katexState = "idle"; katexCbs.splice(0).forEach(f=>f(null)) }
    document.head.appendChild(s)
  })
}
function Math_({ tex, block }){
  const ref = useRef(null)
  const [done, setDone] = useState(false)
  useEffect(()=>{
    let dead = false
    loadKatex().then(k=>{ if(dead || !k || !ref.current) return; try{ k.render(tex, ref.current, { displayMode: !!block, throwOnError: false }); setDone(true) }catch(e){} })
    return ()=>{ dead = true }
  },[tex, block])
  return <span ref={ref} className={"rich-math" + (block ? " block" : "")}>{done ? null : <code>{block ? "$$" + tex + "$$" : "$" + tex + "$"}</code>}</span>
}

const safeUrl = u=>/^https?:\/\//i.test(u) ? u : null

function inline(text, key = "i"){
  const out = []; let i = 0, k = 0
  const re = /(`[^`\n]+`)|(\$\$[^$]+\$\$)|(\\\(.+?\\\))|(\$[^$\n]{1,200}\$)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/g
  let m
  while((m = re.exec(text))){
    if(m.index > i) out.push(text.slice(i, m.index))
    const t = m[0], kk = key + "-" + (k++)
    if(m[1]) out.push(<code key={kk} className="rich-ic">{t.slice(1, -1)}</code>)
    else if(m[2]) out.push(<Math_ key={kk} tex={t.slice(2, -2)} block />)
    else if(m[3]) out.push(<Math_ key={kk} tex={t.slice(2, -2)} />)
    else if(m[4]){ const tex = t.slice(1, -1); /\d\s*$|^\s*\d/.test(tex) && !/[\\^_=+\-*/{}]/.test(tex) ? out.push(t) : out.push(<Math_ key={kk} tex={tex} />) }
    else if(m[5] || m[6]) out.push(<strong key={kk}>{inline(t.slice(2, -2), kk)}</strong>)
    else if(m[7]) out.push(<em key={kk}>{inline(t.slice(1, -1), kk)}</em>)
    else if(m[8]){ const mm = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(t), u = safeUrl(mm[2]); out.push(u ? <a key={kk} href={u} target="_blank" rel="noopener noreferrer">{mm[1]}</a> : mm[1]) }
    i = m.index + t.length
  }
  if(i < text.length) out.push(text.slice(i))
  return out
}

function CodeBlock({ lang, code }){
  const [ok, setOk] = useState(false)
  return (
    <div className="rich-code">
      <div className="rc-bar"><span>{lang || "code"}</span><button onClick={()=>{ try{ navigator.clipboard.writeText(code); setOk(true); setTimeout(()=>setOk(false), 1400) }catch(e){} }}>{ok ? "✓ Copied" : "Copy"}</button></div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

function parse(src){
  const lines = String(src || "").replace(/\r/g, "").split("\n")
  const blocks = []; let i = 0
  const isTableSep = l=>/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || "")
  while(i < lines.length){
    const line = lines[i]
    if(!line.trim()){ i++; continue }
    let m
    if((m = /^```\s*([\w+#-]*)/.exec(line))){
      const code = []; i++
      while(i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      i++; blocks.push({ t:"code", lang:m[1], code: code.join("\n") }); continue
    }
    if(/^\s*\$\$\s*$/.test(line)){
      const tex = []; i++
      while(i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) tex.push(lines[i++])
      i++; blocks.push({ t:"math", tex: tex.join("\n") }); continue
    }
    if((m = /^(#{1,4})\s+(.*)$/.exec(line))){ blocks.push({ t:"h", n:m[1].length, text:m[2] }); i++; continue }
    if(/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)){ blocks.push({ t:"hr" }); i++; continue }
    if(line.includes("|") && isTableSep(lines[i + 1])){
      const cells = l=>l.trim().replace(/^\||\|$/g, "").split("|").map(c=>c.trim())
      const head = cells(line); i += 2; const rows = []
      while(i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]))
      blocks.push({ t:"table", head, rows }); continue
    }
    if(/^\s*>/.test(line)){
      const q = []; while(i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""))
      blocks.push({ t:"quote", text:q.join("\n") }); continue
    }
    if(/^\s*([-*•]|\d+[.)])\s+/.test(line)){
      const ordered = /^\s*\d+[.)]\s+/.test(line), items = []
      while(i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])){ items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, "")); i++ }
      blocks.push({ t: ordered ? "ol" : "ul", items }); continue
    }
    const p = [line]; i++
    while(i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*>|\s*([-*•]|\d+[.)])\s+|\s*\$\$\s*$)/.test(lines[i]) && !(lines[i].includes("|") && isTableSep(lines[i + 1]))) p.push(lines[i++])
    blocks.push({ t:"p", text:p.join("\n") })
  }
  return blocks
}

export default function Rich({ text, streaming }){
  const blocks = useMemo(()=>parse(text), [text])
  return (
    <div className={"rich" + (streaming ? " streaming" : "")}>
      {blocks.map((b, i)=>{
        if(b.t === "h"){ const H = "h" + Math.min(6, b.n + 2); return <H key={i} className="rich-h">{inline(b.text, "h" + i)}</H> }
        if(b.t === "p") return <p key={i}>{inline(b.text, "p" + i)}</p>
        if(b.t === "code") return <CodeBlock key={i} lang={b.lang} code={b.code} />
        if(b.t === "math") return <div key={i} className="rich-mathblock"><Math_ tex={b.tex} block /></div>
        if(b.t === "hr") return <hr key={i} />
        if(b.t === "quote") return <blockquote key={i}>{inline(b.text, "q" + i)}</blockquote>
        if(b.t === "ul") return <ul key={i}>{b.items.map((it, j)=><li key={j}>{inline(it, "u" + i + j)}</li>)}</ul>
        if(b.t === "ol") return <ol key={i}>{b.items.map((it, j)=><li key={j}>{inline(it, "o" + i + j)}</li>)}</ol>
        if(b.t === "table") return (
          <div key={i} className="rich-tablewrap"><table><thead><tr>{b.head.map((c, j)=><th key={j}>{inline(c, "th" + i + j)}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j)=><tr key={j}>{r.map((c, k)=><td key={k}>{inline(c, "td" + i + j + k)}</td>)}</tr>)}</tbody></table></div>)
        return null
      })}
    </div>
  )
}
