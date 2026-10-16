// ポジションごとの色。ロスターのカード上部の帯やチップ、ジャージの色に使う
export const POSITION_COLOR = {
  PG: 'oklch(0.58 0.21 25)',
  SG: 'oklch(0.68 0.17 50)',
  SF: 'oklch(0.72 0.15 85)',
  PF: 'oklch(0.58 0.12 175)',
  C: 'oklch(0.45 0.12 260)',
}
export const UNSET_COLOR = 'oklch(0.6 0.01 255)'

export function positionColor(position) {
  return POSITION_COLOR[position] ?? UNSET_COLOR
}

// STARTING FIVEをハーフコート上に配置する位置(%)。ゴールは下側
export const COURT_SLOTS = [
  { key: 'PG', x: 50, y: 17 },
  { key: 'SG', x: 83, y: 36 },
  { key: 'SF', x: 17, y: 36 },
  { key: 'PF', x: 70, y: 63 },
  { key: 'C', x: 30, y: 63 },
]

// 第一ポジション→第二ポジション→空いている枠の順で、先発5人をコート上の枠に割り当てる
export function assignStartersToSlots(starters) {
  const slots = Object.fromEntries(COURT_SLOTS.map((s) => [s.key, null]))
  const remaining = [...starters]
  for (const field of ['position', 'position2']) {
    for (const p of [...remaining]) {
      const pos = p[field]
      if (pos && pos in slots && !slots[pos]) {
        slots[pos] = p
        remaining.splice(remaining.indexOf(p), 1)
      }
    }
  }
  for (const s of COURT_SLOTS) {
    if (!slots[s.key] && remaining.length) slots[s.key] = remaining.shift()
  }
  return slots
}
