// NBA公式(stats.nba.com / nba_api の ShotChartDetail)のショットゾーン定義に基づく
// ホットゾーン分類。SHOT_ZONE_BASIC(6分類)と SHOT_ZONE_AREA(L/LC/C/RC/R)を掛け合わせた
// 12ゾーンで判定する。コート座標は CourtDiagram / GameDetail のショットチャートと同じ
// 0-100(横) / 0-94(縦) のパーセンテージ系(2 unit = 1ft、ハーフコート実寸 50ft×47ft)を使う。
// この定数群は CourtDiagram.jsx と共有しており、描画とゾーン判定が食い違わないようにしている。

const UNIT_PER_FOOT = 2

// バスケットの中心はベースラインから5.25ft(バックボード4ft + リングの前出し1.25ft)。
export const HOOP = { x: 50, y: 5.25 * UNIT_PER_FOOT }

const RESTRICTED_AREA_RADIUS_FT = 4
const THREE_POINT_RADIUS_FT = 23.75
const CORNER_THREE_SIDE_INSET_FT = 3 // サイドラインから3ft
const PAINT_HALF_WIDTH_FT = 8 // ペイント幅16ftの半分
const PAINT_DEPTH_FT = 19 // ベースラインからフリースローラインまで
const FREE_THROW_CIRCLE_RADIUS_FT = 6

export const CORNER_X_INSET = CORNER_THREE_SIDE_INSET_FT * UNIT_PER_FOOT // = 6
export const PAINT_MIN_X = HOOP.x - PAINT_HALF_WIDTH_FT * UNIT_PER_FOOT
export const PAINT_MAX_X = HOOP.x + PAINT_HALF_WIDTH_FT * UNIT_PER_FOOT
export const PAINT_MAX_Y = PAINT_DEPTH_FT * UNIT_PER_FOOT
export const RESTRICTED_RADIUS_UNITS = RESTRICTED_AREA_RADIUS_FT * UNIT_PER_FOOT
export const THREE_POINT_RADIUS_UNITS = THREE_POINT_RADIUS_FT * UNIT_PER_FOOT
export const FREE_THROW_CIRCLE_RADIUS_UNITS = FREE_THROW_CIRCLE_RADIUS_FT * UNIT_PER_FOOT
export const FREE_THROW_LINE_Y = PAINT_MAX_Y

// コーナー3のライン(サイドラインから3ft)が、バスケット中心からの半径23.75ftの
// アークと交わる高さ(ベースラインからの距離)。すべて内部unit系で計算する。
const CORNER_DX = HOOP.x - CORNER_X_INSET
export const CORNER_Y_LIMIT = HOOP.y + Math.sqrt(THREE_POINT_RADIUS_UNITS ** 2 - CORNER_DX ** 2)

// ミッドレンジ(5分割)・アーク3(3分割)の角度境界。バスケット正面を0度、
// 右サイドを正、左サイドを負とする(SHOT_ZONE_AREA の Right/Left に対応)。
const MID_RANGE_ANGLE_BOUNDARIES = [-54, -18, 18, 54]
const ABOVE_BREAK_ANGLE_BOUNDARIES = [-30, 30]

export const ZONES = {
  restricted_area: { key: 'restricted_area', label: 'リング下', area: 'Center(C)' },
  paint: { key: 'paint', label: 'ペイント', area: 'Center(C)' },
  mid_range_left: { key: 'mid_range_left', label: 'ミッドレンジ(左)', area: 'Left Side(L)' },
  mid_range_left_center: { key: 'mid_range_left_center', label: 'ミッドレンジ(左センター)', area: 'Left Side Center(LC)' },
  mid_range_center: { key: 'mid_range_center', label: 'ミッドレンジ(センター)', area: 'Center(C)' },
  mid_range_right_center: { key: 'mid_range_right_center', label: 'ミッドレンジ(右センター)', area: 'Right Side Center(RC)' },
  mid_range_right: { key: 'mid_range_right', label: 'ミッドレンジ(右)', area: 'Right Side(R)' },
  left_corner_3: { key: 'left_corner_3', label: '左コーナー3', area: 'Left Side(L)' },
  right_corner_3: { key: 'right_corner_3', label: '右コーナー3', area: 'Right Side(R)' },
  above_break_3_left: { key: 'above_break_3_left', label: 'アーク3(左)', area: 'Left Side Center(LC)' },
  above_break_3_center: { key: 'above_break_3_center', label: 'アーク3(センター)', area: 'Center(C)' },
  above_break_3_right: { key: 'above_break_3_right', label: 'アーク3(右)', area: 'Right Side Center(RC)' },
}

export const ZONE_ORDER = [
  'restricted_area',
  'paint',
  'mid_range_left',
  'mid_range_left_center',
  'mid_range_center',
  'mid_range_right_center',
  'mid_range_right',
  'left_corner_3',
  'right_corner_3',
  'above_break_3_left',
  'above_break_3_center',
  'above_break_3_right',
]

function distanceFromHoop(dx, dy) {
  return Math.hypot(dx, dy)
}

