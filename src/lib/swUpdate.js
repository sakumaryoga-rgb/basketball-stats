// main.jsx(Reactツリーの外)でService Workerの更新登録を行うため、更新の有無を
// Reactコンポーネント側へ橋渡しする小さなpub/sub。useSyncExternalStoreで購読する
let needRefresh = false
let updateFn = null
const listeners = new Set()

export function setNeedRefresh(value) {
  needRefresh = value
  listeners.forEach((listener) => listener())
}

export function setUpdateFn(fn) {
  updateFn = fn
}

export function applyUpdate() {
  updateFn?.(true)
}

export function subscribeNeedRefresh(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getNeedRefresh() {
  return needRefresh
}
