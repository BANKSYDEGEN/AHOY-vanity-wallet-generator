import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build --mode offline` produces ONE self-contained HTML file (all JS, CSS,
// fonts, images and the worker inlined) that runs from file:// with no network.
const offlineCsp: Plugin = {
  name: 'offline-csp',
  transformIndexHtml: (html) =>
    html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace('<link rel="icon" type="image/png" href="./favicon.png" />', ''),
}

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline'
  return {
    plugins: [react(), tailwindcss(), ...(offline ? [viteSingleFile(), offlineCsp] : [])],
    base: offline ? './' : process.env.VITE_BASE ?? '/',
    build: offline ? { outDir: 'dist-offline', emptyOutDir: true, copyPublicDir: false } : {},
    // Classic (iife) worker offline: Chrome won't start module workers from a file:// page.
    worker: { format: offline ? 'iife' : 'es' },
    test: { environment: 'node' },
  } as never
})
