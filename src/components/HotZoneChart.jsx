import { useEffect, useMemo, useRef } from 'react'
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
  classifyCourtPoint,
  ZONES,
  ZONE_ORDER,
} from '@/lib/hotZones'
import { formatPct } from '@/lib/stats'

// FG%(0-100、null=試投なし)を「低い(青)→平均的(ニュートラル)→高い(赤)」の
// 発散配色に変換する。NEUTRAL_PCT を挟んで乖離が大きいほど彩度を強くする。
const NEUTRAL_PCT = 45
const NEUTRAL_RGB = [231, 229, 227]
const HIGH_RGB = [190, 35, 42] // 赤(高FG%)
const LOW_RGB = [36, 99, 197] // 青(低FG%)
const NO_DATA_RGB = [224, 224, 229]

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function zoneColorRGB(pct) {
  if (pct === null) return NO_DATA_RGB
  const clamped = Math.max(0, Math.min(100, pct))
  const target = clamped >= NEUTRAL_PCT ? HIGH_RGB : LOW_RGB
  const span = clamped >= NEUTRAL_PCT ? 100 - NEUTRAL_PCT : NEUTRAL_PCT
  const t = span === 0 ? 0 : Math.min(1, Math.abs(clamped - NEUTRAL_PCT) / span)
  return [
    lerpChannel(NEUTRAL_RGB[0], target[0], t),
    lerpChannel(NEUTRAL_RGB[1], target[1], t),
    lerpChannel(NEUTRAL_RGB[2], target[2], t),
  ]
}

function zoneColorCss(pct) {
  const [r, g, b] = zoneColorRGB(pct)
  return `rgb(${r} ${g} ${b})`
}

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = Math.round((CANVAS_WIDTH * 94) / 100)

