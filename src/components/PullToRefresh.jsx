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
export function PullToRefresh({ children, onRefresh }) {
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(null)
  const enabledRef = useRef(false)
  const pendingPullRef = useRef(0)
  const rafIdRef = useRef(null)

  useEffect(() => {
    enabledRef.current = window.matchMedia('(display-mode: standalone)').matches
  }, [])

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
      if (!enabledRef.current || refreshing) return
      if (window.scrollY > 0) {
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
          onRefresh?.()
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
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [refreshing, onRefresh])

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
    <>
      <div
        className={cn('flex justify-center overflow-hidden', settleTransition)}
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
      <div className={cn(settleTransition)} style={{ transform: pull ? `translateY(${pull}px)` : undefined }}>
        {children}
      </div>
    </>
  )
}
