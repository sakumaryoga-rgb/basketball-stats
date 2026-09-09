import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

const SUM_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']

function emptyBucket() {
  return { gamesPlayed: 0, totals: Object.fromEntries(SUM_KEYS.map((k) => [k, 0])) }
}

// チームの「1試合平均」を大会の2Q制/4Q制で分けて集計する。公式試合をperiod_systemごとに
// グループ化し、各試合のplayer_game_stats(全選手分)を試合単位で合算してからチーム全体で
// 合計・試合数をカウントする({status !== 'scheduled'}の試合のみ、TeamSettings.jsxの
// 既存のgamesPlayed算出と同じ条件)
export function useTeamPeriodStats(teamId) {
  const [stats, setStats] = useState({ '2q': emptyBucket(), '4q': emptyBucket() })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setStats({ '2q': emptyBucket(), '4q': emptyBucket() })
      setLoading(false)
      return
    }
    setLoading(true)

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status, period_system')
      .eq('team_id', teamId)
      .eq('game_type', 'official')

    if (gamesError) {
      console.error('試合一覧の取得に失敗しました', gamesError)
      setStats({ '2q': emptyBucket(), '4q': emptyBucket() })
      setLoading(false)
      return
    }

    const playedGames = (games ?? []).filter((g) => g.status !== 'scheduled')
    const gameIds = playedGames.map((g) => g.id)

    if (gameIds.length === 0) {
      setStats({ '2q': emptyBucket(), '4q': emptyBucket() })
      setLoading(false)
      return
    }

    const { data: boxRows, error: boxError } = await supabase
      .from('player_game_stats')
      .select('*')
      .in('game_id', gameIds)

    if (boxError) {
      console.error('チームスタッツの取得に失敗しました', boxError)
      setStats({ '2q': emptyBucket(), '4q': emptyBucket() })
      setLoading(false)
      return
    }

    const periodSystemByGame = new Map(playedGames.map((g) => [g.id, g.period_system]))
    const result = { '2q': emptyBucket(), '4q': emptyBucket() }

    // 試合数は(スタッツが1件も無い試合も含め)プレイ済みの試合数そのものを数える。
    // 合計値だけをスタッツ側から積み上げる
    for (const game of playedGames) {
      if (result[game.period_system]) result[game.period_system].gamesPlayed += 1
    }
    for (const row of boxRows ?? []) {
      const periodSystem = periodSystemByGame.get(row.game_id)
      if (!periodSystem) continue
      const bucket = result[periodSystem]
      for (const k of SUM_KEYS) bucket.totals[k] += row[k] ?? 0
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
