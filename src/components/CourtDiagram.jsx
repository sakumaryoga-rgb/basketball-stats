import { useRef } from 'react'
import { cn } from '@/lib/utils'

// ハーフコートの略図。タップした位置を0-100%の座標として返す。
// shots: [{ id, x, y, made }] を渡すと過去のショットをマーカー表示する(成功=青丸/失敗=赤×)
export function CourtDiagram({ shots = [], onTap, active = false, className }) {
  const ref = useRef(null)

  function handleClick(e) {
    if (!active || !onTap) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onTap({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) })
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={cn(
        'relative aspect-[100/94] w-full overflow-hidden rounded-lg bg-muted/30',
        active && 'cursor-crosshair ring-2 ring-primary',
        className
      )}
    >
      <svg viewBox="0 0 100 94" className="absolute inset-0 size-full text-muted-foreground/50" preserveAspectRatio="none">
        <rect x="0.5" y="0.5" width="99" height="93" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <line x1="42" y1="4" x2="58" y2="4" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="50" cy="6.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <rect x="34" y="0" width="32" height="30" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="50" cy="30" r="12" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <path
          d="M 6 0 L 6 24.4 A 47.5 47.5 0 0 0 94 24.4 L 94 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>
      {shots.map((shot) => (
        <div
          key={shot.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
        >
          {shot.made ? (
            <div className="flex size-4 items-center justify-center rounded-full border-2 border-blue-500 text-[9px] font-bold text-blue-500">
              {shot.count ?? ''}
            </div>
          ) : (
            <span className="block text-xs font-bold leading-none text-destructive">✕</span>
          )}
        </div>
      ))}
    </div>
  )
}
