import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowLeftRight, ArrowUp, Hand, Plus } from 'lucide-react'
import { Jersey } from '@/components/fun/Jersey'
import { CourtLines } from '@/components/fun/CourtLines'
import { GuestTag, GUEST_COLOR } from '@/components/fun/GuestTag'
import { positionColor } from '@/lib/positionStyle'
import { isGuest } from '@/lib/roster'
import { MAX_STARTERS, STARTER_SLOTS, listOf, movePlayer, preferredEmptySlot, starterCount, swapPlayers } from '@/lib/lineupDraft'
import { cn } from '@/lib/utils'

// タッチは長押しでつかむ(すぐ指を動かした場合は縦スクロールとして扱う)。マウスは少し動かした時点でつかむ
const LONG_PRESS_MS = 220
const TOUCH_MOVE_TOLERANCE = 8
const MOUSE_DRAG_DISTANCE = 4
// ドラッグ中、スクロール領域の上下端にこの距離まで近づいたら自動でスクロールする
const AUTO_SCROLL_EDGE = 56
const AUTO_SCROLL_MAX_SPEED = 14
const PLACEHOLDER_ID = '__placeholder'

function positionLabel(p) {
  return [p.position, p.position2].filter(Boolean).join('/') || 'POS未設定'
}

function jerseyColor(p) {
  return isGuest(p) ? GUEST_COLOR : positionColor(p.position)
}

// 名前の下の補足行。ゲストはポジションの代わりにGUESTタグを出して、チームの選手と見分けられるようにする
function PlayerSubline({ player, className }) {
  if (isGuest(player)) return <GuestTag className={cn('mt-0.5', className)} />
  return <span className={cn('block truncate font-heading text-[10px] tracking-wider', className)}>{positionLabel(player)}</span>
}

// 指の下にある要素から、ドロップ先(選手カード/空き枠/エリアの余白)を判定する
function hitTest(x, y) {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  const card = el.closest('[data-lineup-card]')
  if (card) return { kind: 'card', id: card.dataset.id, list: card.dataset.list }
  const slot = el.closest('[data-lineup-slot]')
  if (slot) return { kind: 'slot', list: 'starters', index: Number(slot.dataset.index) }
  const zone = el.closest('[data-lineup-zone]')
  if (zone) return { kind: 'zone', list: zone.dataset.lineupZone }
  return null
}

// つかんだ選手(dragId)を指の位置に落とした場合の結果を、元の並び(origin)から計算する。
// STARTING FIVEは1=PG〜5=Cの固定枠。番号は枠に付き、移動した選手は移動先の枠の番号になる。
// - STARTING FIVEの選手の上 → その選手と入れ替え(枠どうしでもRESERVEとでも)
// - RESERVEどうし → その位置へ並べ替え
// - STARTING FIVEの空き枠 → その枠へ移動(RESERVEからなら追加)
// - STARTING FIVEの余白 → 空き枠があれば、選手のポジションに合う空き枠(なければ最初の空き枠)へ
// - RESERVEの余白 → RESERVEへ下げる
// 戻り値のpreviewは画面にそのまま反映し、指を離したときに確定する
function resolveDrop(origin, dragId, hit, previous, player) {
  const from = listOf(origin, dragId)
  if (!hit) return { preview: origin, action: null }
  if (hit.kind === 'card') {
    // 自分自身(=プレビュー中の空き枠)の上では直前の判定を保つ。指の下でプレビューが入れ替わり続けないように
    if (hit.id === dragId || hit.id === PLACEHOLDER_ID) return previous ?? { preview: origin, action: null }
    // 表示上の位置はプレビューで動いているため、どちらのエリアの選手かは元の並びで判定する
    const hitList = listOf(origin, hit.id)
    if (hitList === 'reserves' && from === 'reserves') {
      const index = origin.reserves.indexOf(hit.id)
      return { preview: movePlayer(origin, dragId, 'reserves', index), action: 'reorder' }
    }
    const action = hitList === 'starters' && from === 'starters' ? 'reposition' : 'swap'
    return { preview: swapPlayers(origin, dragId, hit.id), action, swapWith: hit.id }
  }
  if (hit.kind === 'slot') {
    return {
      preview: movePlayer(origin, dragId, 'starters', hit.index),
      action: from === 'starters' ? 'reposition' : 'add',
    }
  }
  // エリアの余白
  if (hit.list === from) return previous ?? { preview: origin, action: null }
  if (hit.list === 'starters') {
    const slot = preferredEmptySlot(origin, player)
    if (slot == null) return { preview: origin, action: 'blocked' }
    return { preview: movePlayer(origin, dragId, 'starters', slot), action: 'add' }
  }
  return { preview: movePlayer(origin, dragId, 'reserves', 0), action: 'bench' }
}

