import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// playerId を指定すればその選手、指定しなければチーム全体の
// シュート位置付きスタッツ(2P/3Pの成功・失敗)を全試合分取得する。
// ホットゾーン集計やシュートチャート表示に使う。
export function useShotChart(teamId, playerId = null) {
  const [shots, setShots] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setShots([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase
      .from('stat_events')
      .select('shot_x, shot_y, stat_key, games!inner(team_id)')
      .eq('games.team_id', teamId)
      .not('shot_x', 'is', null)
    if (playerId) query = query.eq('player_id', playerId)

    const { data, error } = await query
    if (error) {
      console.error('シュートデータの取得に失敗しました', error)
      setShots([])
      setLoading(false)
      return
    }
    setShots((data ?? []).map((row) => ({ shot_x: row.shot_x, shot_y: row.shot_y, made: row.stat_key.endsWith('_make') })))
    setLoading(false)
  }, [teamId, playerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`shot-chart-${teamId}-${playerId ?? 'team'}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, playerId, refresh])

  return { shots, loading, refresh }
}
