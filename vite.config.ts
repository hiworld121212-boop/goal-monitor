import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // Vite serves locally from the root; production assets use this GitHub Pages repo path.
  base: command === 'serve' ? '/' : '/goal-monitor/',
  plugins: [react()],
}))
