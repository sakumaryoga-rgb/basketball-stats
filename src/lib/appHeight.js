// iOSでは、ソフトウェアキーボードの表示中はvisualViewport.height(場合によっては
// window.innerHeightも)がキーボード分だけ縮んだ値を報告する。キーボードを閉じた
// ときにこれが確実に検知され元の高さへ戻る保証がなく(resizeイベントが必ず
// 発火するとは限らない)、縮んだ値がそのまま--app-heightに残ってしまい、
// 入力後に下部タブバーが浮いて見える不具合の原因になっていた
// (実機での検証により、キーボード表示が原因と特定済み)。
//
// 一度観測した最大の高さを下回る値を無条件に無視すると、起動直後にブラウザの
// ツールバーが一時的に隠れて実際より大きい高さを観測してしまった場合、その
// 誇張された値に永久に固定されてしまい、フッターが実際のビューポートより下に
// はみ出して常にスクロールしないと見えない不具合になる(こちらも実機で確認済み)。
// キーボードの縮み幅(数百px)とツールバー表示/非表示による縮み幅(数十px)には
// 明確な差があるため、閾値未満の小さな縮みは正しい値として採用し、閾値以上の
// 大きな縮みだけをキーボードとみなして無視する。画面幅が変わった場合
// (端末回転等)は基準をリセットし、新しい向きの高さを再度学習し直す
const KEYBOARD_SHRINK_THRESHOLD = 100
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
  if (candidate >= maxObservedHeight || maxObservedHeight - candidate < KEYBOARD_SHRINK_THRESHOLD) {
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
