import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { cn } from '@/lib/utils'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'

// 旧フラグ(agreedToTermsAndPrivacyAt)からキー名を変更し、チェックボックス必須の
// より厳密な同意フローに変わったことを機に、既存利用者にも再同意を求める。
const CONSENT_STORAGE_KEY = 'termsAndPrivacyConsent'

function hasCurrentConsent() {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return parsed.termsVersion === TERMS_VERSION && parsed.privacyVersion === PRIVACY_VERSION
  } catch {
    return false
  }
}

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
  // 初回アクセス時のみ、利用規約・プライバシーポリシーへの同意ポップアップを表示する
  const [showConsent, setShowConsent] = useState(() => !hasCurrentConsent())
  const [agreeChecked, setAgreeChecked] = useState(false)
  const [viewedTerms, setViewedTerms] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('viewedTermsVersion') === TERMS_VERSION
  )
  const [viewedPrivacy, setViewedPrivacy] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('viewedPrivacyVersion') === PRIVACY_VERSION
  )
  const canAgree = viewedTerms && viewedPrivacy

  async function handleAgree() {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, agreedAt: new Date().toISOString() })
    )
    setShowConsent(false)
    // 端末のlocalStorageが消えても後から確認できるよう、サーバー側にも同意記録を残す
    // (失敗しても同意自体はローカルに記録済みなので、利用をブロックしない)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.id) {
        await supabase.from('user_consents').insert({
          user_id: userData.user.id,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        })
      }
    } catch (err) {
      console.error('同意記録のサーバー保存に失敗しました(端末には記録済みです)', err)
    }
  }

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
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-primary/8 blur-3xl" aria-hidden />

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
              CREATE TEAM
            </Button>
            <Button
              type="button"
              variant={mode === 'join' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('join')}
            >
              JOIN TEAM
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
                  placeholder="ここにチーム名を入力"
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

      <AlertDialog open={showConsent}>
        <AlertDialogContent className="gap-5 p-6 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">利用規約・プライバシーポリシーへの同意</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              本サービスのご利用には、以下2つの内容をご確認のうえ、同意していただく必要があります。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-2">
            <Link
              to="/terms"
              className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {viewedTerms ? (
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0" />
                )}
                利用規約を確認する
              </span>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </Link>
            <Link
              to="/privacy-policy"
              className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {viewedPrivacy ? (
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0" />
                )}
                プライバシーポリシーを確認する
              </span>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </Link>
          </div>

          <label
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed transition-opacity',
              !canAgree && 'opacity-50'
            )}
          >
            <Checkbox
              checked={agreeChecked}
              onCheckedChange={(checked) => setAgreeChecked(checked === true)}
              disabled={!canAgree}
              className="mt-0.5"
            />
            私は利用規約およびプライバシーポリシーの内容を確認し、同意します。
          </label>

          <AlertDialogFooter>
            <Button onClick={handleAgree} disabled={!agreeChecked} className="w-full">
              同意して利用を開始する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
