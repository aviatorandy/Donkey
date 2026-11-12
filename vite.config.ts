import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Two pages: the landing page at / and the app at /app/.
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { landing: 'index.html', app: 'app/index.html' } } },
})
