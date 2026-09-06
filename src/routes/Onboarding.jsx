import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

function BasketballIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.6 5.6c1.9 1.9 2.9 4.1 2.9 6.4s-1 4.5-2.9 6.4M18.4 5.6c-1.9 1.9-2.9 4.1-2.9 6.4s1 4.5 2.9 6.4" />
    </svg>
  )
}

export function Onboarding({ onTeamJoined, hasTeam }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const codeFromUrl = searchParams.get('code')
  const codeFromStorage = typeof window !== 'undefined' ? localStorage.getItem('pendingInviteCode') : null
  const initialCode = (codeFromUrl || codeFromStorage || '').toUpperCase()
  const isDeliberateAdd = searchParams.get('add') === '1'

  const [mode, setMode] = useState(initialCode ? 'join' : 'create')
  const [teamName, setTeamName] = useState('')
  const [joinCode, setJoinCode] = useState(initialCode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 招待リンクを踏んだ場合は確認なしで自動的に参加させる(手動操作でのつまずきをなくす)
  const [autoJoining, setAutoJoining] = useState(!!initialCode)

  useEffect(() => {
    if (initialCode) {
      localStorage.removeItem('pendingInviteCode')
    }
    // 初回マウント時のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!initialCode) return
    let cancelled = false
    performJoin(initialCode).then((ok) => {
      if (!cancelled && !ok) setAutoJoining(false)
    })
    return () => {
      cancelled = true
    }
    // 初回マウント時のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function performJoin(code) {
    const { data, error: rpcError } = await supabase.rpc('join_team', { join_code: code })
    if (rpcError) {
      setError(rpcError.message)
      return false
    }
    await onTeamJoined(data.id)
    navigate('/games', { replace: true })
    return true
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('create_team', { team_name: teamName })
    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onTeamJoined(data.id)
    navigate('/games', { replace: true })
  }

  async function handleJoin(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const ok = await performJoin(joinCode)
    setSaving(false)
    if (!ok) return
  }

  // 招待コードも「別のチームを追加」の意図もなく、既にチームを持った状態で
  // ここに来た場合は、読み込みタイミングのズレによる意図しない遷移とみなして
  // 試合一覧に戻す(そうしないとチームのデータが見えなくなってしまう)
  useEffect(() => {
    if (hasTeam && !initialCode && !isDeliberateAdd) {
      navigate('/games', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTeam])

  if (autoJoining || (hasTeam && !initialCode && !isDeliberateAdd)) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-svh relative flex flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-secondary/40 blur-3xl" aria-hidden />

      <div className="relative flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <BasketballIcon className="size-9" />
        </div>
        <div className="text-center">
          <p className="font-heading text-4xl tracking-wide text-primary">BASKETBALL STATS</p>
          <p className="text-sm text-muted-foreground mt-1">バスケスタッツ</p>
        </div>
      </div>

      <Card className="relative w-full max-w-sm">
        <CardHeader>
          {hasTeam && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-sm text-muted-foreground -mt-1 mb-1 self-start"
            >
              <ChevronLeft className="size-4" />
              戻る
            </button>
          )}
          <CardTitle>チームを作成 / 参加</CardTitle>
          <CardDescription>スタッツを共有するチームを設定します</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'create' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('create')}
            >
              新しく作成
            </Button>
            <Button
              type="button"
              variant={mode === 'join' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('join')}
            >
              招待コードで参加
            </Button>
          </div>

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="team-name">チーム名</Label>
                <Input
                  id="team-name"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="例: 〇〇バスケットボールクラブ"
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? '作成中...' : 'チームを作成'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="join-code">招待コード</Label>
                <Input
                  id="join-code"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="例: ABCD1234"
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? '参加中...' : 'チームに参加'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
