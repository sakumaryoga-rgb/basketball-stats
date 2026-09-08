import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 指定したシューティングセッション(game_id)群それぞれについて、実際に記録が
// 存在する選手ID(重複なし)を返す。追加時に選んだだけで実際には未記録の選手を
// 参加者として表示してしまわないよう、shooting_entriesの実データを根拠にする。
export function useShootingParticipants(gameIds) {
  const [participantsByGame, setParticipantsByGame] = useState({})
  const key = gameIds.join(',')

  const refresh = useCallback(async () => {
    if (!key) {
      setParticipantsByGame({})
      return
    }
    const { data, error } = await supabase
      .from('shooting_entries')
      .select('game_id, player_id')
      .in('game_id', key.split(','))
    if (error) {
      console.error('シューティング参加者の取得に失敗しました', error)
      return
    }
    const map = {}
    for (const row of data ?? []) {
      const list = map[row.game_id] ?? (map[row.game_id] = [])
      if (!list.includes(row.player_id)) list.push(row.player_id)
    }
    setParticipantsByGame(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!key) return
    const channel = supabase
      .channel(`shooting-participants-${key}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shooting_entries' }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refresh])

  return participantsByGame
}
