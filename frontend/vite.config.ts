import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Para desenvolvimento com subdomínios, o proxy precisa passar o Host correto
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Se a requisição vier de um subdomínio, manter o Host original
            const host = req.headers.host;
            if (host && host.includes('localhost')) {
              // Manter o host original para que o django-tenants identifique o tenant
              proxyReq.setHeader('Host', host.replace(':5173', ':8000'));
            }
          });
        },
      },
    },
  },
})

