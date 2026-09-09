import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { filterGamesByPeriod } from '@/lib/stats'

const SUM_KEYS = ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf']

// 期間(直近5試合・直近3ヶ月・今シーズン・全期間)で絞り込んだ選手ごとの合計スタッツを集計する。
// periodSystemを指定すると、その2Q制/4Q制の試合(公式戦)だけをさらに絞り込む
export function usePeriodStats(teamId, period, periodSystem) {
  const [periodStats, setPeriodStats] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setPeriodStats([])
      setLoading(false)
      return
    }
    setLoading(true)

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, game_date, period_system')
      .eq('team_id', teamId)
      .order('game_date', { ascending: false })

    if (gamesError) {
      console.error('試合一覧の取得に失敗しました', gamesError)
      setPeriodStats([])
      setLoading(false)
      return
    }

    const gamesForSystem = periodSystem ? (games ?? []).filter((g) => g.period_system === periodSystem) : (games ?? [])
    const targetGames = filterGamesByPeriod(gamesForSystem, period)
    const gameIds = targetGames.map((g) => g.id)

    if (gameIds.length === 0) {
      setPeriodStats([])
      setLoading(false)
      return
    }

    const { data: boxRows, error: boxError } = await supabase
      .from('player_game_stats')
      .select('*')
      .in('game_id', gameIds)

    if (boxError) {
      console.error('期間スタッツの取得に失敗しました', boxError)
      setPeriodStats([])
      setLoading(false)
      return
    }

    const byPlayer = new Map()
    for (const row of boxRows ?? []) {
      const acc = byPlayer.get(row.player_id) ?? {
        player_id: row.player_id,
        games_played: 0,
        ...Object.fromEntries(SUM_KEYS.map((k) => [k, 0])),
      }
      acc.games_played += 1
      for (const k of SUM_KEYS) acc[k] += row[k] ?? 0
      byPlayer.set(row.player_id, acc)
    }

    setPeriodStats(Array.from(byPlayer.values()))
    setLoading(false)
  }, [teamId, period, periodSystem])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`period-stats-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  return { periodStats, loading, refresh }
}
