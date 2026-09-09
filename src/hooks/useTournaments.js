import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// チームの大会(tournament)一覧。GAMEタブは大会単位の一覧になり、各大会の中に
// 複数の公式試合(games.tournament_id経由)をぶら下げる(スクリメージ/シューティングは対象外)
export function useTournaments(teamId) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setTournaments([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (error) console.error('大会一覧の取得に失敗しました', error)
    setTournaments(data ?? [])
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`tournaments-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `team_id=eq.${teamId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  async function createTournament({ name, gameDate, location }) {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({ team_id: teamId, name, game_date: gameDate, location: location || null })
      .select()
      .single()
    if (error) throw error
    // realtimeの反映を待たず即座に一覧へ反映する(created_at降順なので先頭に追加)
    setTournaments((prev) => [data, ...prev])
    return data
  }

  async function updateTournament(id, patch) {
    setTournaments((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    const { error } = await supabase.from('tournaments').update(patch).eq('id', id)
    if (error) {
      console.error('大会の更新に失敗しました', error)
      refresh()
      throw error
    }
  }

  async function deleteTournament(id) {
    setTournaments((prev) => prev.filter((t) => t.id !== id))
    const { error } = await supabase.from('tournaments').delete().eq('id', id)
    if (error) {
      console.error('大会の削除に失敗しました', error)
      refresh()
      throw error
    }
  }

  return { tournaments, loading, refresh, createTournament, updateTournament, deleteTournament }
}
