import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    // Acesse o app em http://demo.localhost:5173 → com changeOrigin:false o Host
    // "demo.localhost" é repassado ao backend, e o django-tenants resolve o tenant "demo".
    allowedHosts: ['.localhost'],
    // Só os endpoints de navegador do backend (OAuth/webhooks) são proxiados.
    // NÃO proxiar `/integracoes` e `/notificacoes` inteiros: são rotas do SPA
    // (senão o reload dessas telas cai no Django → 404). O fallback do Vite serve
    // o index.html para as demais rotas do SPA.
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
      '/health': { target: BACKEND, changeOrigin: false },
      '/integracoes/google': { target: BACKEND, changeOrigin: false },
      '/notificacoes/whatsapp': { target: BACKEND, changeOrigin: false },
    },
  },
})
