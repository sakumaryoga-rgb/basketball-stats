// main.jsx(Reactツリーの外)でService Workerの更新登録を行うため、更新の有無を
// Reactコンポーネント側へ橋渡しする小さなpub/sub。useSyncExternalStoreで購読する。
//
// needRefresh: 通常の新バージョン検知(SWのonNeedRefresh)。記録中の画面では
//   非ブロッキング表示に留め、記録完了・画面離脱後にブロッキング表示へ切り替える
// forceUpdateRequired: DBスキーマ変更等で旧クライアントとの互換性がなくなった場合の
//   強制更新(appVersion.jsのcheckMinSupportedVersion)。記録中でも常にブロッキング表示にする
let state = { needRefresh: false, forceUpdateRequired: false }
let updateFn = null
let checkFn = null
const listeners = new Set()

function emit() {
  listeners.forEach((listener) => listener())
}

export function setNeedRefresh(value) {
  state = { ...state, needRefresh: value }
  emit()
}

export function setForceUpdateRequired(value) {
  state = { ...state, forceUpdateRequired: value }
  emit()
}

export function setUpdateFn(fn) {
  updateFn = fn
}

export function applyUpdate() {
  updateFn?.(true)
}

export function setCheckFn(fn) {
  checkFn = fn
}

// iOSのホーム画面追加(standalone)ではブラウザのpull-to-refreshが使えず、また長時間
// バックグラウンドに回るとページごと破棄されmain.jsxのsetIntervalも失われるため、
// 独自のpull-to-refresh(PullToRefresh.jsx)やアプリのフォアグラウンド復帰時から
// 能動的に更新チェックを呼び出せるようにする
export function checkForUpdate() {
  checkFn?.()
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState() {
  return state
}
