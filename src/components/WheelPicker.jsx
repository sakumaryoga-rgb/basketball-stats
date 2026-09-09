import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const ITEM_HEIGHT = 36

// iPhoneのタイマーのような、スクロールでスナップして選ぶホイールピッカー。
export function WheelPicker({ values, value, onChange, className }) {
  const containerRef = useRef(null)
  const settleTimerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const index = values.indexOf(value)
    if (index >= 0) {
      // scroll-smoothが効いた状態でscrollTopに直接代入するとアニメーションになり、
      // 途中で中断されると中途半端な位置で止まってしまう。初期位置は瞬時に合わせる。
      const prevBehavior = el.style.scrollBehavior
      el.style.scrollBehavior = 'auto'
      el.scrollTop = index * ITEM_HEIGHT
      el.style.scrollBehavior = prevBehavior
    }
    // 初回マウント時のみ現在値の位置へスクロールする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => clearTimeout(settleTimerRef.current), [])

  function handleScroll() {
    clearTimeout(settleTimerRef.current)
    settleTimerRef.current = setTimeout(() => {
      const el = containerRef.current
      if (!el) return
      const index = Math.round(el.scrollTop / ITEM_HEIGHT)
      const clamped = Math.min(values.length - 1, Math.max(0, index))
      if (el.scrollTop !== clamped * ITEM_HEIGHT) {
        el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' })
      }
      if (values[clamped] !== value) onChange(values[clamped])
    }, 100)
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        'h-[108px] w-14 overflow-y-scroll overscroll-y-contain snap-y snap-mandatory scroll-smooth',
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        className
      )}
      style={{ paddingBlock: ITEM_HEIGHT }}
    >
      {values.map((v) => (
        <div
          key={v}
          className={cn(
            'flex items-center justify-center snap-center tabular-nums text-xl',
            v === value ? 'font-bold text-foreground' : 'text-muted-foreground/40'
          )}
          style={{ height: ITEM_HEIGHT }}
        >
          {String(v).padStart(2, '0')}
        </div>
      ))}
    </div>
  )
}
