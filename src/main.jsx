import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { setNeedRefresh, setUpdateFn, setCheckFn } from '@/lib/swUpdate'
import { checkMinSupportedVersion } from '@/lib/appVersion'
import './index.css'
import App from './App.jsx'

// iOSでは、ホーム画面に追加したPWA(standalone)を開いた直後の最初の描画時点では、
// svh/dvh等のビューポート単位やCSSのheight:100%連鎖が、通常のSafariタブ用の
// (存在しないはずの検索バー分を差し引いた)短い値のまま計算されてしまうことがある。
// 何かしらのリサイズ/スクロール操作が起きて初めて正しい値に再計算されるため、
// Layout.jsx配下の画面だけでなくOnboarding等も含めアプリ全体で使えるよう、
// visualViewport APIで実測した高さをCSS変数として最上位(main.jsx)で管理する。
// Reactのマウント前から必要になるため、Reactの外側(ここ)でセットアップする。
//
// さらに、起動直後はvisualViewport.height自体がまだ確定しておらず(WKWebViewが
// standalone表示へ完全に落ち着く前の)古い値を返すことがあり、その後resize等の
// イベントが一切発火しないまま古い値が固定されてしまうケースがあった(スワイプ操作で
// 偶発的にresizeが発火して初めて直る、という報告と一致)。起動直後の数百ms間だけ
// 何度か再計測し、値が確定するタイミングを取りこぼさないようにする
function setupAppHeight() {
  function setAppHeight() {
    const vvHeight = window.visualViewport?.height ?? 0
    const height = Math.max(vvHeight, window.innerHeight)
    document.documentElement.style.setProperty('--app-height', `${height}px`)
  }
  setAppHeight()
  window.addEventListener('resize', setAppHeight)
  window.addEventListener('load', setAppHeight)
  window.addEventListener('pageshow', setAppHeight)
  window.visualViewport?.addEventListener('resize', setAppHeight)
  window.visualViewport?.addEventListener('scroll', setAppHeight)
  for (const delay of [50, 150, 300, 500, 1000, 2000]) {
    setTimeout(setAppHeight, delay)
  }
}
setupAppHeight()

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
