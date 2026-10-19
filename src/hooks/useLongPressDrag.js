import { useCallback, useEffect, useRef, useState } from 'react'

const LONG_PRESS_MS = 350
const TOUCH_MOVE_TOLERANCE = 8
const MOUSE_DRAG_DISTANCE = 6

// 長押し(マウスは少し動かす)でつかんで、[data-drop]の付いた要素の上で離すドラッグ&ドロップ。
// - タッチは長押しが成立する前に指が動いたらスクロールとして扱い、つかまない
// - Touchイベントで追う(Pointerイベントはスクロール開始時にpointercancelになるため)
// - つかんでいる間の縦スクロール停止は、rootRefを付けた要素に常設したtouchmoveで行う
//   (ブラウザはタッチ開始時点でpreventDefaultしうるリスナーの有無を判定するため)
// onDrop(dragId, dropKey) の dropKey は、指の下にある最も近い[data-drop]の値
export function useLongPressDrag({ onDrop }) {
  const [drag, setDrag] = useState(null) // { id, x, y, over, moved }
  const pressRef = useRef(null)
  const rootRef = useRef(null)
  const suppressClickRef = useRef(false)
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop
  })

  const cleanup = useCallback(() => {
    const press = pressRef.current
    if (!press) return
    clearTimeout(press.timer)
    for (const [target, type, fn] of press.listeners) target.removeEventListener(type, fn)
    pressRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onTouchMove = (ev) => {
      if (pressRef.current?.armed && ev.cancelable) ev.preventDefault()
    }
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => root.removeEventListener('touchmove', onTouchMove)
  })

  function start(id, x, y, type, touchTarget) {
    cleanup()
    const press = { id, startX: x, startY: y, armed: false, moved: false, over: null, listeners: [], timer: null }
    pressRef.current = press
    const listen = (target, eventType, fn, options) => {
      target.addEventListener(eventType, fn, options)
      press.listeners.push([target, eventType, fn])
    }
    const arm = (ax, ay) => {
      press.armed = true
      navigator.vibrate?.(8)
      setDrag({ id, x: ax, y: ay, over: null, moved: false })
    }
    const move = (mx, my) => {
      if (pressRef.current !== press) return
      const dist = Math.hypot(mx - press.startX, my - press.startY)
      if (!press.armed) {
        if (type === 'mouse' && dist > MOUSE_DRAG_DISTANCE) arm(mx, my)
        else if (type !== 'mouse' && dist > TOUCH_MOVE_TOLERANCE) cleanup()
        if (!press.armed) return
      }
      if (dist > TOUCH_MOVE_TOLERANCE) press.moved = true
      press.over = document.elementFromPoint(mx, my)?.closest('[data-drop]')?.dataset.drop ?? null
      setDrag({ id, x: mx, y: my, over: press.over, moved: press.moved })
    }
    const end = () => {
      if (pressRef.current !== press) return
      const { armed, over } = press
      cleanup()
      setDrag(null)
      if (!armed) return
      // つかんだ後に発生するclick(リンク遷移など)は無視する
      suppressClickRef.current = true
      setTimeout(() => (suppressClickRef.current = false), 400)
      if (over) onDropRef.current(id, over)
    }
    const cancel = () => {
      if (pressRef.current !== press) return
      cleanup()
      setDrag(null)
    }
    if (type === 'mouse') {
      listen(window, 'pointermove', (ev) => move(ev.clientX, ev.clientY))
      listen(window, 'pointerup', end)
      listen(window, 'pointercancel', cancel)
      return
    }
    for (const target of [touchTarget, window]) {
      listen(target, 'touchmove', (ev) => ev.touches[0] && move(ev.touches[0].clientX, ev.touches[0].clientY))
      listen(target, 'touchend', end)
      listen(target, 'touchcancel', cancel)
    }
    press.timer = setTimeout(() => {
      if (pressRef.current === press && !press.armed) arm(x, y)
    }, LONG_PRESS_MS)
  }

  // つかめる要素に付けるprops
  function bind(id) {
    return {
      onPointerDown: (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return
        start(id, e.clientX, e.clientY, 'mouse')
      },
      onTouchStart: (e) => {
        if (e.touches.length !== 1) return
        start(id, e.touches[0].clientX, e.touches[0].clientY, 'touch', e.target)
      },
      onContextMenu: (e) => e.preventDefault(),
      onClickCapture: (e) => {
        if (suppressClickRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      },
      onDragStart: (e) => e.preventDefault(),
    }
  }

  return { drag, bind, rootRef }
}
