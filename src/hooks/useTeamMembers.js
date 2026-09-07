import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// チームメンバー(端末)一覧。役割(role)・端末区分(device_category)・
// 一時的な記録権限(recording_granted_until)をチーム管理画面で表示・操作するために使う。
// team_membersはplayers(選手ロスター)とは別物で、コーチ・マネージャー・ベンチ端末なども含む。
export function useTeamMembers(teamId) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setMembers([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('team_members')
      .select('id, user_id, role, device_category, recording_granted_until, joined_at')
      .eq('team_id', teamId)
      .order('joined_at')
    if (error) {
      console.error('メンバー一覧の取得に失敗しました', error)
      setMembers([])
    } else {
      setMembers(data ?? [])
    }
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`team-members-admin-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `team_id=eq.${teamId}` },
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  return { members, loading, refresh }
}
