// 試合の勝敗(W/L/T)。終了していない試合はnull
export function gameResult(game, teamScore) {
  if (game.status !== 'final') return null
  const ours = teamScore ?? 0
  const theirs = game.opponent_score ?? 0
  if (ours > theirs) return 'W'
  if (ours < theirs) return 'L'
  return 'T'
}

// 試合一覧(日付の新しい順)から通算成績・直近のフォーム・連勝/連敗をまとめる
export function summarizeRecord(games, scoresByGameId) {
  const results = []
  for (const g of games) {
    const r = gameResult(g, scoresByGameId[g.id])
    if (r) results.push(r)
  }
  const wins = results.filter((r) => r === 'W').length
  const losses = results.filter((r) => r === 'L').length
  const ties = results.filter((r) => r === 'T').length
  let streak = null
  if (results.length > 0) {
    const type = results[0]
    let count = 0
    while (count < results.length && results[count] === type) count++
    streak = { type, count }
  }
  return {
    wins,
    losses,
    ties,
    played: results.length,
    winRate: results.length ? wins / results.length : null,
    // 左が古く右が新しい順(フォームガイドの一般的な並び)
    form: results.slice(0, 5).reverse(),
    streak,
    live: games.some((g) => g.status === 'in_progress'),
  }
}

export function streakLabel(streak) {
  if (!streak || streak.count < 2) return null
  if (streak.type === 'W') return `${streak.count}連勝中`
  if (streak.type === 'L') return `${streak.count}連敗中`
  return null
}
