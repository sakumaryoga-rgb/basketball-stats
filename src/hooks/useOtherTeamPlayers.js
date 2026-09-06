import { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 自分が所属する「他のチーム」の選手一覧を取得する。
// 既に登録済みの選手をコピーして別チームのロスターに追加する機能で使う。
export function useOtherTeamPlayers(teams, excludeTeamId) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  const otherTeamIds = teams.filter((t) => t.id !== excludeTeamId).map((t) => t.id)
  const key = otherTeamIds.slice().sort().join(',')

  useEffect(() => {
    if (otherTeamIds.length === 0) {
      setPlayers([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('players')
      .select('*, teams(name)')
      .in('team_id', otherTeamIds)
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('他チームの選手一覧の取得に失敗しました', error)
        setPlayers(data ?? [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { players, loading }
}
