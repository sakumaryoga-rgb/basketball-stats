// iOSでは、ソフトウェアキーボードの表示中はvisualViewport.height(場合によっては
// window.innerHeightも)がキーボード分だけ縮んだ値を報告する。キーボードを閉じた
// ときにこれが確実に検知され元の高さへ戻る保証がなく(resizeイベントが必ず
// 発火するとは限らない)、縮んだ値がそのまま--app-heightに残ってしまい、
// 入力後に下部タブバーが浮いて見える不具合の原因になっていた
// (実機での検証により、キーボード表示が原因と特定済み)。
//
// 一度観測した最大の高さ(=キーボードが出ていない状態の正しい高さ)を下回る値は
// 無視し、常にそれ以上の高さだけを採用することでこの問題を回避する。
//
// ただしこの「一度観測した最大値を採用し続ける」仕組みには別の副作用がある。
// 起動直後はsafe-areaの計算がまだ確定しておらず、ごく短時間だけ
// window.innerHeight/visualViewport.heightがwindow.screen.height相当の
// (ホームインジケーター等を含む)実際より大きい値を報告することがある。この
// 起動直後の一時的な値をそのまま最大値として学習してしまうと、後で正しい値に
// 収束してもそちらは採用されず、フッターが実際のビューポートより下にはみ出して
// 常にスクロールしないと見えない「沈み」不具合になる(実機のデバッグ表示で
// window.screen.heightと--app-heightが一致していることを確認して特定済み)。
//
// 対策として、起動直後の値がまだ安定していない一定時間(STARTUP_SETTLE_MS)は
// 「一度観測した値を下回らない」保護を適用せず、常に最新の値をそのまま採用する。
// その間に起きるscheduleされた再計測(50ms〜2000ms)で正しい値に収束させ、
// 安定後に初めて上記の「縮みを無視する」保護を有効にすることで、以降の
// キーボード開閉時の副作用だけを正しく防ぐ。画面幅が変わった場合(端末回転等)は
// 新しい向きの高さを起動直後と同様に再度学習し直す
const STARTUP_SETTLE_MS = 2200
let maxObservedHeight = 0
let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 0
let settled = false
let settleTimer = null

function scheduleSettle() {
  settled = false
  if (settleTimer != null) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    settled = true
  }, STARTUP_SETTLE_MS)
}

export function measureAppHeight() {
  const currentWidth = window.innerWidth
  if (currentWidth !== lastWidth) {
    lastWidth = currentWidth
    maxObservedHeight = 0
    scheduleSettle()
  }
  const vvHeight = window.visualViewport?.height ?? 0
  const candidate = Math.max(vvHeight, window.innerHeight)
  if (!settled || candidate > maxObservedHeight) {
    maxObservedHeight = candidate
  }
  document.documentElement.style.setProperty('--app-height', `${maxObservedHeight}px`)
}

export function setupAppHeight() {
  scheduleSettle()
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
