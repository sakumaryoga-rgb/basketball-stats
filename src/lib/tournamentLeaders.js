// 大会(1日の複数試合)の1試合平均スタッツから、主要スタッツのリーダー(上位)を求める
export const TOURNAMENT_LEADER_CATEGORIES = [
  { key: 'pts', label: '得点', short: 'PTS' },
  { key: 'reb', label: 'リバウンド', short: 'REB' },
  { key: 'ast', label: 'アシスト', short: 'AST' },
  { key: 'stl', label: 'スティール', short: 'STL' },
  { key: 'blk', label: 'ブロック', short: 'BLK' },
]

const SUM_KEYS = TOURNAMENT_LEADER_CATEGORIES.map((c) => c.key)

// player_game_statsの行(選手×試合)を選手ごとに合計する
export function sumByPlayer(rows) {
  const byPlayer = new Map()
  for (const row of rows ?? []) {
    const acc = byPlayer.get(row.player_id) ?? {
      player_id: row.player_id,
      games_played: 0,
      ...Object.fromEntries(SUM_KEYS.map((k) => [k, 0])),
    }
    acc.games_played += 1
    for (const k of SUM_KEYS) acc[k] += row[k] ?? 0
    byPlayer.set(row.player_id, acc)
  }
  return [...byPlayer.values()]
}

// key の1試合平均(合計÷出場試合数)で上位 limit 位までを返す。0は除外し、
// 表示上同じ値(小数第1位で四捨五入)は同順位(1,1,3…)にする。
// 表示は limit 人までにし、limit 人目と同じ値でその後ろに並ぶ人数を tiedOthers で返す。
// playersById にいない選手(ゲストなど)は含めない
export function rankLeaders(totals, key, playersById, limit = 3) {
  const list = totals
    .map((t) => {
      const value = t.games_played ? (t[key] ?? 0) / t.games_played : 0
      return { player: playersById.get(t.player_id), value, tenths: Math.round(value * 10), games_played: t.games_played }
    })
    .filter((row) => row.player && row.tenths > 0)
    .sort((a, b) => b.value - a.value || (a.player.number ?? Infinity) - (b.player.number ?? Infinity))
  const ranked = []
  for (let i = 0; i < list.length; i++) {
    const rank = i > 0 && list[i].tenths === list[i - 1].tenths ? ranked[i - 1].rank : i + 1
    if (rank > limit) break
    ranked.push({ ...list[i], rank })
  }
  return { rows: ranked.slice(0, limit), tiedOthers: Math.max(0, ranked.length - limit) }
}
