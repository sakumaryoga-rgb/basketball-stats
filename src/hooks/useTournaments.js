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

  async function createTournament({ name }) {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({ team_id: teamId, name })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function deleteTournament(id) {
    const { error } = await supabase.from('tournaments').delete().eq('id', id)
    if (error) throw error
  }

  return { tournaments, loading, refresh, createTournament, deleteTournament }
}
