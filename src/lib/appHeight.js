// iOSのホーム画面追加(standalone)では、静止時はSafariのツールバー分の領域を
// 予約したまま(実際にはツールバー自体は表示されない)visualViewport/
// window.innerHeightが実際の画面より小さい値を報告するが、下スワイプ操作中
// (pull-to-refresh等)は一時的にこの予約が解除され、画面いっぱいの正しい値を
// 報告することを実機で確認した。この「正しい値」はスワイプという能動的な
// 操作をした瞬間にしか観測できず、静止時に戻ると再び小さい値に戻ってしまう。
//
// そのため、これまでに観測した最大の高さを記憶しておき、それを下回る値は
// 採用しない(=一度でも正しい大きな値を観測できたら、それ以降はその値に
// 固定する)。過去にこの「最大値を記憶する」仕組みで、起動直後の一時的な
// 誇張値(まだsafe-areaが確定する前の値)を誤って学習してしまい、フッターが
// 沈んで見える不具合を起こしたことがあるが、あちらは「起動直後の一瞬だけ
// 発生し得る不安定な値」が原因だった。今回は逆に、実際のビューポートの
// 最大到達可能な高さそのものを掴みにいくのが目的のため、起動直後の値に
// 加えて、resize/visualViewportイベントに加えてtouchmove(スワイプ中)でも
// こまめに再計測し、スワイプ操作で本来の高さが解放された瞬間を確実に捉える
let maxObservedHeight = 0
let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 0

export function measureAppHeight() {
  const currentWidth = window.innerWidth
  if (currentWidth !== lastWidth) {
    // 端末回転等で幅が変わった場合は、新しい向きの高さを再度学習し直す
    lastWidth = currentWidth
    maxObservedHeight = 0
  }
  const vvHeight = window.visualViewport?.height ?? 0
  const candidate = Math.max(vvHeight, window.innerHeight)
  if (candidate > maxObservedHeight) {
    maxObservedHeight = candidate
    document.documentElement.style.setProperty('--app-height', `${maxObservedHeight}px`)
  }
}

// ユーザーが実際に下スワイプするまで正しい高さを観測できないと、初回起動時は
// 毎回フッターの余白が見えてしまう。body側に意図的に1px分のスクロール余地を
// 作ってあるため(index.css/Layout.jsx参照)、起動直後に1pxだけプログラムで
// スクロールさせてまた戻すことで、スワイプ操作をエミュレートし、iOSに
// ツールバー分の予約領域を早期に解放させる
function nudgeScroll() {
  if (window.scrollY === 0) {
    window.scrollTo(0, 1)
    window.scrollTo(0, 0)
  }
  measureAppHeight()
}

export function setupAppHeight() {
  measureAppHeight()
  window.addEventListener('resize', measureAppHeight)
  window.addEventListener('load', measureAppHeight)
  window.addEventListener('pageshow', measureAppHeight)
  window.visualViewport?.addEventListener('resize', measureAppHeight)
  window.visualViewport?.addEventListener('scroll', measureAppHeight)
  // 下スワイプ(pull-to-refresh等)の最中に本来の高さが一時的に解放されるため、
  // タッチ操作中もこまめに再計測し、その瞬間を取りこぼさないようにする
  window.addEventListener('touchmove', measureAppHeight, { passive: true })
  window.addEventListener('touchend', measureAppHeight, { passive: true })
  // 起動直後はvisualViewport.height自体がまだ確定しておらず、その後resize等の
  // イベントが一切発火しないまま値が固定されてしまうことがあるため、起動直後の
  // 数百ms〜2秒の間だけ何度か再計測し、正しい最大値の学習を取りこぼさないようにする
  for (const delay of [50, 150, 300, 500, 1000, 2000]) {
    setTimeout(measureAppHeight, delay)
  }
  // 上記の再計測だけでは(実機のiOSで)ツールバー分の予約が解放されないことが
  // あるため、起動直後にスクロールを揺さぶって能動的に解放を促す
  for (const delay of [200, 600, 1200]) {
    setTimeout(nudgeScroll, delay)
  }
}