// ゾーンの塗り分けは classifyCourtPoint をそのままラスタライズして描く。
// SVGパスでゾーン境界を手計算すると実際の判定ロジックとズレる(以前のバグの原因)ため、
// 「判定関数=描画」を一致させて不整合が起きないようにする。
function drawZones(canvas, hotZones) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const image = ctx.createImageData(width, height)
  const data = image.data
  const colorByZone = new Map(ZONE_ORDER.map((key) => [key, zoneColorRGB(hotZones[key].pct)]))

  for (let py = 0; py < height; py++) {
    const courtY = (py / height) * 94
    for (let px = 0; px < width; px++) {
      const courtX = (px / width) * 100
      const zone = classifyCourtPoint(courtX, courtY)
      const [r, g, b] = colorByZone.get(zone)
      const idx = (py * width + px) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

function polarPoint(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: HOOP.x + radius * Math.sin(rad), y: HOOP.y + radius * Math.cos(rad) }
}

function dividerLine(angleDeg, r1, r2) {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = Math.cos(rad)
  return {
    x1: HOOP.x + r1 * dx,
    y1: HOOP.y + r1 * dy,
    x2: HOOP.x + r2 * dx,
    y2: HOOP.y + r2 * dy,
  }
}

const MID_RANGE_RADIUS = (RESTRICTED_RADIUS_UNITS + THREE_POINT_RADIUS_UNITS) / 2
const ABOVE_BREAK_RADIUS = THREE_POINT_RADIUS_UNITS + 10

// ゾーンラベルの表示位置(各ゾーンのおおよその重心)
const ZONE_LABEL_POS = {
  restricted_area: polarPoint(0, RESTRICTED_RADIUS_UNITS * 0.55),
  paint: { x: 50, y: (RESTRICTED_RADIUS_UNITS + HOOP.y + PAINT_MAX_Y) / 2 },
  mid_range_left: polarPoint(-70, MID_RANGE_RADIUS),
  mid_range_left_center: polarPoint(-36, MID_RANGE_RADIUS),
  mid_range_center: polarPoint(0, MID_RANGE_RADIUS),
  mid_range_right_center: polarPoint(36, MID_RANGE_RADIUS),
  mid_range_right: polarPoint(70, MID_RANGE_RADIUS),
  left_corner_3: { x: CORNER_X_INSET / 2, y: CORNER_Y_LIMIT * 0.55 },
  right_corner_3: { x: 100 - CORNER_X_INSET / 2, y: CORNER_Y_LIMIT * 0.55 },
  above_break_3_left: polarPoint(-60, ABOVE_BREAK_RADIUS),
  above_break_3_center: polarPoint(0, ABOVE_BREAK_RADIUS),
  above_break_3_right: polarPoint(60, ABOVE_BREAK_RADIUS),
}

// ミッドレンジ(5分割)・アーク3(3分割)の境界線。実際の判定角度(hotZones.js)と揃えてある。
const ZONE_DIVIDER_LINES = [
  dividerLine(-54, RESTRICTED_RADIUS_UNITS, 100),
  dividerLine(-18, RESTRICTED_RADIUS_UNITS, 100),
  dividerLine(18, RESTRICTED_RADIUS_UNITS, 100),
  dividerLine(54, RESTRICTED_RADIUS_UNITS, 100),
  dividerLine(-30, THREE_POINT_RADIUS_UNITS, 100),
  dividerLine(30, THREE_POINT_RADIUS_UNITS, 100),
]

const RESTRICTED_AREA_PATH = `M ${HOOP.x - RESTRICTED_RADIUS_UNITS} 0 L ${HOOP.x - RESTRICTED_RADIUS_UNITS} ${HOOP.y} A ${RESTRICTED_RADIUS_UNITS} ${RESTRICTED_RADIUS_UNITS} 0 0 0 ${HOOP.x + RESTRICTED_RADIUS_UNITS} ${HOOP.y} L ${HOOP.x + RESTRICTED_RADIUS_UNITS} 0`
const THREE_POINT_LINE_PATH = `M ${CORNER_X_INSET} 0 L ${CORNER_X_INSET} ${CORNER_Y_LIMIT} A ${THREE_POINT_RADIUS_UNITS} ${THREE_POINT_RADIUS_UNITS} 0 0 0 ${100 - CORNER_X_INSET} ${CORNER_Y_LIMIT} L ${100 - CORNER_X_INSET} 0`

export function HotZoneChart({ hotZones }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current) drawZones(canvasRef.current, hotZones)
  }, [hotZones])

  const legendColors = useMemo(
    () => Object.fromEntries(ZONE_ORDER.map((key) => [key, zoneColorCss(hotZones[key].pct)])),
    [hotZones]
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[100/94] w-full overflow-hidden rounded-lg bg-muted/20">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="absolute inset-0 size-full"
          style={{ imageRendering: 'pixelated' }}
        />
        <svg viewBox="0 0 100 94" className="absolute inset-0 size-full" preserveAspectRatio="none">
          <g fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="0.35">
            {ZONE_DIVIDER_LINES.map((line, i) => (
              <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
            ))}
          </g>
          <g fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="0.5">
            <rect x="0.5" y="0.5" width="99" height="93" />
            <rect x={PAINT_MIN_X} y="0" width={PAINT_MAX_X - PAINT_MIN_X} height={PAINT_MAX_Y} />
            <circle cx="50" cy={FREE_THROW_LINE_Y} r={FREE_THROW_CIRCLE_RADIUS_UNITS} />
            <path d={RESTRICTED_AREA_PATH} />
            <path d={THREE_POINT_LINE_PATH} />
            <circle cx={HOOP.x} cy={HOOP.y} r="1.5" />
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
              <p className="text-[9px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
                {z.attempts > 0 ? formatPct(z.pct) : '-'}
              </p>
              {z.attempts > 0 && (
                <p className="text-[7px] text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
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
            <span className="inline-block size-2.5 rounded-full shrink-0" style={{ backgroundColor: legendColors[key] }} />
            <span className="truncate">{ZONES[key].label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
