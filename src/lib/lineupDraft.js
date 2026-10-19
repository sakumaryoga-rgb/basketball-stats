// 試合/スクリメージ作成時に編集するSTARTING FIVE / RESERVEの下書き。
// { starters: [playerId...], reserves: [playerId...] } を不変データとして扱う。
// 保存先(game_lineups.on_court)は「先発かどうか」だけを持ち、並び順の列はない。
// そのため並び順は作成画面の中だけの並べ替えで、DBには保存されない
import { teamRoster } from '@/lib/roster'

export const MAX_STARTERS = 5

// DBトリガー(seed_game_lineups)が試合作成時に作る初期状態と同じ並び・同じ先発を再現する。
// is_starterの選手が先発。1人もいなければsort_order→背番号順の先頭5人が先発になる。
// 万一is_starterが6人以上いる古いデータでも、下書きの先発は5人までに収める
export function initialLineup(players) {
  const roster = teamRoster(players)
  let starterIds = roster.filter((p) => p.is_starter).map((p) => p.id)
  if (starterIds.length === 0) {
    starterIds = [...roster]
      // PostgreSQLの昇順と同じく、背番号未設定(null)は後ろに回す
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.number ?? Infinity) - (b.number ?? Infinity) || 0)
      .slice(0, MAX_STARTERS)
      .map((p) => p.id)
  }
  starterIds = starterIds.slice(0, MAX_STARTERS)
  const starterSet = new Set(starterIds)
  return {
    starters: roster.filter((p) => starterSet.has(p.id)).map((p) => p.id),
    reserves: roster.filter((p) => !starterSet.has(p.id)).map((p) => p.id),
  }
}

export function listOf(lineup, id) {
  if (lineup.starters.includes(id)) return 'starters'
  if (lineup.reserves.includes(id)) return 'reserves'
  return null
}

// idをtoListのtoIndexの位置へ移す(同じリスト内なら並べ替え)。
// STARTING FIVEが既に5人で、RESERVEから追加しようとした場合は何もしない(入れ替えはswapPlayersで行う)
export function movePlayer(lineup, id, toList, toIndex) {
  const fromList = listOf(lineup, id)
  if (!fromList) return lineup
  if (toList === 'starters' && fromList !== 'starters' && lineup.starters.length >= MAX_STARTERS) return lineup
  const next = {
    starters: lineup.starters.filter((x) => x !== id),
    reserves: lineup.reserves.filter((x) => x !== id),
  }
  const target = next[toList]
  const index = Math.max(0, Math.min(toIndex ?? target.length, target.length))
  next[toList] = [...target.slice(0, index), id, ...target.slice(index)]
  return next
}

// 2人の位置をそのまま入れ替える。STARTING FIVEとRESERVEをまたぐ場合は先発の人数が変わらない
export function swapPlayers(lineup, a, b) {
  const swap = (list) => list.map((x) => (x === a ? b : x === b ? a : x))
  return { starters: swap(lineup.starters), reserves: swap(lineup.reserves) }
}

export function sameStarters(a, b) {
  if (a.starters.length !== b.starters.length) return false
  const set = new Set(a.starters)
  return b.starters.every((id) => set.has(id))
}
