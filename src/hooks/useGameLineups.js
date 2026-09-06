import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 試合ごとのSTARTING FIVE / RESERVE、出場時間、プラスマイナスを管理する
export function useGameLineups(gameId) {
  const [lineups, setLineups] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!gameId) {
      setLineups([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('game_lineups').select('*').eq('game_id', gameId)
    if (error) console.error('出場状況の取得に失敗しました', error)
    setLineups(data ?? [])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`game-lineups-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_lineups', filter: `game_id=eq.${gameId}` },
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [gameId, refresh])

  // playerOutをRESERVEに、playerInをSTARTING FIVEに入れ替える。
  // 行がまだ存在しない選手(ゲスト等)でも作成できるようupsertする。
  const substitute = useCallback(
    async (playerOutId, playerInId) => {
      const { error: outError } = await supabase
        .from('game_lineups')
        .upsert({ game_id: gameId, player_id: playerOutId, on_court: false }, { onConflict: 'game_id,player_id' })
      const { error: inError } = await supabase
        .from('game_lineups')
        .upsert({ game_id: gameId, player_id: playerInId, on_court: true }, { onConflict: 'game_id,player_id' })
      if (outError || inError) {
        console.error('選手交代に失敗しました', outError ?? inError)
        return false
      }
      refresh()
      return true
    },
    [gameId, refresh]
  )

  const incrementSeconds = useCallback(
    async (delta) => {
      if (!gameId || delta <= 0) return
      const { error } = await supabase.rpc('increment_lineup_seconds', { p_game_id: gameId, p_delta: delta })
      if (error) console.error('出場時間の更新に失敗しました', error)
    },
    [gameId]
  )

  return { lineups, loading, substitute, incrementSeconds, refresh }
}
