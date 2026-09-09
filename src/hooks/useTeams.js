import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/supabaseClient'

const ACTIVE_TEAM_KEY = 'activeTeamId'

// ログイン中のユーザーが所属している「すべて」のチームを取得し、
// そのうち今画面に表示する「アクティブなチーム」を管理する。
// 1端末が複数チームに所属できるため、単一チームではなく一覧+選択方式にしている。
export function useTeams(session) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTeamId, setActiveTeamId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_TEAM_KEY) : null
  )

  // 依存はsession全体ではなくuser.idにする。Supabaseは約1時間おきにアクセストークンを
  // 自動更新し、そのたびにonAuthStateChangeで別オブジェクトのsessionが渡ってくる
  // (ユーザー自体は変わっていない)。session全体を依存にしていると、そのたびにここが
  // 再実行されloading=trueになり、App.jsxの全画面ローディング判定を通じて試合画面
  // (GameDetail)ごとアンマウントされ、試合中のタイマー等がリセットされる不具合があった
  const refresh = useCallback(async () => {
    if (!session?.user) {
      // セッション確立前の状態。ここでloadingをfalseにすると、セッションが
      // 確立した直後の再レンダリングで一瞬「チーム0件」と誤認され、
      // App側の判定が意図せず/onboardingや/gamesへ飛んでしまうバグになるため、
      // ロード中のまま(loading=true)にしておく。
      setTeams([])
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('team_members')
      .select('id, joined_at, teams(id, name, icon_url)')
      .eq('user_id', session.user.id)
      .order('joined_at')

    if (error) {
      console.error('チーム一覧の取得に失敗しました', error)
      setTeams([])
    } else {
      setTeams(
        (data ?? [])
          .filter((row) => row.teams)
          .map((row) => ({
            ...row.teams,
            myMembershipId: row.id,
          }))
      )
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!session?.user) return
    const channel = supabase
      .channel(`team-members-${session.user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `user_id=eq.${session.user.id}` },
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, refresh])

  const activeTeam = useMemo(() => {
    if (teams.length === 0) return null
    return teams.find((t) => t.id === activeTeamId) ?? teams[0]
  }, [teams, activeTeamId])

  function switchTeam(teamId) {
    localStorage.setItem(ACTIVE_TEAM_KEY, teamId)
    setActiveTeamId(teamId)
  }

  return { teams, activeTeam, loading, refresh, switchTeam }
}
