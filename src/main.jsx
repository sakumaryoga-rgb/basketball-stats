import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { setNeedRefresh, setUpdateFn, setCheckFn } from '@/lib/swUpdate'
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
    function runUpdateCheck() {
      registration?.update()
      checkMinSupportedVersion()
    }
    runUpdateCheck()
    // swUpdate.checkForUpdate()経由で、独自pull-to-refresh(iOSのホーム画面追加時は
    // ブラウザ標準のpull-to-refreshが使えないための代替実装)やフォアグラウンド復帰からも
    // 呼び出せるようにする
    setCheckFn(runUpdateCheck)
    if (!registration) return
    setInterval(runUpdateCheck, 60 * 60 * 1000)
    // iOSのホーム画面追加(standalone)ではアプリを長時間バックグラウンドに回すとページごと
    // 破棄され、上のsetIntervalも失われる。ホーム画面/アプリ切り替えから戻ってきた瞬間に
    // 確実に検知できるよう、フォアグラウンド復帰のたびにも能動的にチェックする
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') runUpdateCheck()
    })
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
