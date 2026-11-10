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
// 2. (廃止)以前は起動直後にページを1pxスクロールさせて戻し、iOSに高さを再計算させていた。
//    新しいiOSのホーム画面アプリでは、画面上部のぼかしがスクロール状態で変わる可能性があり、
//    その切り分けのため無効化した(v23.2.5)。
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

// 起動直後の学習が完了したとみなせるタイミングで、以降の意図しない弾み
// (rubber-band)だけをロックして止める。ロック後もmeasureAppHeight自体は
// (resize/visualViewport等のイベントで)引き続き動くが、ratchetの性質上
// 一度学習した値を下回ることはない
function lockOverscroll() {
  document.documentElement.classList.add('app-height-locked')
  pinShellToTop()
}

// --app-heightに画面の物理的な高さ(screen.height)を採用した場合など、アプリシェルが
// 実際の表示領域より少し高くなると、body側がその分だけ縦にスクロールできてしまう。
// 起動直後の揺さぶりやiOSのスクロール位置の復元でbodyが少しでもずれたまま止まると、
// ヘッダーがステータスバー(半透明)の下に潜り込み、ベゼルに迫って上半分が透けて見える。
// 学習の完了後は、アプリシェル(Layout.jsx)を表示している間だけbodyのスクロールを
// 常に先頭へ戻す。Onboarding等の通常のドキュメントスクロールを使う画面には影響しない
function resetShellScroll() {
  if (!document.documentElement.classList.contains('app-height-locked')) return
  if (!document.querySelector('.app-shell')) return
  // 入力中はiOSがキーボードの上に入力欄を見せるためにbodyをスクロールさせるので、邪魔しない
  if (document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return
  if (window.scrollY !== 0) window.scrollTo(0, 0)
}

function pinShellToTop() {
  resetShellScroll()
  // キーボードを閉じた後(入力欄からフォーカスが外れた後)にずれが残らないよう戻す
  document.addEventListener('focusout', () => setTimeout(resetShellScroll, 300))
  window.addEventListener('scroll', resetShellScroll, { passive: true })
  window.addEventListener('pageshow', resetShellScroll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestAnimationFrame(resetShellScroll)
  })
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
  // 以前はここで1pxスクロールの揺さぶり(約0.2秒後に開始し、終了の0.3秒後にロック)を行っていた。
  // 揺さぶりは無効化し、ロックだけを同じくらいのタイミングで行う
  setTimeout(lockOverscroll, 600)
}
