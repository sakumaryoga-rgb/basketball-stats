import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// シューティング練習(game_type='shooting')のゾーン別タリー(何本打って何本決めたか)を
// 取得・更新する。1本ごとの座標イベントではなく、ゾーン単位で試投数/成功数を
// まとめて記録する「メモ」的なテーブル。
export function useShootingEntries(gameId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!gameId) {
      setEntries([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('shooting_entries').select('*').eq('game_id', gameId)
    if (error) console.error('シューティング記録の取得に失敗しました', error)
    setEntries(data ?? [])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`shooting-entries-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shooting_entries', filter: `game_id=eq.${gameId}` },
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [gameId, refresh])

  async function addTally(playerId, zone, attempts, makes) {
    const { error } = await supabase.rpc('increment_shooting_entry', {
      p_game_id: gameId,
      p_player_id: playerId,
      p_zone: zone,
      p_attempts: attempts,
      p_makes: makes,
    })
    if (error) {
      console.error('シューティング記録の保存に失敗しました', error)
      return false
    }
    refresh()
    return true
  }

  async function resetZone(playerId, zone) {
    const { error } = await supabase
      .from('shooting_entries')
      .delete()
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .eq('zone', zone)
    if (error) {
      console.error('シューティング記録の削除に失敗しました', error)
      return
    }
    refresh()
  }

  return { entries, loading, addTally, resetZone, refresh }
}
