import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(<App/>)

// offline / installable app (production builds only)
if("serviceWorker" in navigator && import.meta.env.PROD){
  window.addEventListener("load", ()=>{ navigator.serviceWorker.register("/sw.js").catch(()=>{}) })
}
