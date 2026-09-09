// iOSでは、ホーム画面に追加したPWA(standalone)を開いた直後の最初の描画時点では、
// svh/dvh等のビューポート単位やCSSのheight:100%連鎖が、通常のSafariタブ用の
// (存在しないはずの検索バー分を差し引いた)短い値のまま計算されてしまうことがある。
// visualViewport APIで実測した高さをCSS変数として管理し、アプリ全体(main.jsx)は
// もちろん、Onboarding→Layoutのようにチーム参加直後に初めてマウントされる画面でも
// その場で再計測できるよう、測定ロジック自体をここに切り出す
export function measureAppHeight() {
  const vvHeight = window.visualViewport?.height ?? 0
  const height = Math.max(vvHeight, window.innerHeight)
  document.documentElement.style.setProperty('--app-height', `${height}px`)
}

export function setupAppHeight() {
  measureAppHeight()
  window.addEventListener('resize', measureAppHeight)
  window.addEventListener('load', measureAppHeight)
  window.addEventListener('pageshow', measureAppHeight)
  window.visualViewport?.addEventListener('resize', measureAppHeight)
  window.visualViewport?.addEventListener('scroll', measureAppHeight)
  // 起動直後はvisualViewport.height自体がまだ確定しておらず、その後resize等の
  // イベントが一切発火しないまま古い値が固定されてしまうことがあるため、
  // 起動直後の数百ms〜2秒の間だけ何度か再計測し、値が確定するタイミングを
  // 取りこぼさないようにする
  for (const delay of [50, 150, 300, 500, 1000, 2000]) {
    setTimeout(measureAppHeight, delay)
  }
}