// バスケット正面(コート奥方向)を0度とした角度。右サイドが正、左サイドが負になる。
function angleFromHoop(dx, dy) {
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

function bucketByAngle(angle, boundaries, keys) {
  for (let i = 0; i < boundaries.length; i++) {
    if (angle <= boundaries[i]) return keys[i]
  }
  return keys[keys.length - 1]
}

// shot_x / shot_y ( 0-100 のパーセンテージ、y は高さに対する割合 ) を
// コートの内部座標系( 0-100 x 0-94 )に変換する
export function toCourtUnits(shotX, shotY) {
  return { x: shotX, y: (shotY / 100) * 94 }
}

// コート内部座標系( 0-100 x 0-94 )の1点からNBA公式のゾーンを判定する
export function classifyCourtPoint(x, y) {
  const dx = x - HOOP.x
  const dy = y - HOOP.y
  const dist = distanceFromHoop(dx, dy)

  const inLeftCorner = x <= CORNER_X_INSET && y <= CORNER_Y_LIMIT
  const inRightCorner = x >= 100 - CORNER_X_INSET && y <= CORNER_Y_LIMIT
  if (inLeftCorner) return 'left_corner_3'
  if (inRightCorner) return 'right_corner_3'

  if (dist >= THREE_POINT_RADIUS_UNITS) {
    const angle = angleFromHoop(dx, dy)
    return bucketByAngle(angle, ABOVE_BREAK_ANGLE_BOUNDARIES, [
      'above_break_3_left',
      'above_break_3_center',
      'above_break_3_right',
    ])
  }
  if (dist <= RESTRICTED_RADIUS_UNITS) return 'restricted_area'
  if (x >= PAINT_MIN_X && x <= PAINT_MAX_X && y >= 0 && y <= PAINT_MAX_Y) return 'paint'

  const angle = angleFromHoop(dx, dy)
  return bucketByAngle(angle, MID_RANGE_ANGLE_BOUNDARIES, [
    'mid_range_left',
    'mid_range_left_center',
    'mid_range_center',
    'mid_range_right_center',
    'mid_range_right',
  ])
}

// 1本のショット位置(shot_x/shot_y、0-100のパーセンテージ)からNBA公式のゾーンを判定する
export function classifyShotZone(shotX, shotY) {
  const { x, y } = toCourtUnits(shotX, shotY)
  return classifyCourtPoint(x, y)
}

export const THREE_POINT_ZONES = new Set([
  'left_corner_3', 'right_corner_3', 'above_break_3_left', 'above_break_3_center', 'above_break_3_right',
])

// バスケット中心からタップ地点への直線(角度)上を探索し、指定したカテゴリ
// (3PT / 2PT)に分類される最も近い距離の点を見つける。試合中の指操作では
// アーク3のライン付近で隣のゾーン(ミッドレンジ等)を誤タップしやすいが、
// 記録するスタッツ自体(2P/3P)は選択済みのカテゴリで確定しているため、
// ホットゾーンの記録だけをそのカテゴリに合う最寄りのゾーンへ自動補正する
function nearestDistanceForCategory(ux, uy, dist0, wantThree) {
  const maxDelta = 100
  const step = 0.1
  for (let delta = 0; delta <= maxDelta; delta += step) {
    for (const d of [dist0 + delta, dist0 - delta]) {
      if (d < 0) continue
      const px = HOOP.x + ux * d
      const py = HOOP.y + uy * d
      if (THREE_POINT_ZONES.has(classifyCourtPoint(px, py)) === wantThree) return d
    }
  }
  return dist0
}

// shot_x/shot_y(0-100のパーセンテージ)を受け取り、選択中のカテゴリ(2PT/3PT)と
// 矛盾しないゾーンになるよう座標を補正して返す。既に一致していればそのまま返す
export function snapToZoneCategory(shotX, shotY, wantThree) {
  const { x, y } = toCourtUnits(shotX, shotY)
  const isThree = THREE_POINT_ZONES.has(classifyCourtPoint(x, y))
  if (isThree === wantThree) return { shotX, shotY }

  const dx = x - HOOP.x
  const dy = y - HOOP.y
  const dist0 = distanceFromHoop(dx, dy)
  if (dist0 === 0) return { shotX, shotY }

  const ux = dx / dist0
  const uy = dy / dist0
  const d = nearestDistanceForCategory(ux, uy, dist0, wantThree)
  const correctedX = HOOP.x + ux * d
  const correctedYUnits = HOOP.y + uy * d
  return { shotX: correctedX, shotY: (correctedYUnits / 94) * 100 }
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

export function isThreePointZone(zoneKey) {
  return THREE_POINT_ZONES.has(zoneKey)
}

// ゾーン単位の試投数/成功数タリー([{zone, attempts, makes}, ...])からホットゾーンを集計する。
// シューティング練習(shooting_entries)は座標ではなくゾーン単位で記録するため、
// aggregateHotZonesとは別に「すでにゾーン別に集計済みの入力」を受け取るバージョンを用意する。
export function aggregateHotZonesFromTallies(tallies) {
  const stats = Object.fromEntries(ZONE_ORDER.map((key) => [key, { attempts: 0, makes: 0 }]))
  for (const tally of tallies) {
    if (!stats[tally.zone]) continue
    stats[tally.zone].attempts += tally.attempts
    stats[tally.zone].makes += tally.makes
  }
  for (const key of ZONE_ORDER) {
    const z = stats[key]
    z.pct = z.attempts > 0 ? (z.makes / z.attempts) * 100 : null
  }
  return stats
}

// 複数のホットゾーン集計結果(aggregateHotZones系の戻り値)をゾーンごとに合算する
export function mergeHotZones(...hotZoneSets) {
  const merged = Object.fromEntries(ZONE_ORDER.map((key) => [key, { attempts: 0, makes: 0 }]))
  for (const set of hotZoneSets) {
    if (!set) continue
    for (const key of ZONE_ORDER) {
      merged[key].attempts += set[key]?.attempts ?? 0
      merged[key].makes += set[key]?.makes ?? 0
    }
  }
  for (const key of ZONE_ORDER) {
    const z = merged[key]
    z.pct = z.attempts > 0 ? (z.makes / z.attempts) * 100 : null
  }
  return merged
}
