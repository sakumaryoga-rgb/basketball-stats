// iOSでは、ソフトウェアキーボードの表示中はvisualViewport.height(場合によっては
// window.innerHeightも)がキーボード分だけ縮んだ値を報告する。キーボードを閉じた
// ときにこれが確実に検知され元の高さへ戻る保証がなく(resizeイベントが必ず
// 発火するとは限らない)、縮んだ値がそのまま--app-heightに残ってしまい、
// 入力後に下部タブバーが浮いて見える不具合の原因になっていた
// (実機での検証により、キーボード表示が原因と特定済み)。
//
// 一度観測した最大の高さ(=キーボードが出ていない状態の正しい高さ)を下回る値は
// 無視し、常にそれ以上の高さだけを採用することでこの問題を回避する。画面幅が
// 変わった場合(端末回転等)は基準をリセットし、新しい向きの高さを再度学習し直す
let maxObservedHeight = 0
let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 0

export function measureAppHeight() {
  const currentWidth = window.innerWidth
  if (currentWidth !== lastWidth) {
    lastWidth = currentWidth
    maxObservedHeight = 0
  }
  const vvHeight = window.visualViewport?.height ?? 0
  const candidate = Math.max(vvHeight, window.innerHeight)
  if (candidate > maxObservedHeight) {
    maxObservedHeight = candidate
  }
  document.documentElement.style.setProperty('--app-height', `${maxObservedHeight}px`)
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
}
