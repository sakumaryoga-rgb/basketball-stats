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
      // registerType:'autoUpdate'は、vite-plugin-pwaのvirtual:pwa-registerクライアント側の
      // 実装上、onNeedRefreshコールバックが一切発火しない(waitingイベントを購読しない)モードに
      // なってしまう。UpdatePromptによる「更新する」ボタンでの明示的な反映を機能させるには
      // registerType:'prompt'が必須(この名前は「デフォルトのプロンプトUIを注入する」という
      // 意味ではなく、単に「自動でskipWaitingしない」モードを指す。デフォルトUIの注入自体は
      // 下のinjectRegister:falseで別途無効化している)
      registerType: 'prompt',
      // main.jsxでvirtual:pwa-registerを使い、定期的な更新チェック+即時反映を自前で行うため、
      // 何もしないデフォルトの自動注入スクリプトは無効化する(そうしないと、デプロイ後も
      // 端末が古いキャッシュ済みバンドルを使い続けてしまう問題が起きていた)
      injectRegister: false,
      // clientsClaimがないと、skipWaiting後も既に開いているタブはnavigator.serviceWorker.
      // controllerchangeイベントを一切受け取れず(clients.claim()されないため)、
      // UpdatePromptの「更新する」を押してもページがリロードされない不具合が起きる
      workbox: {
        clientsClaim: true,
      },
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
