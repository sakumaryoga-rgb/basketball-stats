import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// デフォルトの自動注入スクリプトは登録するだけで更新チェックを行わないため、デプロイ後も
// 端末が古いキャッシュ済みバンドルを使い続けてしまっていた(共有URL方式への移行時に発覚)。
// 新しいバージョンを検知したら確認なしで即座に反映し、さらに1時間おきに能動的にチェックする。
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60 * 60 * 1000)
  },
  onNeedRefresh() {
    updateSW(true)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
