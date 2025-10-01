import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/form', '@mantine/notifications'],
          charts: ['recharts'],
          icons: ['@tabler/icons-react']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'https://trading-notes.vercel.app',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          // Proxy configuration for API requests
        },
      }
    }
  }
})