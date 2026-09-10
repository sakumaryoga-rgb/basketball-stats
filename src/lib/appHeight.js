// iOSのホーム画面追加(standalone)では、静止時はSafariのツールバー分の領域を
// 予約したまま(実際にはツールバー自体は表示されない)visualViewport/
// window.innerHeightが実際の画面より小さい値を報告する。以前はこれを
// 「下スワイプ操作中だけ一時的に解放される正しい値」と捉え、観測した最大値を
// 記憶するratchet方式+起動直後のプログラムによるscrollTo揺さぶりで対処しようと
// したが、プログラムによるscrollTo(実際のタッチ操作を伴わない)ではiOS側の
// 再計算のきっかけにならず、結局ユーザーが手動でスワイプするまで直らなかった。
//
// window.screen.height(物理的な画面の高さ。ホームインジケーター等を含む、
// タッチ操作に依存せず起動直後から確実に取得できる不変値)は、実機検証で
// 確認した「スワイプ後の正しい高さ」と一致していた。standalone時はブラウザの
// ツールバーは実在しないため、この値をそのまま使って構わない。ソフトウェア
// キーボード表示時はvisualViewport/innerHeightが大きく縮むので、その場合は
// 縮んだ値をそのまま使う(キーボード分の縮みと、静止時に一律発生する
// ツールバー予約分の縮みとでは差が大きいため、閾値で区別する)
const STANDALONE_RESERVE_THRESHOLD = 150

export function measureAppHeight() {
  const vvHeight = window.visualViewport?.height ?? 0
  const measured = Math.max(vvHeight, window.innerHeight)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const screenHeight = window.screen?.height ?? 0
  const height =
    isStandalone && screenHeight > measured && screenHeight - measured < STANDALONE_RESERVE_THRESHOLD
      ? screenHeight
      : measured
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
  // イベントが一切発火しないまま値が固定されてしまうことがあるため、起動直後の
  // 数百ms〜2秒の間だけ何度か再計測し、正しい値の学習を取りこぼさないようにする
  for (const delay of [50, 150, 300, 500, 1000, 2000]) {
    setTimeout(measureAppHeight, delay)
  }
}
