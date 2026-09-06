import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// チーム全選手のシーズン合計スタッツ(player_season_stats ビュー)を取得・購読する
export function useSeasonStats(teamId) {
  const [seasonStats, setSeasonStats] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setSeasonStats([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('player_season_stats').select('*').eq('team_id', teamId)
    if (error) console.error('シーズンスタッツの取得に失敗しました', error)
    setSeasonStats(data ?? [])
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`stat-events-season-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  return { seasonStats, loading, refresh }
}
