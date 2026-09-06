import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

export function useGames(teamId) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setGames([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('team_id', teamId)
      .order('game_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) console.error('試合一覧の取得に失敗しました', error)
    setGames(data ?? [])
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`games-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  async function createGame({ opponentName, gameDate, location }) {
    const { data, error } = await supabase
      .from('games')
      .insert({ team_id: teamId, opponent_name: opponentName, game_date: gameDate, location: location || null })
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
