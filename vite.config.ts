import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pages: landing at /, app at /app/, landing design options at /designs/a/ and /designs/b/.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { landing: 'index.html', app: 'app/index.html', designA: 'designs/a/index.html', designB: 'designs/b/index.html' },
    },
  },
})
