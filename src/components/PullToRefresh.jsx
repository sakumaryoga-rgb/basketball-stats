import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const PULL_THRESHOLD = 70
const MAX_PULL = 110

// ホーム画面に追加した状態(standalone PWA)ではブラウザのpull-to-refreshが
// 使えなくなるため、最上部から下に引っ張ったら再読み込みする独自実装を提供する。
// 通常のブラウザタブではネイティブの挙動を邪魔しないよう、standalone判定の時だけ有効化する。
export function PullToRefresh({ children }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(null)
  const enabledRef = useRef(false)

  useEffect(() => {
    enabledRef.current = window.matchMedia('(display-mode: standalone)').matches
  }, [])

  useEffect(() => {
    function handleTouchStart(e) {
      if (!enabledRef.current || refreshing) return
      if (window.scrollY > 0) {
        startYRef.current = null
        return
      }
      startYRef.current = e.touches[0].clientY
    }

    function handleTouchMove(e) {
      if (startYRef.current == null) return
      const delta = e.touches[0].clientY - startYRef.current
      if (delta <= 0) {
        setPull(0)
        return
      }
      setPull(Math.min(MAX_PULL, delta))
    }

    function handleTouchEnd() {
      if (startYRef.current == null) return
      startYRef.current = null
      setPull((current) => {
        if (current >= PULL_THRESHOLD) {
          setRefreshing(true)
          window.location.reload()
        } else {
          return 0
        }
        return current
      })
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [refreshing])

  const ready = pull >= PULL_THRESHOLD

  return (
    <>
      <div
        className="flex justify-center overflow-hidden transition-[height] duration-150 ease-out"
        style={{ height: pull }}
        aria-hidden="true"
      >
        <div className="flex items-end pb-2">
          <RefreshCw
            className={cn(
              'size-5 text-muted-foreground transition-transform duration-150',
              refreshing && 'animate-spin',
              ready && 'text-primary'
            )}
            style={{ transform: `rotate(${pull * 2.5}deg)` }}
          />
        </div>
      </div>
      <div
        className="transition-transform duration-150 ease-out"
        style={{ transform: pull ? `translateY(${pull}px)` : undefined }}
      >
        {children}
      </div>
    </>
  )
}
