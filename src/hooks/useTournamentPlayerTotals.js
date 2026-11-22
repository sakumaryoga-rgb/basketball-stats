import { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { sumByPlayer } from '@/lib/tournamentLeaders'

// 大会に含まれる試合(gameIds)の選手ごとの合計スタッツ。試合を記録中でも反映されるよう、
// stat_eventsの変更で取り直す
export function useTournamentPlayerTotals(gameIds) {
  const [totals, setTotals] = useState([])
  const [loading, setLoading] = useState(true)
  const key = gameIds.join(',')

  useEffect(() => {
    if (!key) {
      setTotals([])
      setLoading(false)
      return
    }
    let cancelled = false
    const load = () =>
      supabase
        .from('player_game_stats')
        .select('game_id, player_id, pts, reb, ast, stl, blk')
        .in('game_id', key.split(','))
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) console.error('大会スタッツの取得に失敗しました', error)
          else setTotals(sumByPlayer(data))
          setLoading(false)
        })
    load()
    const channel = supabase
      .channel(`tournament-totals-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, (payload) => {
        const gameId = payload.new?.game_id ?? payload.old?.game_id
        if (!gameId || key.includes(gameId)) load()
      })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [key])

  return { totals, loading }
}
