import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = process.env.VITE_DEV_API || 'http://localhost:4000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Ask the user before activating a new version (so an update never
      // interrupts someone in the middle of entering an expense).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'SpendWise — Personal Finance',
        short_name: 'SpendWise',
        description: 'Offline-first money tracker: income, expenses, lending and borrowing.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f766e',
        background_color: '#f6f7f9',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Add expense', short_name: 'Expense', url: '/add?type=expense', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Add income', short_name: 'Income', url: '/add?type=income', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        screenshots: [
          { src: '/screenshots/mobile-dashboard.png', sizes: '1080x2200', type: 'image/png', form_factor: 'narrow', label: 'Dashboard' },
          { src: '/screenshots/mobile-add.png', sizes: '1080x2200', type: 'image/png', form_factor: 'narrow', label: 'Fast entry' },
          { src: '/screenshots/desktop-dashboard.png', sizes: '1440x900', type: 'image/png', form_factor: 'wide', label: 'Dashboard on desktop' },
        ],
      },
      workbox: {
        // Cache the app shell so the app opens with no connection. Financial
        // data is NOT cached here — it lives in IndexedDB.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        globIgnores: ['screenshots/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': API_TARGET },
    fs: { allow: ['..'] },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: { '/api': API_TARGET },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Separate long-lived vendor chunks so app updates re-download less.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['dexie', 'dexie-react-hooks', 'axios'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.{js,jsx}'],
  },
});
