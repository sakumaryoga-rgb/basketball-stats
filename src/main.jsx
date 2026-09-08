import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { setNeedRefresh, setUpdateFn } from '@/lib/swUpdate'
import { checkMinSupportedVersion } from '@/lib/appVersion'
import './index.css'
import App from './App.jsx'

// デフォルトの自動注入スクリプトは登録するだけで更新チェックを行わないため、デプロイ後も
// 端末が古いキャッシュ済みバンドルを使い続けてしまっていた(共有URL方式への移行時に発覚)。
// 新しいバージョンを検知したら(以前は確認なしで即座にリロードしていたが、入力中の内容が
// 消えてしまうため)UpdatePromptで明示的に「更新する」を押すまで待ち、さらに1時間おきに
// 能動的にチェックする。試合・シューティングの記録中はUpdatePrompt側でブロッキング表示を
// 抑制するため、ここではバックグラウンドで検知するだけでよく、勝手にリロードはしない
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    checkMinSupportedVersion()
    if (!registration) return
    setInterval(() => {
      registration.update()
      checkMinSupportedVersion()
    }, 60 * 60 * 1000)
  },
  onNeedRefresh() {
    setNeedRefresh(true)
  },
})
setUpdateFn(updateSW)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
