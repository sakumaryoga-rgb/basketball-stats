import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 1試合分のスタッツイベントとボックススコアを取得・購読する。
// player_game_statsは公式試合(game_type='official')のみを集計するビューなので、
// スクリメージ(practice)の場合はplayer_practice_game_statsから取得する。
export function useGameStats(gameId, gameType = 'official') {
  const [events, setEvents] = useState([])
  const [boxScore, setBoxScore] = useState([])
  const [loading, setLoading] = useState(true)
  const boxScoreTable = gameType === 'practice' ? 'player_practice_game_stats' : 'player_game_stats'

  const refresh = useCallback(async () => {
    if (!gameId) {
      setEvents([])
      setBoxScore([])
      setLoading(false)
      return
    }
    const [eventsRes, boxRes] = await Promise.all([
      supabase.from('stat_events').select('*').eq('game_id', gameId).order('created_at'),
      supabase.from(boxScoreTable).select('*').eq('game_id', gameId),
    ])
    if (eventsRes.error) console.error('スタッツイベントの取得に失敗しました', eventsRes.error)
    if (boxRes.error) console.error('ボックススコアの取得に失敗しました', boxRes.error)
    setEvents(eventsRes.data ?? [])
    setBoxScore(boxRes.data ?? [])
    setLoading(false)
  }, [gameId, boxScoreTable])

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

  async function deleteStat(eventId) {
    const { error } = await supabase.from('stat_events').delete().eq('id', eventId)
    if (error) {
      console.error('取り消しに失敗しました', error)
      return false
    }
    // DELETEイベントはreplica identityの都合でgame_idフィルタのrealtime通知が
    // 届かないことがあるため、削除した本人はここで明示的に再取得する
    refresh()
    return true
  }

  async function undoLast() {
    if (events.length === 0) return
    await deleteStat(events[events.length - 1].id)
  }

  // プレイ単位の修正(LOG)用。stat_eventsにはUPDATE用のトリガーが無く、INSERT/DELETEに
  // 連動してgame_lineups.plus_minusを増減させるトリガーだけがあるため、既存イベントを
  // 一旦削除してから新しい内容で挿入し直すことで、既存のトリガーだけで正しく反映させる。
  // 再挿入時はcreated_atを元のイベントの値のまま引き継ぐ(省略するとinsert時刻=今になり、
  // PLAY LOGが時系列順に並んでいる都合上、修正しただけのプレイが一番上(最新)に
  // 移動して表示されてしまっていたため)
  async function editStat(eventId, { playerId, statKey, quarter, shotX = null, shotY = null }) {
    const target = events.find((e) => e.id === eventId)
    if (!target) return false
    const { error: deleteError } = await supabase.from('stat_events').delete().eq('id', eventId)
    if (deleteError) {
      console.error('プレイの修正に失敗しました', deleteError)
      return false
    }
    const { data: userData } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('stat_events').insert({
      game_id: gameId,
      player_id: playerId,
      stat_key: statKey,
      quarter,
      shot_x: shotX,
      shot_y: shotY,
      created_at: target.created_at,
      created_by: userData?.user?.id ?? null,
    })
    if (insertError) {
      console.error('プレイの修正に失敗しました', insertError)
      refresh()
      return false
    }
    refresh()
    return true
  }

  return { events, boxScore, loading, recordStat, undoLast, deleteStat, editStat }
}
