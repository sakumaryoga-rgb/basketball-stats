import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

const SUM_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']

function emptyBucket() {
  return { gamesPlayed: 0, totals: Object.fromEntries(SUM_KEYS.map((k) => [k, 0])) }
}

// チームの成績を、2Q制/4Q制それぞれと全公式戦(all)で集計する。TEAM画面の1試合平均は
// '2q'/'4q'、シュート成功率とシーズン合計は'all'を使う。player_game_statsを試合単位で
// 合算するため、ゲスト選手(その試合限定の助っ人)の記録もチームの記録として含まれる
// (試合画面のチーム得点・試合一覧のスコア・スコアシートと同じ考え方。個人成績を集計する
// player_season_statsはゲストを含まないため、チーム成績の算出には使わない)。
// 以下は元の説明: チームの「1試合平均」を大会の2Q制/4Q制で分けて集計する。公式試合をperiod_systemごとに
// グループ化し、各試合のplayer_game_stats(全選手分)を試合単位で合算してからチーム全体で
// 合計・試合数をカウントする({status !== 'scheduled'}の試合のみ、TeamSettings.jsxの
// 既存のgamesPlayed算出と同じ条件)
export function useTeamPeriodStats(teamId) {
  const [stats, setStats] = useState({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }
    // loadingは初回読み込みの間だけtrueにする(stat_eventsの変更通知による再集計のたびに
    // TEAM画面の成績表示が一瞬消えないようにするため)

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status, period_system')
      .eq('team_id', teamId)
      .eq('game_type', 'official')

    if (gamesError) {
      console.error('試合一覧の取得に失敗しました', gamesError)
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }

    const playedGames = (games ?? []).filter((g) => g.status !== 'scheduled')
    const gameIds = playedGames.map((g) => g.id)

    if (gameIds.length === 0) {
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }

    const { data: boxRows, error: boxError } = await supabase
      .from('player_game_stats')
      .select('*')
      .in('game_id', gameIds)

    if (boxError) {
      console.error('チームスタッツの取得に失敗しました', boxError)
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }

    const periodSystemByGame = new Map(playedGames.map((g) => [g.id, g.period_system]))
    const result = { '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() }

    // 試合数は(スタッツが1件も無い試合も含め)プレイ済みの試合数そのものを数える。
    // 合計値だけをスタッツ側から積み上げる
    for (const game of playedGames) {
      if (result[game.period_system]) result[game.period_system].gamesPlayed += 1
      result.all.gamesPlayed += 1
    }
    for (const row of boxRows ?? []) {
      const periodSystem = periodSystemByGame.get(row.game_id)
      if (!periodSystem) continue
      const bucket = result[periodSystem]
      for (const k of SUM_KEYS) {
        if (bucket) bucket.totals[k] += row[k] ?? 0
        result.all.totals[k] += row[k] ?? 0
      }
    }

    setStats(result)
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`team-period-stats-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  return { stats, loading }
}
