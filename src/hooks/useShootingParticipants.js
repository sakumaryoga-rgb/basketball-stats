import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 指定したシューティングセッション(game_id)群それぞれについて、実際に記録が
// 存在する選手ID(重複なし)と、セッション全体の試投数・成功数を返す。
// 追加時に選んだだけで実際には未記録の選手を参加者として表示してしまわないよう、
// shooting_entriesの実データを根拠にする。
export function useShootingParticipants(gameIds) {
  const [summaryByGame, setSummaryByGame] = useState({})
  const key = gameIds.join(',')

  const refresh = useCallback(async () => {
    if (!key) {
      setSummaryByGame({})
      return
    }
    const { data, error } = await supabase
      .from('shooting_entries')
      .select('game_id, player_id, attempts, makes')
      .in('game_id', key.split(','))
    if (error) {
      console.error('シューティング参加者の取得に失敗しました', error)
      return
    }
    const map = {}
    for (const row of data ?? []) {
      const summary = map[row.game_id] ?? (map[row.game_id] = { participants: [], attempts: 0, makes: 0 })
      if (!summary.participants.includes(row.player_id)) summary.participants.push(row.player_id)
      summary.attempts += row.attempts ?? 0
      summary.makes += row.makes ?? 0
    }
    setSummaryByGame(map)
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

  return summaryByGame
}
