// iOSでは、ソフトウェアキーボードの表示中はvisualViewport.height(場合によっては
// window.innerHeightも)がキーボード分だけ縮んだ値を報告する。キーボードを閉じた
// ときにこれを検知するresizeイベントが確実に発火するとは限らないため、
// フォーカスが外れた瞬間(focusout)にも明示的に再計測し、キーボードが閉じた
// 直後の正しい高さを取りこぼさないようにする。
//
// 過去に「一度観測した最大の高さを下回る値は無視する」という仕組みを試したが、
// 起動直後のsafe-area確定前に一時的に観測される実際より大きい値をそのまま
// 学習してしまい、フッターが常に沈んで見える不具合を引き起こした
// (実機のデバッグ表示で--app-heightがwindow.screen.heightと一致していることを
// 確認して特定済み)。その後「起動直後の数秒間だけ保護を外す」という調整も
// 試したが、その数秒間のうちどのタイミングで値が確定するかが不安定で、
// 今度は逆にフッターが浮く不具合を引き起こすなど、挙動が機種・タイミング
// 依存で安定しなかった。
//
// そのため、値を溜め込んで「過去の最大値」で判断するのはやめ、毎回その場の
// 実測値をそのまま素直に採用する方式に戻す。過去にズレた値のまま固定される
// ことがなくなる代わりに、値が変化しうるタイミング(起動直後・リサイズ・
// キーボードのフォーカスイン/アウト)でこまめに再計測することで、ズレを
// 素早く解消する
export function measureAppHeight() {
  const vvHeight = window.visualViewport?.height ?? 0
  const height = Math.max(vvHeight, window.innerHeight)
  document.documentElement.style.setProperty('--app-height', `${height}px`)
}

function remeasureSoon() {
  for (const delay of [0, 100, 300, 500]) {
    setTimeout(measureAppHeight, delay)
  }
}

export function setupAppHeight() {
  measureAppHeight()
  window.addEventListener('resize', measureAppHeight)
  window.addEventListener('load', measureAppHeight)
  window.addEventListener('pageshow', measureAppHeight)
  window.visualViewport?.addEventListener('resize', measureAppHeight)
  window.visualViewport?.addEventListener('scroll', measureAppHeight)
  // ソフトウェアキーボードが閉じた際、visualViewportのresizeが発火しない
  // ケースがあるため、フォーカスが外れた瞬間にも明示的に再計測する
  // (captureフェーズで登録することで、input/textarea以外も含め確実に拾う)
  document.addEventListener('focusout', remeasureSoon, true)
  // 起動直後はvisualViewport.height自体がまだ確定しておらず、その後resize等の
  // イベントが一切発火しないまま値が固定されてしまうことがあるため、起動直後の
  // 数百ms〜2秒の間だけ何度か再計測し、正しい値の学習を取りこぼさないようにする
  for (const delay of [50, 150, 300, 500, 1000, 2000]) {
    setTimeout(measureAppHeight, delay)
  }
}
