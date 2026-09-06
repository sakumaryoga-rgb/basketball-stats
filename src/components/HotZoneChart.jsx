import {
  HOOP,
  CORNER_X_INSET,
  CORNER_Y_LIMIT,
  PAINT_MIN_X,
  PAINT_MAX_X,
  PAINT_MAX_Y,
  RESTRICTED_RADIUS_UNITS,
  THREE_POINT_RADIUS_UNITS,
  ZONES,
  ZONE_ORDER,
} from '@/lib/hotZones'
import { formatPct } from '@/lib/stats'

// FG%(0-100、null=試投なし)を「寒色(低い)→暖色(高い)」のヒートカラーに変換する
function zoneColor(pct) {
  if (pct === null) return 'oklch(0.9 0.005 250)'
  const clamped = Math.max(0, Math.min(100, pct))
  const hue = 240 - (clamped / 100) * 240
  return `oklch(0.62 0.16 ${hue})`
}

// 各ゾーンの塗りつぶし用SVGパス。CourtDiagram と同じ 0-100 x 0-94 の座標系。
function restrictedAreaPath() {
  const r = RESTRICTED_RADIUS_UNITS
  const dy = HOOP.y
  const dx = Math.sqrt(Math.max(0, r * r - dy * dy))
  const x1 = HOOP.x - dx
  const x2 = HOOP.x + dx
  return `M ${x1} 0 A ${r} ${r} 0 1 1 ${x2} 0 Z`
}

function paintPath() {
  const rect = `M ${PAINT_MIN_X} 0 H ${PAINT_MAX_X} V ${PAINT_MAX_Y} H ${PAINT_MIN_X} Z`
  const r = RESTRICTED_RADIUS_UNITS
  const hole = `M ${HOOP.x - r} ${HOOP.y} A ${r} ${r} 0 1 0 ${HOOP.x + r} ${HOOP.y} A ${r} ${r} 0 1 0 ${HOOP.x - r} ${HOOP.y} Z`
  return `${rect} ${hole}`
}

function cornerPath(side) {
  return side === 'left' ? `M 0 0 H ${CORNER_X_INSET} V ${CORNER_Y_LIMIT} H 0 Z` : `M ${100 - CORNER_X_INSET} 0 H 100 V ${CORNER_Y_LIMIT} H ${100 - CORNER_X_INSET} Z`
}

function midRangePath() {
  const r = THREE_POINT_RADIUS_UNITS
  const x1 = HOOP.x - r
  const x2 = HOOP.x + r
  // アーク内側(2P全体)から、ペイントと制限区域を打ち抜く
  const arc = `M ${x1} 0 A ${r} ${r} 0 1 1 ${x2} 0 Z`
  const paintHole = `M ${PAINT_MIN_X} ${PAINT_MAX_Y} H ${PAINT_MAX_X} V 0 H ${PAINT_MIN_X} Z`
  return `${arc} ${paintHole}`
}

function aboveBreakPath() {
  const r = THREE_POINT_RADIUS_UNITS
  const x1 = HOOP.x - r
  const x2 = HOOP.x + r
  const outer = `M 0 0 H 100 V 94 H 0 Z`
  const arcHole = `M ${x1} 0 A ${r} ${r} 0 1 0 ${x2} 0 Z`
  const leftCornerHole = `M 0 0 H ${CORNER_X_INSET} V ${CORNER_Y_LIMIT} H 0 Z`
  const rightCornerHole = `M ${100 - CORNER_X_INSET} 0 H 100 V ${CORNER_Y_LIMIT} H ${100 - CORNER_X_INSET} Z`
  return `${outer} ${arcHole} ${leftCornerHole} ${rightCornerHole}`
}

const ZONE_PATHS = {
  restricted_area: restrictedAreaPath(),
  paint: paintPath(),
  mid_range: midRangePath(),
  left_corner_3: cornerPath('left'),
  right_corner_3: cornerPath('right'),
  above_break_3: aboveBreakPath(),
}

// ゾーンラベルの表示位置(おおよその重心)
const ZONE_LABEL_POS = {
  restricted_area: { x: 50, y: 9 },
  paint: { x: 50, y: 26 },
  mid_range: { x: 50, y: 44 },
  left_corner_3: { x: 3, y: 14 },
  right_corner_3: { x: 97, y: 14 },
  above_break_3: { x: 50, y: 66 },
}

export function HotZoneChart({ hotZones }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[100/94] w-full overflow-hidden rounded-lg bg-muted/20">
        <svg viewBox="0 0 100 94" className="absolute inset-0 size-full" preserveAspectRatio="none">
          {ZONE_ORDER.map((key) => (
            <path
              key={key}
              d={ZONE_PATHS[key]}
              fillRule="evenodd"
              fill={zoneColor(hotZones[key].pct)}
              stroke="var(--background)"
              strokeWidth="0.5"
            />
          ))}
          <g className="text-muted-foreground" stroke="currentColor" strokeWidth="0.4" fill="none" opacity="0.6">
            <rect x="0.5" y="0.5" width="99" height="93" />
            <line x1="42" y1="4" x2="58" y2="4" />
            <circle cx="50" cy="6.5" r="1.5" />
          </g>
        </svg>
        {ZONE_ORDER.map((key) => {
          const z = hotZones[key]
          const pos = ZONE_LABEL_POS[key]
          return (
            <div
              key={key}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center leading-tight"
              style={{ left: `${pos.x}%`, top: `${(pos.y / 94) * 100}%` }}
            >
              <p className="text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                {z.attempts > 0 ? formatPct(z.pct) : '-'}
              </p>
              {z.attempts > 0 && (
                <p className="text-[8px] text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                  {z.makes}/{z.attempts}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {ZONE_ORDER.map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full shrink-0" style={{ backgroundColor: zoneColor(hotZones[key].pct) }} />
            <span className="truncate">{ZONES[key].label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
