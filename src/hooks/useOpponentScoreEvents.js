import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 相手チームの得点イベント(ショット種別・クォーター・発生時刻)を取得・記録する。
// 相手チームの選手名簿は管理していないため、プレイヤー単位の紐付けは行わない。
export const OPPONENT_STAT_POINTS = { fg2_make: 2, fg3_make: 3, ft_make: 1 }

export function useOpponentScoreEvents(gameId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!gameId) {
      setEvents([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('opponent_score_events')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at')
    if (error) console.error('相手チームの得点イベントの取得に失敗しました', error)
    setEvents(data ?? [])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`opponent-score-events-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opponent_score_events', filter: `game_id=eq.${gameId}` },
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [gameId, refresh])

  async function recordOpponentStat(statKey, quarter) {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('opponent_score_events').insert({
      game_id: gameId,
      stat_key: statKey,
      quarter,
      created_by: userData?.user?.id ?? null,
    })
    if (error) {
      console.error('相手チームの得点記録に失敗しました', error)
      return false
    }
    refresh()
    return true
  }

  async function undoLastOpponentStat() {
    if (events.length === 0) return false
    const { error } = await supabase.from('opponent_score_events').delete().eq('id', events[events.length - 1].id)
    if (error) {
      console.error('相手チームの得点記録の取り消しに失敗しました', error)
      return false
    }
    refresh()
    return true
  }

  return { events, loading, recordOpponentStat, undoLastOpponentStat }
}