function StarterCard({ player, slotIndex, pickMode, displaced, ...rest }) {
  return (
    <button
      type="button"
      data-lineup-card
      data-id={player.id}
      data-list="starters"
      className={cn(
        'lineup-card press group relative flex min-h-12 w-full items-center gap-2.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-left ring-1 ring-white/10 transition-[background-color,box-shadow]',
        'hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-3',
        pickMode && 'ring-2 ring-chart-3/70 bg-white/15',
        displaced && 'ring-2 ring-chart-3'
      )}
      {...rest}
    >
      <SlotNumber index={slotIndex} />
      <Jersey number={player.number} color={jerseyColor(player)} className="size-9 shrink-0 drop-shadow" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold leading-tight">{player.name}</span>
        <PlayerSubline player={player} className="text-white/60" />
      </span>
      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          pickMode ? 'bg-chart-3 text-secondary' : 'bg-white/10 text-white/70'
        )}
      >
        {pickMode ? <ArrowLeftRight className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      </span>
      {displaced && (
        <span className="absolute -top-2 right-2 rounded-full bg-chart-3 px-1.5 py-0.5 font-heading text-[9px] tracking-wider text-secondary">
          SWAP
        </span>
      )}
    </button>
  )
}

// STARTING FIVEのポジション番号(1=PG〜5=C)。選手の背番号ではなく枠の番号
function SlotNumber({ index, muted = false }) {
  return (
    <span className={cn('flex w-7 shrink-0 flex-col items-center leading-none', muted ? 'text-white/45' : 'text-chart-3')}>
      <span className="font-heading text-lg">{index + 1}</span>
      <span className="font-heading text-[8px] tracking-wider opacity-80">{STARTER_SLOTS[index]}</span>
    </span>
  )
}

function ReserveCard({ player, startersFull, picked, displaced, ...rest }) {
  return (
    <button
      type="button"
      data-lineup-card
      data-id={player.id}
      data-list="reserves"
      className={cn(
        'lineup-card press relative flex min-h-12 w-full min-w-0 items-center gap-2 rounded-xl border bg-background px-2 py-1.5 text-left shadow-xs transition-[background-color,box-shadow]',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isGuest(player) && 'border-dashed',
        picked && 'border-primary bg-primary/5 ring-2 ring-primary',
        displaced && 'ring-2 ring-chart-3'
      )}
      {...rest}
    >
      <Jersey number={player.number} color={jerseyColor(player)} className="size-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-tight">{player.name}</span>
        <PlayerSubline player={player} className="text-muted-foreground" />
      </span>
      <span
        aria-hidden
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          picked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {startersFull ? <ArrowLeftRight className="size-3" /> : <ArrowUp className="size-3" />}
      </span>
      {displaced && (
        <span className="absolute -top-2 right-2 rounded-full bg-chart-3 px-1.5 py-0.5 font-heading text-[9px] tracking-wider text-secondary">
          SWAP
        </span>
      )}
    </button>
  )
}

// ドラッグ中に、つかんだ選手が元いた/入る予定の場所に出す枠
function Placeholder({ list }) {
  return (
    <div
      data-lineup-card
      data-id={PLACEHOLDER_ID}
      aria-hidden
      className={cn(
        'flex w-full items-center justify-center rounded-xl border-2 border-dashed font-heading text-[10px] tracking-wider',
        list === 'starters' ? 'min-h-12 border-chart-3/80 bg-chart-3/10 text-chart-3' : 'min-h-12 border-primary/60 bg-primary/5 text-primary'
      )}
    >
      DROP HERE
    </div>
  )
}

