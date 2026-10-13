import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? '/AHOY-vanity-wallet-generator/',
  worker: { format: 'es' },
  test: { environment: 'node' },
} as never)
