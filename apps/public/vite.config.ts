import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/admin/, /^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/api\/events\/.*\/config$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'config-cache', expiration: { maxEntries: 10, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /\/api\/events\/.*\/participants/,
            handler: 'NetworkFirst',
            options: { cacheName: 'participants-cache', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /\/api\/events\/.*\/export\/stats/,
            handler: 'NetworkFirst',
            options: { cacheName: 'stats-cache', expiration: { maxEntries: 10, maxAgeSeconds: 300 } },
          },
        ],
      },
      manifest: {
        name: 'CheckFlow - Accueil',
        short_name: 'CheckFlow',
        description: 'Application de check-in QR et signature',
        theme_color: '#2563eb',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: '/vite.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
