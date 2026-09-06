import { useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  HOOP,
  CORNER_X_INSET,
  CORNER_Y_LIMIT,
  PAINT_MIN_X,
  PAINT_MAX_X,
  PAINT_MAX_Y,
  RESTRICTED_RADIUS_UNITS,
  THREE_POINT_RADIUS_UNITS,
  FREE_THROW_CIRCLE_RADIUS_UNITS,
  FREE_THROW_LINE_Y,
} from '@/lib/hotZones'

const BACKBOARD_HALF_WIDTH = 6 // 6ftのバックボードの半分(unit)
const BACKBOARD_Y = 8 // ベースラインから4ft
const RESTRICTED_AREA_PATH = `M ${HOOP.x - RESTRICTED_RADIUS_UNITS} 0 L ${HOOP.x - RESTRICTED_RADIUS_UNITS} ${HOOP.y} A ${RESTRICTED_RADIUS_UNITS} ${RESTRICTED_RADIUS_UNITS} 0 0 0 ${HOOP.x + RESTRICTED_RADIUS_UNITS} ${HOOP.y} L ${HOOP.x + RESTRICTED_RADIUS_UNITS} 0`
const THREE_POINT_LINE_PATH = `M ${CORNER_X_INSET} 0 L ${CORNER_X_INSET} ${CORNER_Y_LIMIT} A ${THREE_POINT_RADIUS_UNITS} ${THREE_POINT_RADIUS_UNITS} 0 0 0 ${100 - CORNER_X_INSET} ${CORNER_Y_LIMIT} L ${100 - CORNER_X_INSET} 0`

// ハーフコートの略図。タップした位置を0-100%の座標として返す。
// コート寸法は hotZones.js と共有しており、ここで見えている線とホットゾーンの
// 判定境界が食い違わないようにしている。
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
        <line
          x1={HOOP.x - BACKBOARD_HALF_WIDTH}
          y1={BACKBOARD_Y}
          x2={HOOP.x + BACKBOARD_HALF_WIDTH}
          y2={BACKBOARD_Y}
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <circle cx={HOOP.x} cy={HOOP.y} r="1.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <path d={RESTRICTED_AREA_PATH} fill="none" stroke="currentColor" strokeWidth="0.5" />
        <rect x={PAINT_MIN_X} y="0" width={PAINT_MAX_X - PAINT_MIN_X} height={PAINT_MAX_Y} fill="none" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="50" cy={FREE_THROW_LINE_Y} r={FREE_THROW_CIRCLE_RADIUS_UNITS} fill="none" stroke="currentColor" strokeWidth="0.5" />
        <path d={THREE_POINT_LINE_PATH} fill="none" stroke="currentColor" strokeWidth="0.5" />
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
