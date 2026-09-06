import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

const SUM_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'plus_minus']

// チーム全選手のシーズン成績を合算したチーム全体のスタッツを返す
export function useTeamSeasonStats(teamId) {
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setTotals(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('player_season_stats').select('*').eq('team_id', teamId)
    if (error) {
      console.error('チームスタッツの取得に失敗しました', error)
      setTotals(null)
      setLoading(false)
      return
    }
    const rows = data ?? []
    const sum = (key) => rows.reduce((acc, row) => acc + (row[key] ?? 0), 0)
    setTotals(Object.fromEntries(SUM_KEYS.map((key) => [key, sum(key)])))
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`team-season-stats-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  return { totals, loading }
}
