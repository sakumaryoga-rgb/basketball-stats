import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 相手チームの得点イベント(ショット種別・クォーター・発生時刻)を取得・記録する。
// 相手チームの選手名簿は管理していないため、プレイヤー単位の紐付けは行わない。
//
// 記録・取り消しはPostgres側のRPC(record_opponent_score / undo_last_opponent_score,
// supabase/migrations/035_atomic_opponent_score.sql参照)を通す。イベントの追加と
// games.opponent_scoreの更新を同一トランザクション内で行うことで、クライアント側の
// 古いstateを基準にした加算によるロスト・アップデート(連続入力時に一部の加点が
// 失われる不具合)を防ぐ。
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

  // 戻り値: 成功時は新しいgames.opponent_score(RPCがDB側で計算した値)、失敗時はnull
  async function recordOpponentStat(statKey, quarter) {
    const { data, error } = await supabase.rpc('record_opponent_score', {
      p_game_id: gameId,
      p_stat_key: statKey,
      p_quarter: quarter,
    })
    if (error) {
      console.error('相手チームの得点記録に失敗しました', error)
      return null
    }
    refresh()
    return data?.[0]?.new_opponent_score ?? null
  }

  async function undoLastOpponentStat() {
    if (events.length === 0) return null
    const { data, error } = await supabase.rpc('undo_last_opponent_score', { p_game_id: gameId })
    if (error) {
      console.error('相手チームの得点記録の取り消しに失敗しました', error)
      return null
    }
    refresh()
    return data?.[0]?.new_opponent_score ?? null
  }

  return { events, loading, recordOpponentStat, undoLastOpponentStat }
}
