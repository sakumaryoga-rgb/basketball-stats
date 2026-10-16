import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BarChart3, Check, ChevronLeft, ChevronRight, CheckCircle2, Circle, Dumbbell, Plus, Trophy, UserPlus } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { cn } from '@/lib/utils'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal'
import { saveShareUrl, getAllShareUrls } from '@/lib/shareUrlStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Basketball } from '@/components/fun/Basketball'
import { CourtLines } from '@/components/fun/CourtLines'
import { ShareLinkPanel } from '@/components/fun/ShareLinkPanel'
import { TeamPickerList } from '@/components/fun/TeamPickerList'
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

// 共有URL全体が貼られた場合はトークン部分だけを取り出し、トークンそのものが貼られた場合は
// そのまま使う(どちらでも参加できるようにする)
function extractShareToken(input) {
  const trimmed = input.trim()
  const match = trimmed.match(/\/t\/([^/?#]+)/)
  return match ? match[1] : trimmed
}

// 共有URLが無効だった場合、この端末が過去に一度でも作成/参加したことのあるチーム
// (=localStorageに共有URLを保存済みのチーム)の名前として一致するか確認する。
// 現在所属しているチームへはJOIN TEAMの「参加済みのチーム」から切り替えられるが、こちらは
// 退出済みのチームへ名前だけで戻るための手段として残している。一度もアクセスしたことのないチームを名前だけで
// 探し当てることはできない(=総当たりでの不正参加は防げる)。team_membersの現在の所属状況は
// 見ないため、退出済みのチームでも(この端末が正規の共有URLを踏んだことがある限り)名前で戻れる。
function findRememberedTokenByName(name) {
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) return null
  const match = getAllShareUrls().find((entry) => entry.name && entry.name.trim().toLowerCase() === trimmed)
  return match ? extractShareToken(match.shareUrl) : null
}

const FEATURES = [
  { icon: Trophy, title: 'GAMES', text: '試合をその場で記録' },
  { icon: Dumbbell, title: 'PRACTICE', text: '練習・シュートも' },
  { icon: BarChart3, title: 'STATS', text: '成績を自動で集計' },
]

const MODES = [
  { key: 'create', icon: Plus, title: '新しいチームを作る', sub: 'はじめて使うチーム' },
  { key: 'join', icon: UserPlus, title: 'チームに参加する', sub: '招待リンクをもらった' },
]

// teams/activeTeamId/onSwitchTeamはApp.jsx(useTeams=匿名ユーザーのteam_members)から渡される。
// JOIN TEAMでは、既に所属しているチームを「参加し直さずに切り替える」選択肢として先に出す
export function Onboarding({ onTeamJoined, hasTeam, teams = [], activeTeamId, onSwitchTeam }) {
  const { token: tokenFromPath } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isDeliberateAdd = searchParams.get('add') === '1'
  // /t/:token 経由に加えて、アクティブチームが未確立の間に ?t= 付きでこの画面へ
  // リダイレクトされてきた場合(App側のuseActiveShareToken/キャッチオールで発生)にも対応する
  const token = tokenFromPath || searchParams.get('t')

  const [mode, setMode] = useState('create')
  const [teamName, setTeamName] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 共有URLを踏んだ場合は確認なしで自動的に参加させる(手動操作でのつまずきをなくす)
  const [autoJoining, setAutoJoining] = useState(!!token)
  // チーム作成直後だけ、発行された共有URLを一度きり表示するための状態
  const [pendingShareReveal, setPendingShareReveal] = useState(null)
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

  async function finishJoin(teamId) {
    await onTeamJoined(teamId)
    navigate('/games', { replace: true })
  }

  // 共有URL(/t/:token、または ?t= 付きでこの画面に来た場合)を踏んだら自動でチームに参加する
  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      const { data, error: rpcError } = await supabase.rpc('redeem_share_token', { p_token: token })
      const result = Array.isArray(data) ? data[0] : data
      if (cancelled) return
      if (rpcError || !result?.success) {
        setError(result?.message || rpcError?.message || 'このリンクは無効です')
        setAutoJoining(false)
        return
      }
      saveShareUrl(result.out_team_id, `${window.location.origin}/t/${token}`, result.out_team_name)
      await finishJoin(result.out_team_id)
    })()
    return () => {
      cancelled = true
    }
    // 初回マウント時のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('create_team', { team_name: teamName.trim() })
    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const team = Array.isArray(data) ? data[0] : data
    const shareUrl = `${window.location.origin}/t/${team.share_token}`
    saveShareUrl(team.id, shareUrl, team.name)
    setPendingShareReveal({
      teamId: team.id,
      teamName: team.name,
      shareUrl,
    })
  }

  // この端末が以前参加したことのあるチーム(localStorageに共有URLの控えがあるチーム)のうち、
  // 現在は所属していない(team_membersに無い)もの。現在所属しているチームは上の「参加済みのチーム」に
  // team_members由来で出すため、ここからは除く。タップすると控えてある共有URLで参加し直す
  const memberTeamIds = new Set(teams.map((t) => t.id))
  const rememberedTeams = getAllShareUrls()
    .filter((entry) => entry.shareUrl && entry.name && !memberTeamIds.has(entry.teamId))
    .map((entry) => ({ id: entry.teamId, name: entry.name, icon_url: null, shareUrl: entry.shareUrl }))

  async function handleRejoinRemembered(teamId) {
    const entry = rememberedTeams.find((t) => t.id === teamId)
    if (!entry) return
    setSaving(true)
    setError('')
    const rememberedToken = extractShareToken(entry.shareUrl)
    const { data, error: rpcError } = await supabase.rpc('redeem_share_token', { p_token: rememberedToken })
    const result = Array.isArray(data) ? data[0] : data
    setSaving(false)
    if (rpcError || !result?.success) {
      setError(
        rpcError?.message ||
          `「${entry.name}」の招待リンクは再発行されたため使えなくなっています。メンバーから新しい招待リンクをもらってください。`
      )
      return
    }
    saveShareUrl(result.out_team_id, `${window.location.origin}/t/${rememberedToken}`, result.out_team_name)
    await finishJoin(result.out_team_id)
  }

  async function handleJoin(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    let token = extractShareToken(joinInput)
    let { data, error: rpcError } = await supabase.rpc('redeem_share_token', { p_token: token })
    let result = Array.isArray(data) ? data[0] : data
    if (rpcError || !result?.success) {
      // URL/トークンとして無効だった場合、この端末が過去にアクセスしたことのあるチーム名としての
      // 入力かどうかを確認し、覚えている共有URLのトークンで参加をやり直す
      const rememberedToken = findRememberedTokenByName(joinInput)
      if (rememberedToken) {
        token = rememberedToken
        ;({ data, error: rpcError } = await supabase.rpc('redeem_share_token', { p_token: token }))
        result = Array.isArray(data) ? data[0] : data
      }
    }
    setSaving(false)
    if (rpcError || !result?.success) {
      // result.messageはredeem_share_tokenが返す「このリンクは無効です」という
      // URL前提の文言のため、チーム名を入力した場合にも表示されると誤解を招く。
      // 入力がURL/トークン/チーム名のいずれであっても通用する文言にする。
      setError(rpcError?.message || '共有URLまたはチーム名が正しくありません。入力内容をご確認ください。')
      return
    }
    saveShareUrl(result.out_team_id, `${window.location.origin}/t/${token}`, result.out_team_name)
    await finishJoin(result.out_team_id)
  }

  // 共有URLも「別のチームを追加」の意図もなく、既にチームを持った状態で
  // ここに来た場合は、読み込みタイミングのズレによる意図しない遷移とみなして
  // 試合一覧に戻す(そうしないとチームのデータが見えなくなってしまう)
  useEffect(() => {
    if (hasTeam && !token && !isDeliberateAdd) {
      navigate('/games', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTeam])

  if (autoJoining || (hasTeam && !token && !isDeliberateAdd)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2" style={{ minHeight: 'var(--app-height, 100svh)' }}>
        <div className="flex h-16 flex-col items-center justify-end">
          <Basketball className="size-10 animate-ball-bounce" />
          <div className="mt-1 h-1.5 w-9 rounded-full bg-foreground/30 blur-[1px] animate-ball-shadow" />
        </div>
        {autoJoining && <p className="text-sm font-medium text-muted-foreground">チームに参加しています…</p>}
      </div>
    )
  }

  return (
    <div className="overscroll-none relative flex flex-col bg-background" style={{ minHeight: 'var(--app-height, 100svh)' }}>
      {/* ヒーロー: GAMES/TEAMのヒーローカードと同じ紺+コートラインの表現 */}
      <div className="relative overflow-hidden rounded-b-[2rem] bg-secondary px-4 pb-8 pt-[calc(1rem+env(safe-area-inset-top))] text-secondary-foreground shadow-md">
        <CourtLines className="text-white/10" />
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/35 blur-3xl" />
        <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3 pt-2">
          {hasTeam && (
            <button
              onClick={() => navigate(-1)}
              className="flex min-h-10 items-center gap-1 self-start rounded-lg pr-2 text-sm opacity-80 hover:opacity-100"
            >
              <ChevronLeft className="size-4" />
              戻る
            </button>
          )}
          <div className="flex h-24 flex-col items-center justify-end">
            <Basketball className="size-14 animate-ball-bounce drop-shadow-lg" />
            <div className="mt-1 h-2 w-12 rounded-full bg-black/40 blur-[2px] animate-ball-shadow" />
          </div>
          <div className="text-center">
            <p className="font-heading text-4xl leading-none tracking-wide">
              BASKETBALL <span className="text-primary">STATS</span>
            </p>
            <p className="mt-2 text-sm opacity-80">チームのスタッツを、みんなで記録しよう</p>
          </div>
          {!hasTeam && !pendingShareReveal && (
            <ul className="mt-2 grid w-full grid-cols-3 gap-2">
              {FEATURES.map(({ icon: Icon, title, text }, i) => (
                <li
                  key={title}
                  className="animate-rise-in flex flex-col items-center gap-1 rounded-xl bg-white/8 px-1 py-2.5 text-center"
                  style={{ '--i': i + 1 }}
                >
                  <Icon className="size-4 text-chart-3" />
                  <span className="font-heading text-[11px] tracking-wider">{title}</span>
                  <span className="text-[10px] leading-tight opacity-75">{text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="relative mx-auto -mt-4 flex w-full max-w-sm flex-1 flex-col gap-4 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {pendingShareReveal ? (
          <div className="flex flex-col gap-4 animate-rise-in">
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-400 text-lime-950 animate-check-pop">
                <Check className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-[10px] tracking-[0.2em] text-primary">TEAM CREATED</p>
                <p className="break-words text-lg font-bold leading-snug">「{pendingShareReveal.teamName}」ができました!</p>
              </div>
            </div>
            <ShareLinkPanel url={pendingShareReveal.shareUrl} teamName={pendingShareReveal.teamName} />
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              このリンクはあとからTEAMタブでも確認できます(この端末のみ)。念のため、メンバーへ送るかメモしておいてください。
            </p>
            <Button className="h-12 text-base font-bold" onClick={() => finishJoin(pendingShareReveal.teamId)}>
              保存しました。はじめる
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 animate-rise-in">
              {MODES.map(({ key, icon: Icon, title, sub }) => {
                const active = mode === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMode(key)
                      setError('')
                    }}
                    aria-pressed={active}
                    className={cn(
                      'press flex flex-col items-start gap-2 rounded-2xl border bg-card p-3 text-left shadow-xs transition-colors',
                      active ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-muted/40'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 items-center justify-center rounded-xl transition-colors',
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold leading-snug">{title}</span>
                      <span className="block text-[11px] text-muted-foreground">{sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div key={mode} className="rounded-2xl border bg-card p-4 shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-200">
              {mode === 'create' ? (
                <form onSubmit={handleCreate} className="flex flex-col gap-3">
                  <div>
                    <p className="font-heading text-[10px] tracking-[0.2em] text-primary">CREATE TEAM</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      作成すると、メンバーを招待するリンクが発行されます
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="team-name">チーム名</Label>
                    <Input
                      id="team-name"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="ここにチーム名を入力"
                      className="h-11"
                    />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" disabled={saving} className="h-11 font-bold">
                    {saving ? '作成中...' : 'チームを作成'}
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  {teams.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="font-heading text-[10px] tracking-[0.2em] text-primary">MY TEAMS</p>
                        <p className="text-sm font-bold">参加済みのチーム</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          この端末で参加しているチームです。タップするとそのチームを表示します(参加し直す必要はありません)
                        </p>
                      </div>
                      {/* 既に所属済みのチームは参加処理を行わず、表示するチームを切り替えるだけ(URLの共有トークンも外す) */}
                      <TeamPickerList teams={teams} activeTeamId={activeTeamId} onSelect={(teamId) => onSwitchTeam(teamId, '/games')} />
                    </div>
                  )}
                  {rememberedTeams.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="font-heading text-[10px] tracking-[0.2em] text-primary">REMEMBERED</p>
                        <p className="text-sm font-bold">以前この端末で参加したチーム</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          この端末に招待リンクが残っているチームです。タップするともう一度参加します
                        </p>
                      </div>
                      <TeamPickerList
                        teams={rememberedTeams}
                        onSelect={handleRejoinRemembered}
                        subLabel={saving ? '参加中...' : 'タップで参加し直す'}
                        disabled={saving}
                      />
                    </div>
                  )}
                  {(teams.length > 0 || rememberedTeams.length > 0) && (
                    <div className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      または
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                <form onSubmit={handleJoin} className="flex flex-col gap-3">
                  <div>
                    <p className="font-heading text-[10px] tracking-[0.2em] text-primary">JOIN TEAM</p>
                    {(teams.length > 0 || rememberedTeams.length > 0) && <p className="text-sm font-bold">新しいチームに参加</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      招待リンクを開くと自動で参加できます。うまくいかない場合はここに貼り付けてください
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="join-input">共有URL または 参加済みのチーム名</Label>
                    <Input
                      id="join-input"
                      required
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      placeholder="共有URLを貼り付け、または参加済みのチーム名を入力"
                      className="h-11"
                    />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" disabled={saving} className="h-11 font-bold">
                    {saving ? '参加中...' : 'チームに参加'}
                  </Button>
                </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
