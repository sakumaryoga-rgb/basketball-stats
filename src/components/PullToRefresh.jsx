import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const PULL_THRESHOLD = 70
const MAX_PULL = 110
const REFRESH_HEIGHT = 50 // 更新中に表示し続ける高さ
const REFRESH_DURATION_MS = 700 // 更新中インジケーターを表示する最短時間

// ホーム画面に追加した状態(standalone PWA)ではブラウザのpull-to-refreshが
// 使えなくなるため、最上部から下に引っ張ったら再読み込みする独自実装を提供する。
// 通常のブラウザタブではネイティブの挙動を邪魔しないよう、standalone判定の時だけ有効化する。
// ブラウザのフルリロード(window.location.reload)は白画面のフラッシュが入り滑らかでないため、
// onRefreshで呼び出し元に現在画面のソフトな再取得を委ね、インジケーターだけをアニメーションさせる。
export function PullToRefresh({ children, onRefresh, disabled = false }) {
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(null)
  const enabledRef = useRef(false)
  const disabledRef = useRef(disabled)
  const pendingPullRef = useRef(0)
  const rafIdRef = useRef(null)
  // Layoutのアプリシェルをposition:fixedにした関係で、スクロールはwindow/body
  // ではなくこのコンポーネント自身が持つコンテナに限定されている。「最上部にいるか」の
  // 判定もwindow.scrollYではなくこのrefのscrollTopを見る必要がある
  const scrollRef = useRef(null)
  // タッチリスナー自体はマウント時に一度だけ登録し、refreshing/onRefreshは
  // refで最新値を参照する。以前はrefreshingが変わるたびにこのeffectを再登録して
  // いたが、そのタイミングでのクリーンアップがcancelAnimationFrameするだけで
  // rafIdRefをnullに戻していなかったため、1回スワイプして更新した後は
  // scheduleFlushが「フレームが予約済み」と誤認して二度とsetPullを呼ばなくなり、
  // 2回目以降スワイプが反応しなくなる不具合があった
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    enabledRef.current = window.matchMedia('(display-mode: standalone)').matches
  }, [])

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    // touchmoveは1フレームの間に何度も発火するため、指の動きをそのままsetPullすると
    // CSSトランジションと競合してカクつく。requestAnimationFrameで1フレーム1回に
    // まとめることで指の動きに滑らかに追従させる。
    function flushPull() {
      rafIdRef.current = null
      setPull(pendingPullRef.current)
    }

    function scheduleFlush() {
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(flushPull)
      }
    }

    function handleTouchStart(e) {
      if (!enabledRef.current || refreshingRef.current || disabledRef.current) return
      if ((scrollRef.current?.scrollTop ?? 0) > 0) {
        startYRef.current = null
        return
      }
      startYRef.current = e.touches[0].clientY
      setDragging(true)
    }

    function handleTouchMove(e) {
      if (startYRef.current == null) return
      const delta = e.touches[0].clientY - startYRef.current
      pendingPullRef.current = delta <= 0 ? 0 : Math.min(MAX_PULL, delta)
      scheduleFlush()
    }

    function endDrag() {
      if (startYRef.current == null) return
      startYRef.current = null
      setDragging(false)
      setPull((current) => {
        if (current >= PULL_THRESHOLD) {
          setRefreshing(true)
          onRefreshRef.current?.()
          return REFRESH_HEIGHT
        }
        return 0
      })
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', endDrag, { passive: true })
    window.addEventListener('touchcancel', endDrag, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', endDrag)
      window.removeEventListener('touchcancel', endDrag)
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!refreshing) return
    const timer = setTimeout(() => {
      setRefreshing(false)
      setPull(0)
    }, REFRESH_DURATION_MS)
    return () => clearTimeout(timer)
  }, [refreshing])

  const ready = pull >= PULL_THRESHOLD
  // ドラッグ中はトランジションを切って指に1:1で追従させ、指を離した瞬間(スナップバック
  // や更新確定)だけスムーズにアニメーションさせる。常時トランジションを掛けていると
  // touchmoveのたびにアニメーションが割り込みでカクつく原因になっていた。
  const settleTransition = !dragging && 'transition-[height,transform] duration-200 ease-out'

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <div
        className={cn('flex shrink-0 justify-center overflow-hidden', settleTransition)}
        style={{ height: pull }}
        aria-hidden="true"
      >
        <div className="flex items-end pb-2">
          <RefreshCw
            className={cn(
              'size-5 text-muted-foreground',
              !dragging && 'transition-transform duration-200',
              refreshing && 'animate-spin',
              ready && 'text-primary'
            )}
            style={{ transform: `rotate(${pull * 2.5}deg)` }}
          />
        </div>
      </div>
      <div
        ref={scrollRef}
        className={cn('flex-1 min-h-0 overflow-y-auto overscroll-y-none', settleTransition)}
        style={{ transform: pull ? `translateY(${pull}px)` : undefined }}
      >
        {/* 中身が画面に収まる短いタブ(GAMES/PRACTICE/PLAYERS等)では、このコンテナ自体に
            スクロール可能な余白が一切なくなり、overscroll-y-containが機能しなくなる
            (吸収するスクロールが存在しないため)。中身の長さに関わらず常にこのコンテナ
            自身に1px分のスクロール余地を持たせ、外側(body、--app-height学習の足がかり。
            src/index.css/Layout.jsx参照)まで弾みが伝わらないようにする。
            以前はoverscroll-y-contain(弾み自体はこの要素内で許容しつつ、親への連鎖だけ止める)
            を使っていたが、TEAM/LEADERSのように中身が画面より長いタブでは、実際に指を離さず
            下端(または上端)まで大きくスワイプした際の弾みがcontainで完全には吸収しきれず、
            背後のbodyまで伝わってフッターが浮く不具合が報告された。この要素の弾み自体は
            見た目上の演出以上の意味を持たず(pull-to-refreshの表示はJS側のpull stateで
            別途描画している)、noneにして弾み自体を発生させないほうが安全なため変更した */}
        <div className="min-h-[calc(100%+1px)]">{children}</div>
      </div>
    </div>
  )
}
