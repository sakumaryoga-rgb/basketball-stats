import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 1試合分のスタッツイベントとボックススコア(player_game_stats)を取得・購読する
export function useGameStats(gameId) {
  const [events, setEvents] = useState([])
  const [boxScore, setBoxScore] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!gameId) {
      setEvents([])
      setBoxScore([])
      setLoading(false)
      return
    }
    const [eventsRes, boxRes] = await Promise.all([
      supabase.from('stat_events').select('*').eq('game_id', gameId).order('created_at'),
      supabase.from('player_game_stats').select('*').eq('game_id', gameId),
    ])
    if (eventsRes.error) console.error('スタッツイベントの取得に失敗しました', eventsRes.error)
    if (boxRes.error) console.error('ボックススコアの取得に失敗しました', boxRes.error)
    setEvents(eventsRes.data ?? [])
    setBoxScore(boxRes.data ?? [])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`stat-events-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stat_events', filter: `game_id=eq.${gameId}` },
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [gameId, refresh])

  async function recordStat(playerId, statKey, { quarter = 1, shotX = null, shotY = null } = {}) {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('stat_events').insert({
      game_id: gameId,
      player_id: playerId,
      stat_key: statKey,
      quarter,
      shot_x: shotX,
      shot_y: shotY,
      created_by: userData?.user?.id ?? null,
    })
    if (error) {
      console.error('スタッツの記録に失敗しました', error)
      return false
    }
    // DELETEと違い本来はrealtime通知で自動的に反映されるが、体感速度のため即時にも反映する
    refresh()
    return true
  }

  async function undoLast() {
    if (events.length === 0) return
    const last = events[events.length - 1]
    const { error } = await supabase.from('stat_events').delete().eq('id', last.id)
    if (error) {
      console.error('取り消しに失敗しました', error)
      return
    }
    // DELETEイベントはreplica identityの都合でgame_idフィルタのrealtime通知が
    // 届かないことがあるため、削除した本人はここで明示的に再取得する
    refresh()
  }

  return { events, boxScore, loading, recordStat, undoLast }
}
