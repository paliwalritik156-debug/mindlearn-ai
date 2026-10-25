import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Writes dist/precache.json (list of every built file) so the service worker can cache the whole app for offline use.
function precacheManifest(){
  return {
    name: 'ml-precache',
    apply: 'build',
    generateBundle(_, bundle){
      const files = Object.keys(bundle).filter(f => /\.(js|css|woff2?)$/.test(f) && !/three\.module/.test(f)).map(f => '/' + f)
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) })
    },
  }
}

export default defineConfig({
  plugins: [react(), precacheManifest()],
})
