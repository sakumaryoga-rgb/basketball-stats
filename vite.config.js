import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // main.jsxでvirtual:pwa-registerを使い、定期的な更新チェック+即時反映を自前で行うため、
      // 何もしないデフォルトの自動注入スクリプトは無効化する(そうしないと、デプロイ後も
      // 端末が古いキャッシュ済みバンドルを使い続けてしまう問題が起きていた)
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'favicon.png'],
      manifest: {
        name: 'BASKETBALL STATS',
        short_name: 'BASKETBALL STATS',
        description: 'チームのバスケットボールスタッツを記録・集計するアプリ',
        start_url: '/',
        display: 'standalone',
        background_color: '#FBFBFA',
        theme_color: '#FBFBFA',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), './src'),
    },
  },
})