// つかんだ選手のカード。指に追従して浮いて見えるよう、body直下に描画する
function DragGhost({ player, drag }) {
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-xl bg-secondary px-2.5 py-1.5 text-secondary-foreground shadow-2xl ring-2 ring-chart-3"
      style={{
        left: 0,
        top: 0,
        width: drag.w,
        minHeight: drag.h,
        transform: `translate3d(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px, 0) rotate(-2deg) scale(1.04)`,
      }}
    >
      <Jersey number={player.number} color={jerseyColor(player)} className="size-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold leading-tight">{player.name}</span>
        <PlayerSubline player={player} className="text-white/60" />
      </span>
    </div>,
    document.body
  )
}

const ACTION_HINT = {
  reorder: '並び順を入れ替えます',
  reposition: 'ポジションを入れ替えます',
  swap: '選手を入れ替えます',
  add: 'STARTING FIVEに入れます',
  bench: 'RESERVEに下げます',
  blocked: 'STARTING FIVEは5人です。選手の上で離すと入れ替えます',
}

// 試合/スクリメージ作成時のSTARTING FIVE / RESERVE編集。
// ドラッグ&ドロップ(タッチは長押し)とタップの両方で操作できる。STARTING FIVEは常に5人以下
export function LineupEditor({ players, value, onChange, scrollRef }) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const [drag, setDrag] = useState(null)
  // タップ操作: STARTING FIVEが5人のときにRESERVEの選手をタップすると、入れ替える先発を選ぶ状態になる
  const [pickId, setPickId] = useState(null)
  const [announce, setAnnounce] = useState('')
  const pressRef = useRef(null)
  const suppressClickRef = useRef(false)
  const valueRef = useRef(value)
  const dragRef = useRef(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    valueRef.current = value
    dragRef.current = drag
    onChangeRef.current = onChange
  })

  const shown = drag?.result?.preview ?? value
  const startersFull = starterCount(value) >= MAX_STARTERS
  const nameOf = (id) => byId.get(id)?.name ?? ''

  function commit(next, message) {
    onChangeRef.current(next)
    if (message) setAnnounce(message)
  }

  function updateDrag(x, y) {
    const current = dragRef.current
    if (!current) return
    const result = resolveDrop(current.origin, current.id, hitTest(x, y), current.result, byId.get(current.id))
    const next = { ...current, x, y, result }
    dragRef.current = next
    setDrag(next)
  }

  // ドラッグ中、スクロール領域の端に指を近づけると自動でスクロールする
  useEffect(() => {
    if (!drag) return
    let frame
    const tick = () => {
      const d = dragRef.current
      const scroller = scrollRef?.current
      if (d && scroller) {
        const rect = scroller.getBoundingClientRect()
        let speed = 0
        if (d.y < rect.top + AUTO_SCROLL_EDGE) speed = -((rect.top + AUTO_SCROLL_EDGE - d.y) / AUTO_SCROLL_EDGE)
        else if (d.y > rect.bottom - AUTO_SCROLL_EDGE) speed = (d.y - (rect.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE
        if (speed !== 0) {
          const before = scroller.scrollTop
          scroller.scrollTop += Math.max(-1, Math.min(1, speed)) * AUTO_SCROLL_MAX_SPEED
          if (scroller.scrollTop !== before) updateDrag(d.x, d.y)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // ドラッグの開始/終了のときだけループを張り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, scrollRef])

  function cleanupPress() {
    const press = pressRef.current
    if (!press) return
    clearTimeout(press.timer)
    for (const [target, type, fn] of press.listeners) target.removeEventListener(type, fn)
    pressRef.current = null
  }

  function activate(press, x, y) {
    press.active = true
    const rect = press.el.getBoundingClientRect()
    setPickId(null)
    navigator.vibrate?.(8)
    const next = {
      id: press.id,
      origin: valueRef.current,
      x,
      y,
      w: rect.width,
      h: rect.height,
      offsetX: x - rect.left,
      offsetY: y - rect.top,
      result: null,
    }
    dragRef.current = next
    setDrag(next)
    setAnnounce(`${nameOf(press.id)}をつかみました`)
  }

  function finishDrag(press) {
    if (pressRef.current !== press) return
    const wasActive = press.active
    cleanupPress()
    if (!wasActive) return
    // ドラッグ後に発生するclickでタップ操作が走らないようにする
    suppressClickRef.current = true
    setTimeout(() => (suppressClickRef.current = false), 400)
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    const action = d?.result?.action
    if (!d || !action || action === 'blocked') {
      setAnnounce(action === 'blocked' ? ACTION_HINT.blocked : '元の位置に戻しました')
      return
    }
    const name = nameOf(d.id)
    const messages = {
      reorder: `${name}の並び順を変更しました`,
      reposition: `${name}を${(d.result.preview.starters.indexOf(d.id) + 1) || ''}番に移しました`,
      swap: `${name}と${nameOf(d.result.swapWith)}を入れ替えました`,
      add: `${name}をSTARTING FIVEに入れました`,
      bench: `${name}をRESERVEに下げました`,
    }
    commit(d.result.preview, messages[action])
  }

  function cancelDrag(press) {
    if (pressRef.current !== press) return
    const wasActive = press.active
    cleanupPress()
    if (wasActive) {
      dragRef.current = null
      setDrag(null)
    }
  }

  function startPress(id, el, x, y, type, touchTarget) {
    cleanupPress()
    const press = { id, el, startX: x, startY: y, lastX: x, lastY: y, active: false, timer: null, listeners: [] }
    pressRef.current = press
    const listen = (eventType, fn, options, target = window) => {
      target.addEventListener(eventType, fn, options)
      press.listeners.push([target, eventType, fn])
    }
    const move = (mx, my) => {
      press.lastX = mx
      press.lastY = my
      if (press.active) {
        updateDrag(mx, my)
        return
      }
      const dist = Math.hypot(mx - press.startX, my - press.startY)
      if (type === 'mouse') {
        if (dist > MOUSE_DRAG_DISTANCE) activate(press, mx, my)
      } else if (dist > TOUCH_MOVE_TOLERANCE) {
        // 長押しが成立する前に指が動いた=スクロールしたいだけ。つかまない
        cleanupPress()
      }
    }

    if (type === 'mouse') {
      listen('pointermove', (ev) => move(ev.clientX, ev.clientY))
      listen('pointerup', () => finishDrag(press))
      listen('pointercancel', () => cancelDrag(press))
      return
    }

    // タッチはTouchイベントで追う。Pointerイベントはブラウザが縦スクロールを始めた時点で
    // pointercancelになり、長押し後に指を動かすとドラッグが途切れてしまうため。
    // Touchイベントは指を置いた要素(touchTarget)に届き続けるが、ドラッグ開始でその要素は
    // 「DROP HERE」の枠に描き替えられてDOMから外れ、windowまで伝わらなくなる。
    // そのため指を置いた要素自体にもリスナーを付ける(windowは念のための予備)
    const onTouchMove = (ev) => {
      if (pressRef.current !== press) return
      if (press.active && ev.cancelable) ev.preventDefault()
      const t = ev.touches[0]
      if (t) move(t.clientX, t.clientY)
    }
    for (const target of [touchTarget, window]) {
      listen('touchmove', onTouchMove, { passive: false }, target)
      listen('touchend', () => finishDrag(press), undefined, target)
      listen('touchcancel', () => cancelDrag(press), undefined, target)
    }
    press.timer = setTimeout(() => {
      if (pressRef.current === press) activate(press, press.lastX, press.lastY)
    }, LONG_PRESS_MS)
  }

  function handlePointerDown(e, id) {
    // タッチはhandleTouchStartで扱う
    if (e.pointerType === 'touch') return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    startPress(id, e.currentTarget, e.clientX, e.clientY, 'mouse')
  }

  function handleTouchStart(e, id) {
    if (e.touches.length !== 1) {
      if (pressRef.current) cancelDrag(pressRef.current)
      return
    }
    const t = e.touches[0]
    startPress(id, e.currentTarget, t.clientX, t.clientY, 'touch', e.target)
  }

  useEffect(() => () => cleanupPress(), [])

  // つかんでいる間だけ、シート/ページの縦スクロールを止める。
  // ブラウザはタッチ開始の時点で「スクロールを止めうるリスナーがあるか」を判定するため、
  // タッチ開始後に追加したリスナーではpreventDefaultが効かない(iOS Safari・Chromeとも)。
  // そこで選手エリアのルートに常設し、ドラッグ中でなければ何もしない
  const rootRef = useRef(null)
  // 選手0人の表示ではルート要素自体が無いので、選手の有無が変わったときだけ付け直す
  const hasPlayers = players.length > 0
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onTouchMove = (ev) => {
      if (pressRef.current?.active && ev.cancelable) ev.preventDefault()
    }
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => root.removeEventListener('touchmove', onTouchMove)
  }, [hasPlayers])

  // タップ(クリック・Enterキー)での代替操作
  function handleTap(id) {
    if (suppressClickRef.current) return
    const list = listOf(value, id)
    if (list === 'reserves') {
      if (pickId === id) {
        setPickId(null)
        setAnnounce('入れ替えをキャンセルしました')
      } else if (!startersFull) {
        const slot = preferredEmptySlot(value, byId.get(id))
        commit(movePlayer(value, id, 'starters', slot), `${nameOf(id)}をSTARTING FIVEの${slot + 1}番(${STARTER_SLOTS[slot]})に入れました`)
      } else {
        setPickId(id)
        setAnnounce(`${nameOf(id)}と入れ替えるSTARTING FIVEの選手を選んでください`)
      }
      return
    }
    if (pickId) {
      commit(swapPlayers(value, pickId, id), `${nameOf(pickId)}と${nameOf(id)}を入れ替えました`)
      setPickId(null)
      return
    }
    commit(movePlayer(value, id, 'reserves', 0), `${nameOf(id)}をRESERVEに下げました`)
  }

  function cardProps(id) {
    return {
      onPointerDown: (e) => handlePointerDown(e, id),
      onTouchStart: (e) => handleTouchStart(e, id),
      onClick: () => handleTap(id),
      onContextMenu: (e) => e.preventDefault(),
    }
  }

  const dragging = !!drag
  const dragFrom = drag ? listOf(drag.origin, drag.id) : null
  const action = drag?.result?.action
  const swapWith = action === 'swap' || action === 'reposition' ? drag.result.swapWith : null
  const shownStarterCount = starterCount(shown)
  const draggedPlayer = drag ? byId.get(drag.id) : null

  if (players.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        選手が登録されていません。PLAYERSタブで選手を追加すると、ここでSTARTING FIVEを選べます。
      </div>
    )
  }

  return (
    <div ref={rootRef} className={cn('flex flex-col gap-3 select-none [-webkit-touch-callout:none]', dragging && 'cursor-grabbing')} data-no-pull-refresh>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Hand className="size-3.5 shrink-0" />
        長押しでドラッグして入れ替え。タップでも移動できます
      </p>

      {pickId && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-chart-3/15 px-3 py-2 text-xs animate-in fade-in">
          <span className="min-w-0">
            <span className="font-bold">{nameOf(pickId)}</span> と入れ替える選手をSTARTING FIVEから選んでください
          </span>
          <button type="button" className="shrink-0 rounded-lg px-2 py-1 font-bold text-muted-foreground hover:bg-muted" onClick={() => setPickId(null)}>
            キャンセル
          </button>
        </div>
      )}

      <section
        data-lineup-zone="starters"
        aria-label="STARTING FIVE"
        className={cn(
          'relative overflow-hidden rounded-2xl bg-secondary p-3 text-secondary-foreground shadow-md transition-shadow',
          dragging && dragFrom === 'reserves' && 'ring-2 ring-chart-3 ring-offset-2 ring-offset-background'
        )}
      >
        <CourtLines className="text-white/[0.07]" />
        <div className="relative mb-2 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="font-heading text-lg leading-none tracking-wide">STARTING FIVE</h3>
            <span className="font-heading text-sm tabular-nums text-chart-3">
              {shownStarterCount}/{MAX_STARTERS}
            </span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: MAX_STARTERS }, (_, i) => (
              <span key={i} className={cn('h-1.5 w-3 rounded-full', shown.starters[i] ? 'bg-chart-3' : 'bg-white/20')} />
            ))}
          </div>
        </div>
        {dragging && dragFrom === 'reserves' && (
          <p className={cn('relative mb-2 text-[11px] font-bold', action === 'blocked' ? 'text-chart-3' : 'text-white/70')}>
            {action ? ACTION_HINT[action] : startersFull ? '選手の上で離すと入れ替えます' : '空き枠か選手の上で離してください'}
          </p>
        )}
        {/* 1=PG〜5=Cの固定枠。番号は枠に付き、選手の背番号とは別 */}
        <ol className="relative flex flex-col gap-1.5">
          {shown.starters.map((id, i) => (
            <li key={STARTER_SLOTS[i]}>
              {id && drag?.id === id ? (
                <Placeholder list="starters" />
              ) : id ? (
                <StarterCard
                  player={byId.get(id)}
                  slotIndex={i}
                  pickMode={!!pickId}
                  displaced={swapWith === id}
                  aria-label={`${byId.get(id)?.name}${isGuest(byId.get(id)) ? '(ゲスト)' : ''} (STARTING FIVE ${i + 1}番 ${STARTER_SLOTS[i]})。${pickId ? `${nameOf(pickId)}と入れ替える` : 'タップでRESERVEへ'}`}
                  {...cardProps(id)}
                />
              ) : (
                <div
                  data-lineup-slot
                  data-index={i}
                  className={cn(
                    'flex min-h-12 items-center gap-2.5 rounded-xl border-2 border-dashed border-white/20 px-2.5 text-white/45 transition-colors',
                    dragging && 'border-chart-3/70 bg-chart-3/10 text-chart-3'
                  )}
                >
                  <SlotNumber index={i} muted={!dragging} />
                  <Plus className="size-4" />
                  <span className="text-xs font-bold">空き</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section
        data-lineup-zone="reserves"
        aria-label="RESERVE"
        className={cn(
          'rounded-2xl border bg-card p-3 shadow-xs transition-shadow',
          dragging && dragFrom === 'starters' && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
        )}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="font-heading text-lg leading-none tracking-wide">RESERVE</h3>
            <span className="font-heading text-sm tabular-nums text-muted-foreground">{shown.reserves.length}</span>
          </div>
          {!dragging && <span className="text-[10px] text-muted-foreground">{startersFull ? 'タップで先発と入れ替え' : 'タップで先発へ'}</span>}
        </div>
        {dragging && dragFrom === 'starters' && (
          <div
            className={cn(
              'mb-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-bold transition-colors',
              action === 'bench' ? 'border-primary bg-primary/10 text-primary' : 'border-primary/40 text-primary/80'
            )}
          >
            <ArrowDown className="size-3.5" />
            {action === 'swap' ? ACTION_HINT.swap : 'ここで離すとRESERVEへ'}
          </div>
        )}
        {shown.reserves.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">RESERVEの選手はいません</p>
        ) : (
          <ul className="grid grid-cols-2 gap-1.5">
            {shown.reserves.map((id) => (
              <li key={id} className="min-w-0">
                {drag?.id === id ? (
                  <Placeholder list="reserves" />
                ) : (
                  <ReserveCard
                    player={byId.get(id)}
                    startersFull={startersFull}
                    picked={pickId === id}
                    displaced={swapWith === id}
                    aria-label={`${byId.get(id)?.name}${isGuest(byId.get(id)) ? '(ゲスト)' : ''} (RESERVE)。${startersFull ? 'タップで先発と入れ替え' : 'タップでSTARTING FIVEへ'}`}
                    aria-pressed={pickId === id}
                    {...cardProps(id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {drag && draggedPlayer && <DragGhost player={draggedPlayer} drag={drag} />}
    </div>
  )
}
