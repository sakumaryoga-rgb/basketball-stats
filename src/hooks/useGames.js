import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// gameType: 'official'(GAMESタブ) | 'practice'(スクリメージ) | 'shooting'(シューティング)。
// null/未指定の場合は種別を問わず全件取得する(GameDetailがidだけで試合を
// 特定する際に使う)。
// tournamentId: 'official'の試合を特定の大会だけに絞り込みたい場合に指定する
// (TournamentGamesが使う。大会の中で試合を作成する際もこのIDが使われる)。
export function useGames(teamId, gameType = null, tournamentId = null) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setGames([])
      setLoading(false)
      return
    }
    let query = supabase.from('games').select('*').eq('team_id', teamId)
    if (gameType) query = query.eq('game_type', gameType)
    if (tournamentId) query = query.eq('tournament_id', tournamentId)
    const { data, error } = await query
      .order('game_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) console.error('試合一覧の取得に失敗しました', error)
    setGames(data ?? [])
    setLoading(false)
  }, [teamId, gameType, tournamentId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`games-${teamId}-${gameType}-${tournamentId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, gameType, tournamentId, refresh])

  async function createGame({ opponentName, gameDate, location, periodSystem }) {
    const { data, error } = await supabase
      .from('games')
      .insert({
        team_id: teamId,
        opponent_name: opponentName || null,
        game_date: gameDate,
        location: location || null,
        game_type: gameType || 'official',
        tournament_id: tournamentId || null,
        ...(periodSystem ? { period_system: periodSystem } : {}),
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function updateGame(id, patch) {
    const { error } = await supabase.from('games').update(patch).eq('id', id)
    if (error) throw error
  }

  async function deleteGame(id) {
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) throw error
  }

  return { games, loading, refresh, createGame, updateGame, deleteGame }
}
