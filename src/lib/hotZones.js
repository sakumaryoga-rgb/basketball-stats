// NBA公式(stats.nba.com)のショットゾーン定義に基づくホットゾーン分類。
// コート座標は CourtDiagram / GameDetail のショットチャートと同じ 0-100(横) / 0-94(縦) の
// パーセンテージ系を使う。この系は実寸コートに対して 1 unit = 0.5ft(2 unit = 1ft)で
// 描かれており、バスケットの中心は (50, 6.5) に置かれている。

export const HOOP = { x: 50, y: 6.5 }
const UNIT_PER_FOOT = 2

const RESTRICTED_AREA_RADIUS_FT = 4
const THREE_POINT_RADIUS_FT = 23.75
const CORNER_THREE_SIDE_INSET_FT = 3 // サイドラインから3ft
const PAINT_HALF_WIDTH_FT = 8 // ペイント幅16ftの半分
const PAINT_DEPTH_FT = 19 // ベースラインからフリースローラインまで

export const CORNER_X_INSET = CORNER_THREE_SIDE_INSET_FT * UNIT_PER_FOOT // = 6
export const PAINT_MIN_X = HOOP.x - PAINT_HALF_WIDTH_FT * UNIT_PER_FOOT
export const PAINT_MAX_X = HOOP.x + PAINT_HALF_WIDTH_FT * UNIT_PER_FOOT
export const PAINT_MAX_Y = PAINT_DEPTH_FT * UNIT_PER_FOOT
export const RESTRICTED_RADIUS_UNITS = RESTRICTED_AREA_RADIUS_FT * UNIT_PER_FOOT
export const THREE_POINT_RADIUS_UNITS = THREE_POINT_RADIUS_FT * UNIT_PER_FOOT
// コーナー3のライン(サイドラインから3ft)が、バスケット中心からの半径23.75ftの
// アークと交わる高さ(ベースラインからの距離)。すべて内部unit系で計算する。
const CORNER_DX = HOOP.x - CORNER_X_INSET
export const CORNER_Y_LIMIT = HOOP.y + Math.sqrt(THREE_POINT_RADIUS_UNITS ** 2 - CORNER_DX ** 2)

export const ZONES = {
  restricted_area: { key: 'restricted_area', label: 'リング下' },
  paint: { key: 'paint', label: 'ペイント' },
  mid_range: { key: 'mid_range', label: 'ミッドレンジ' },
  left_corner_3: { key: 'left_corner_3', label: '左コーナー3' },
  right_corner_3: { key: 'right_corner_3', label: '右コーナー3' },
  above_break_3: { key: 'above_break_3', label: 'アーク3' },
}

export const ZONE_ORDER = [
  'restricted_area',
  'paint',
  'mid_range',
  'left_corner_3',
  'right_corner_3',
  'above_break_3',
]

function distanceFromHoop(x, y) {
  return Math.hypot(x - HOOP.x, y - HOOP.y)
}

// shot_x / shot_y ( 0-100 のパーセンテージ、y は高さに対する割合 ) を
// コートの内部座標系( 0-100 x 0-94 )に変換する
export function toCourtUnits(shotX, shotY) {
  return { x: shotX, y: (shotY / 100) * 94 }
}

// 1本のショット位置からNBA公式のゾーンを判定する
export function classifyShotZone(shotX, shotY) {
  const { x, y } = toCourtUnits(shotX, shotY)
  const dist = distanceFromHoop(x, y)

  const inLeftCorner = x <= CORNER_X_INSET && y <= CORNER_Y_LIMIT
  const inRightCorner = x >= 100 - CORNER_X_INSET && y <= CORNER_Y_LIMIT
  if (inLeftCorner) return 'left_corner_3'
  if (inRightCorner) return 'right_corner_3'

  if (dist >= THREE_POINT_RADIUS_UNITS) return 'above_break_3'
  if (dist <= RESTRICTED_RADIUS_UNITS) return 'restricted_area'
  if (x >= PAINT_MIN_X && x <= PAINT_MAX_X && y >= 0 && y <= PAINT_MAX_Y) return 'paint'
  return 'mid_range'
}

// ショット配列([{shot_x, shot_y, made}, ...])からゾーンごとの試投数・成功数・FG%を集計する
export function aggregateHotZones(shots) {
  const stats = Object.fromEntries(ZONE_ORDER.map((key) => [key, { attempts: 0, makes: 0 }]))
  for (const shot of shots) {
    if (shot.shot_x == null || shot.shot_y == null) continue
    const zone = classifyShotZone(Number(shot.shot_x), Number(shot.shot_y))
    stats[zone].attempts += 1
    if (shot.made) stats[zone].makes += 1
  }
  for (const key of ZONE_ORDER) {
    const z = stats[key]
    z.pct = z.attempts > 0 ? (z.makes / z.attempts) * 100 : null
  }
  return stats
}
