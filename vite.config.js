import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// Self-host: removido o @base44/vite-plugin (recursos de editor/HMR da nuvem base44).
// O alias "@" era fornecido por aquele plugin — agora é declarado aqui.
export default defineConfig({
  logLevel: 'error',
  plugins: [
    react(),
    VitePWA({
      // PWA instalável/offline ATIVO com atualização garantida no F5. Usamos um
      // service worker CUSTOMIZADO (src/sw.js) via injectManifest porque ele
      // RECARREGA as abas abertas ao ativar uma versão nova — então um único F5
      // já mostra as alterações (e destrava SW antigo preso), sem ritual.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Construlog',
        short_name: 'Construlog',
        description: 'ERP de gestão de obras — Construlog',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Opções de geração do precache injetado no SW customizado (self.__WB_MANIFEST).
      // skipWaiting/clientsClaim/runtimeCaching/reload ficam dentro de src/sw.js.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
