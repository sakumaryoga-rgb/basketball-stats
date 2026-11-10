// iOSのホーム画面追加(standalone)では、静止時はSafariのツールバー分の領域を
// 予約したまま(実際にはツールバー自体は表示されない)visualViewport/
// window.innerHeightが実際の画面より小さい値を報告するが、ユーザーが実際に
// 下スワイプ(pull-to-refresh等)すると一時的にこの予約が解除され、画面
// いっぱいの正しい値を報告することを実機で確認した。screen.height(物理的な
// 画面の高さ)をそのまま使う案も試したが、実機ではそれだけでは解消しなかった
// ため、以下の方式に戻す。
//
// 1. 観測した最大の高さを記憶し、それを下回る値は採用しない(ratchet)。
//    正しい大きな値を一度でも観測できたら、それ以降はその値に固定する。
// 2. プログラムによるscrollTo(実際のタッチ操作を伴わない瞬間移動)では
//    iOSの再計算のきっかけにならなかったため、起動直後に複数フレームに
//    分けて1px分をアニメーションさせるように動かし、実際のタッチスワイプの
//    動きに近づける(nudgeScrollAnimated)。
// 3. 起動直後の学習が完了した後は、この仕組みのために意図的に残している
//    body側の1pxスクロール余地(index.css/Layout.jsx参照)がユーザーの
//    通常操作中に誤って弾み(rubber-band)を起こし、画面全体が持ち上がって
//    見える不具合につながる。学習が完了したとみなせるタイミングで
//    overscroll-behavior-y: noneを付与し、以降の弾みだけをロックして
//    止める(学習自体は完了しているため、以降ratchetの後押しが止まっても
//    問題ない)
const STANDALONE_RESERVE_THRESHOLD = 150
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
  const measured = Math.max(vvHeight, window.innerHeight)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const screenHeight = window.screen?.height ?? 0
  // screen.heightは「静止時の予約分の縮み」程度の差ならヒントとして使うが、
  // キーボード表示のような大きな縮みの際はそのまま無視する(閾値で区別)
  const candidate =
    isStandalone && screenHeight > measured && screenHeight - measured < STANDALONE_RESERVE_THRESHOLD
      ? screenHeight
      : measured
  if (candidate > maxObservedHeight) {
    maxObservedHeight = candidate
    document.documentElement.style.setProperty('--app-height', `${maxObservedHeight}px`)
  }
}

// 実際のタッチスワイプに近づけるため、瞬間移動ではなく複数フレームに分けて
// 1px分だけスクロール位置を動かす。動かした後は毎フレームmeasureAppHeightを
// 呼び、iOSがこのタイミングで報告する値の変化を取りこぼさないようにする
function nudgeScrollAnimated(onDone) {
  if (window.scrollY !== 0) {
    onDone?.()
    return
  }
  let frame = 0
  const totalFrames = 6 // 前半でscrollTop 0→1、後半で1→0に戻す
  function step() {
    frame += 1
    window.scrollTo(0, frame <= totalFrames / 2 ? 1 : 0)
    measureAppHeight()
    if (frame < totalFrames) {
      requestAnimationFrame(step)
    } else {
      onDone?.()
    }
  }
  requestAnimationFrame(step)
}

// 起動直後の学習が完了したとみなせるタイミングで、以降の意図しない弾み
// (rubber-band)だけをロックして止める。ロック後もmeasureAppHeight自体は
// (resize/visualViewport等のイベントで)引き続き動くが、ratchetの性質上
// 一度学習した値を下回ることはない
function lockOverscroll() {
  document.documentElement.classList.add('app-height-locked')
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
  // 数百ms〜2秒の間だけ何度か再計測し、正しい最大値の学習を取りこぼさないようにする
  for (const delay of [50, 150, 300, 500, 1000, 2000]) {
    setTimeout(measureAppHeight, delay)
  }
  // 起動直後に1度だけ、実際のタッチスワイプに近い動きでビューポートの
  // 揺さぶりを行う。完了後、学習は十分完了したとみなしoverscrollをロックする
  setTimeout(() => nudgeScrollAnimated(() => setTimeout(lockOverscroll, 300)), 200)
}
