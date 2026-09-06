import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

export function usePlayers(teamId) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setPlayers([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order')
      .order('number')

    if (error) console.error('選手一覧の取得に失敗しました', error)
    setPlayers(data ?? [])
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`players-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  async function addPlayer({ name, number, position, heightCm, weightKg, photoUrl }) {
    const { data, error } = await supabase
      .from('players')
      .insert({
        team_id: teamId,
        name,
        number: number || null,
        position: position || null,
        height_cm: heightCm || null,
        weight_kg: weightKg || null,
        photo_url: photoUrl || null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function updatePlayer(id, patch) {
    const { error } = await supabase.from('players').update(patch).eq('id', id)
    if (error) throw error
  }

  async function removePlayer(id) {
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) {
      console.error('選手の削除に失敗しました', error)
      refresh()
    }
  }

  return { players, loading, refresh, addPlayer, updatePlayer, removePlayer }
}
