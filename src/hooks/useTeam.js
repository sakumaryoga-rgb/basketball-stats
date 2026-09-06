import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// ログイン中のユーザーが所属しているチーム情報を取得する
export function useTeam(session) {
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setTeam(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name, invite_code)')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (error) {
      console.error('チーム情報の取得に失敗しました', error)
      setTeam(null)
    } else {
      setTeam(data?.teams ?? null)
    }
    setLoading(false)
  }, [session])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { team, loading, refresh }
}
