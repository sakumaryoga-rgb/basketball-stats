// 試合/スクリメージ作成時に編集するSTARTING FIVE / RESERVEの下書き。
// { starters: [PGのID, SGのID, SFのID, PFのID, CのID], reserves: [playerId...] } を不変データとして扱う。
// startersは常に5枠の配列で、空いている枠はnull。枠の位置がポジション番号
// (1=PG, 2=SG, 3=SF, 4=PF, 5=C)で、PLAYERS → STARTINGのコートと同じ並び(COURT_SLOTS)。
// 保存先(game_lineups.on_court)は「先発かどうか」だけを持ち、どの枠かは保存されない
import { teamRoster } from '@/lib/roster'
import { COURT_SLOTS, assignStartersToSlots } from '@/lib/positionStyle'

export const MAX_STARTERS = 5
// ポジション番号の枠(index 0〜4 → 1〜5番)
export const STARTER_SLOTS = COURT_SLOTS.map((s) => s.key) // ['PG', 'SG', 'SF', 'PF', 'C']

// 先発の選手ID(空き枠を除く)
export function starterIds(lineup) {
  return lineup.starters.filter(Boolean)
}

export function starterCount(lineup) {
  return starterIds(lineup).length
}

// DBトリガー(seed_game_lineups)が試合作成時に作る初期状態と同じ先発を再現し、
// PLAYERS → STARTINGのコートと同じ規則(assignStartersToSlots)でPG〜Cの枠に割り当てる。
// is_starterの選手が先発。1人もいなければsort_order→背番号順の先頭5人が先発になる。
// 万一is_starterが6人以上いる古いデータでも、下書きの先発は5人までに収める
export function initialLineup(players) {
  const roster = teamRoster(players)
  let starters = roster.filter((p) => p.is_starter)
  if (starters.length === 0) {
    starters = [...roster]
      // PostgreSQLの昇順と同じく、背番号未設定(null)は後ろに回す
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.number ?? Infinity) - (b.number ?? Infinity) || 0)
  }
  starters = starters.slice(0, MAX_STARTERS)
  const slots = assignStartersToSlots(starters)
  const slotIds = STARTER_SLOTS.map((key) => slots[key]?.id ?? null)
  const starterSet = new Set(slotIds.filter(Boolean))
  return {
    starters: slotIds,
    reserves: roster.filter((p) => !starterSet.has(p.id)).map((p) => p.id),
  }
}

export function listOf(lineup, id) {
  if (id && lineup.starters.includes(id)) return 'starters'
  if (lineup.reserves.includes(id)) return 'reserves'
  return null
}

// 空いている枠。選手のポジション(第1→第2)と同じ枠が空いていればそこを優先する
export function preferredEmptySlot(lineup, player) {
  for (const pos of [player?.position, player?.position2]) {
    const index = STARTER_SLOTS.indexOf(pos)
    if (index >= 0 && !lineup.starters[index]) return index
  }
  const first = lineup.starters.findIndex((x) => !x)
  return first >= 0 ? first : null
}

// 2人の位置をそのまま入れ替える(枠どうし・枠とRESERVE・RESERVEどうし)。先発の人数は変わらない
export function swapPlayers(lineup, a, b) {
  const swap = (list) => list.map((x) => (x === a ? b : x === b ? a : x))
  return { starters: swap(lineup.starters), reserves: swap(lineup.reserves) }
}

// idをSTARTING FIVEのtoIndex番目の枠、またはRESERVEのtoIndexの位置へ移す。
// - 移動先の枠に別の選手がいれば、その選手と入れ替える(移動した選手がその枠の番号になる)
// - 枠からRESERVEへ移すと、元の枠は空き(null)になる
export function movePlayer(lineup, id, toList, toIndex) {
  const fromList = listOf(lineup, id)
  if (!fromList) return lineup
  if (toList === 'starters') {
    if (toIndex == null || toIndex < 0 || toIndex >= MAX_STARTERS) return lineup
    const occupant = lineup.starters[toIndex]
    if (occupant === id) return lineup
    if (occupant) return swapPlayers(lineup, id, occupant)
    const starters = lineup.starters.map((x) => (x === id ? null : x))
    starters[toIndex] = id
    return { starters, reserves: lineup.reserves.filter((x) => x !== id) }
  }
  const starters = lineup.starters.map((x) => (x === id ? null : x))
  const reserves = lineup.reserves.filter((x) => x !== id)
  const index = Math.max(0, Math.min(toIndex ?? reserves.length, reserves.length))
  return { starters, reserves: [...reserves.slice(0, index), id, ...reserves.slice(index)] }
}

// 先発の顔ぶれ(枠の位置は問わない)が同じか
export function sameStarters(a, b) {
  const ids = starterIds(a)
  const other = new Set(starterIds(b))
  return ids.length === other.size && ids.every((id) => other.has(id))
}
