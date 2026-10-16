import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, ChevronDown, LogOut, Pencil, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useTeamSeasonStats } from '@/hooks/useTeamSeasonStats'
import { useTeamPeriodStats } from '@/hooks/useTeamPeriodStats'
import { useShotChart } from '@/hooks/useShotChart'
import { uploadTeamIcon } from '@/lib/uploadTeamIcon'
import { getShareUrl, saveShareUrl } from '@/lib/shareUrlStore'
import { formatAvg, formatPct, perGame, shootingSplits } from '@/lib/stats'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HotZoneSection } from '@/components/HotZoneSection'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/fun/PageHeader'
import { CourtLines } from '@/components/fun/CourtLines'
import { WinRing } from '@/components/fun/WinRing'
import { ShareLinkPanel } from '@/components/fun/ShareLinkPanel'
import { TeamSwitcherSheet } from '@/components/fun/TeamSwitcherSheet'

function EditTeamDialog({ team, onTeamUpdated, children }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(team.name)
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState(team.icon_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleOpenChange(next) {
    if (next) {
      setName(team.name)
      setIconFile(null)
      setIconPreview(team.icon_url ?? '')
      setError('')
    }
    setOpen(next)
  }

  function handleIconChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setIconFile(file)
    setIconPreview(URL.createObjectURL(file))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let iconUrl = team.icon_url ?? null
      if (iconFile) {
        iconUrl = await uploadTeamIcon(team.id, iconFile)
      }
      const { error: updateError } = await supabase
        .from('teams')
        .update({ name, icon_url: iconUrl })
        .eq('id', team.id)
      if (updateError) throw updateError
      await onTeamUpdated()
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTeam() {
    setDeleting(true)
    // 削除によりactiveTeamが一時的にnullになる前に、まずURLから共有URLのトークンを外しておく。
    // そうしないと、キャッチオールのリダイレクトがトークン付きのまま/onboardingへ遷移させてしまい、
    // (このチーム自体は消えているため実害はないが)不要な「このリンクは無効です」表示が出てしまう。
    navigate('/onboarding?add=1', { replace: true })
    const { error: deleteError } = await supabase.from('teams').delete().eq('id', team.id)
    setDeleting(false)
    if (deleteError) {
      console.error('チームの削除に失敗しました', deleteError)
      return
    }
    setConfirmDelete(false)
    setOpen(false)
    await onTeamUpdated()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>チームプロフィールを編集</DialogTitle>
          <DialogDescription>チーム名とアイコンを更新します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarImage src={iconPreview} alt={name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {name?.[0] ?? 'B'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="team-icon">アイコン</Label>
              <Input id="team-icon" type="file" accept="image/*" onChange={handleIconChange} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-name-edit">チーム名</Label>
            <Input id="team-name-edit" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存する'}
            </Button>
          </DialogFooter>
        </form>
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              // 編集ダイアログを開いたまま削除確認を重ねて表示すると、双方の
              // 「キャンセル」ボタンが透けて重なって見えてしまうため、先に閉じてから表示する
              setOpen(false)
              setConfirmDelete(true)
            }}
          >
            <Trash2 className="size-4" />
            このチームを削除する
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{team.name}」を削除します。選手・試合・スタッツの記録もすべて削除され、元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleDeleteTeam}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

// 共有URLの平文はDBにはハッシュしか保存されないため、サーバーからは取得できない。
// ただし、この端末が過去に作成/参加時に使ったURLはlocalStorageに控えているため、それがあれば
// そのまま表示する(shareUrlStore参照)。別端末で作成された等の理由で控えがない場合のみ、
// 再発行して新しいURLを発行する導線を案内する。発行・検証のロジック自体は従来から変えていない
function ShareUrlSection({ team, onTeamUpdated }) {
  const [knownShareUrl, setKnownShareUrl] = useState(() => getShareUrl(team.id))
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')

  async function handleRegenerate() {
    setRegenerating(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('regenerate_share_token', { p_team_id: team.id })
    setRegenerating(false)
    setConfirmRegenerate(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const shareUrl = `${window.location.origin}/t/${data}`
    saveShareUrl(team.id, shareUrl, team.name)
    setKnownShareUrl(shareUrl)
    onTeamUpdated()
  }

  const regenerateButton = (
    <button
      type="button"
      onClick={() => setConfirmRegenerate(true)}
      className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/60"
    >
      <RefreshCw className="size-3.5" />
      リンクを再発行する(古いリンクは使えなくなります)
    </button>
  )

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>INVITE</SectionLabel>
      {knownShareUrl ? (
        <ShareLinkPanel
          url={knownShareUrl}
          teamName={team.name}
          footer={
            <>
              {error && <p className="text-destructive text-sm">{error}</p>}
              {regenerateButton}
            </>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <p className="text-sm font-bold">招待リンクがこの端末に見つかりません</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            別の端末でチームを作成した場合などは、この端末にリンクの控えがありません。リンクを紛失した場合や、
            これまで共有した相手からのアクセスを止めたい場合は再発行してください(既にこのチームに入っている
            メンバーはそのまま使えます)。
          </p>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="button" className="h-11" onClick={() => setConfirmRegenerate(true)}>
            <RefreshCw className="size-4" />
            招待リンクを発行する
          </Button>
        </div>
      )}

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>共有URLを再発行しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              新しいURLが発行され、以前のURLはこの時点で使えなくなります(既にこのチームに入っているメンバーは
              引き続き使えます)。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button disabled={regenerating} onClick={handleRegenerate}>
              {regenerating ? '発行中...' : '再発行する'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <h2 className="font-heading text-xs tracking-[0.2em] text-muted-foreground">{children}</h2>
      <span className="h-px flex-1 bg-border" />
      {right}
    </div>
  )
}

function StatTile({ label, value, index = 0 }) {
  return (
    <div className="animate-rise-in flex flex-col items-center gap-1 rounded-xl bg-muted/60 py-2.5" style={{ '--i': index }}>
      <p className="font-heading text-2xl leading-none tabular-nums">{value}</p>
      <p className="font-heading text-[10px] tracking-widest text-muted-foreground">{label}</p>
    </div>
  )
}

// split.pctは0〜100の百分率(stats.jsのshootingSplits)。リングには0〜1の割合で渡す
function ShootingRing({ split }) {
  const { label, made, att, pct: value, invalid } = split
  return (
    <div className="flex flex-col items-center gap-1">
      <WinRing
        value={invalid || value == null ? 0 : value / 100}
        size={64}
        stroke={6}
        color="var(--primary)"
        track="var(--foreground)"
      >
        <span className="font-heading text-base tabular-nums">
          {invalid ? '!' : value == null ? '-' : value.toFixed(1)}
          {!invalid && value != null && <span className="text-[8px]">%</span>}
        </span>
      </WinRing>
      <span className="font-heading text-[11px] tracking-widest">{label}</span>
      <span className={cn('text-[10px] tabular-nums', invalid ? 'font-bold text-destructive' : 'text-muted-foreground')}>
        {invalid ? `要確認 ${made}/${att}` : `${made}/${att}`}
      </span>
    </div>
  )
}

function SegmentToggle({ value, onChange }) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5">
      {[
        { key: '2q', label: '2Q制' },
        { key: '4q', label: '4Q制' },
      ].map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'min-h-9 rounded-md px-3.5 text-[11px] font-bold transition-colors',
            value === o.key ? 'bg-secondary text-secondary-foreground shadow' : 'text-muted-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TeamSettings({ team, teams = [], onTeamUpdated, onSwitchTeam }) {
  const navigate = useNavigate()
  const { players: allPlayers } = usePlayers(team.id)
  const players = allPlayers.filter((p) => !p.guest_game_id)
  const { games } = useGames(team.id)
  const { totals } = useTeamSeasonStats(team.id)
  const { stats: periodStats } = useTeamPeriodStats(team.id)
  const { shots } = useShotChart(team.id)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  // 既存の記録の大半が2Q制のため、デフォルトは2Q制で表示する
  const [periodMode, setPeriodMode] = useState('2q')

  const gamesPlayed = games.filter((g) => g.status !== 'scheduled').length
  const periodBucket = periodStats[periodMode]
  const otherTeams = teams.filter((t) => t.id !== team.id)

  // シュート成功率は全公式戦(2Q制・4Q制の合算、スクリメージ/シューティングは含まない)の
  // player_season_statsの成功数・試投数から計算する。1試合平均の2Q/4Q切り替えとは連動しない
  const shooting = useMemo(() => shootingSplits(totals), [totals])
  useEffect(() => {
    const bad = shooting?.filter((s) => s.invalid)
    if (bad?.length) console.error('チームのシュート集計に不整合があります(成功数>試投数など)', team.id, bad)
  }, [shooting, team.id])

  // 「チーム1試合平均」だけは大会の2Q制/4Q制で切り替えられるようにするため、
  // 全公式戦合算のシュート成功率・シーズン合計とは別に、選択中の制度の試合だけで平均を出す
  const periodAverages = useMemo(() => {
    const g = periodBucket.gamesPlayed
    const t = periodBucket.totals
    return {
      pts: perGame(t.pts, g),
      reb: perGame(t.reb, g),
      ast: perGame(t.ast, g),
      stl: perGame(t.stl, g),
      blk: perGame(t.blk, g),
      tov: perGame(t.tov, g),
    }
  }, [periodBucket])

  function handleSwitch(teamId) {
    setSwitcherOpen(false)
    if (teamId !== team.id) onSwitchTeam(teamId)
  }

  // 共有URLを知っている人は誰でも参加・記録できる方式のため、退出に管理者判定はない。
  // 自分のteam_members行を削除するだけのシンプルな操作(DB側の処理は従来どおり)。
  async function handleLeaveTeam() {
    setLeaving(true)
    const leavingTeamId = team.id
    if (otherTeams.length > 0) {
      // 他にも所属チームがある場合は、先に残っているチームへ切り替えてから退出する。
      // onSwitchTeamはURLに残っている退出元チームの共有トークンも外すため、
      // 退出後に旧トークンで自動再参加してしまうことはない
      onSwitchTeam(otherTeams[0].id, '/games')
    } else {
      // 最後の1チームから退出する場合は従来どおり。activeTeamが一時的にnullになる前に、
      // まずURLから共有URLのトークンを外してオンボーディングへ遷移しておく。退出後にトークン付きの
      // URLが残っていると、キャッチオールのリダイレクトがそのトークンを引き継いだまま/onboardingへ
      // 遷移させ、Onboarding側の自動参加処理がこの端末を即座に再参加させてしまうため
      navigate('/onboarding?add=1', { replace: true })
    }
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', leavingTeamId)
      .eq('user_id', userData?.user?.id)
    setLeaving(false)
    if (error) {
      console.error('チームの退出に失敗しました', error)
      return
    }
    setConfirmLeave(false)
    await onTeamUpdated()
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="TEAM" eyebrow="CLUBHOUSE" />

      {/* チームのプロフィールと、所属チームの切り替え */}
      <div className="relative overflow-hidden rounded-2xl bg-secondary p-4 text-secondary-foreground shadow-md animate-rise-in">
        <CourtLines className="text-white/10" />
        <div className="absolute -left-8 -bottom-10 size-32 rounded-full bg-primary/30 blur-2xl" />
        <div className="relative flex items-center gap-3.5">
          <Avatar className="size-16 shrink-0 ring-4 ring-white/15 after:hidden">
            <AvatarImage src={team.icon_url} alt={team.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-heading">
              {team.name?.[0] ?? 'B'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-[10px] tracking-[0.2em] opacity-70">MY TEAM</p>
            <p className="truncate text-xl font-bold leading-tight">{team.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/12 px-2 py-0.5 font-heading text-[10px] tracking-wider">
                {players.length} PLAYERS
              </span>
              <span className="rounded-full bg-white/12 px-2 py-0.5 font-heading text-[10px] tracking-wider">
                {gamesPlayed} GAMES
              </span>
            </div>
          </div>
          <EditTeamDialog team={team} onTeamUpdated={onTeamUpdated}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="チームプロフィールを編集"
              className="size-11 shrink-0 self-start rounded-full bg-white/10 text-secondary-foreground hover:bg-white/20 hover:text-secondary-foreground"
            >
              <Pencil className="size-4" />
            </Button>
          </EditTeamDialog>
        </div>

        {otherTeams.length > 0 ? (
          <button
            type="button"
            onClick={() => setSwitcherOpen(true)}
            className="press relative mt-4 flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-white/10 px-3 text-left hover:bg-white/15"
          >
            <ArrowLeftRight className="size-4 shrink-0" />
            <span className="flex-1 text-sm font-bold">チームを切り替える</span>
            <span className="flex -space-x-1.5">
              {otherTeams.slice(0, 3).map((t) => (
                <Avatar key={t.id} className="size-6 ring-2 ring-secondary after:hidden">
                  <AvatarImage src={t.icon_url} alt="" />
                  <AvatarFallback className="bg-white/20 text-[10px] font-bold text-secondary-foreground">{t.name?.[0]}</AvatarFallback>
                </Avatar>
              ))}
            </span>
            <span className="text-[11px] opacity-70">所属 {teams.length}</span>
          </button>
        ) : (
          <Link
            to="/onboarding?add=1"
            className="relative mt-3 flex min-h-10 items-center justify-center gap-1 rounded-xl text-xs font-medium opacity-75 hover:bg-white/10 hover:opacity-100"
          >
            <Plus className="size-3.5" />
            別のチームを作成・参加する
          </Link>
        )}
      </div>

      {totals && (
        <>
          <section className="flex flex-col gap-2">
            <SectionLabel right={<SegmentToggle value={periodMode} onChange={setPeriodMode} />}>PER GAME</SectionLabel>
            <div className="rounded-2xl border bg-card p-3">
              <p className="mb-2 px-1 text-[11px] text-muted-foreground">
                チーム1試合平均({periodMode === '2q' ? '2Q制' : '4Q制'}の公式戦 {periodBucket.gamesPlayed}試合)
              </p>
              <div key={periodMode} className="grid grid-cols-3 gap-2">
                <StatTile label="PPG" value={formatAvg(periodAverages.pts)} index={0} />
                <StatTile label="RPG" value={formatAvg(periodAverages.reb)} index={1} />
                <StatTile label="APG" value={formatAvg(periodAverages.ast)} index={2} />
                <StatTile label="SPG" value={formatAvg(periodAverages.stl)} index={3} />
                <StatTile label="BPG" value={formatAvg(periodAverages.blk)} index={4} />
                <StatTile label="TOPG" value={formatAvg(periodAverages.tov)} index={5} />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <SectionLabel>SHOOTING</SectionLabel>
            <div className="rounded-2xl border bg-card p-3">
              <p className="mb-2 px-1 text-[11px] text-muted-foreground">全公式戦のシュート成功率(成功数/試投数)</p>
              <div className="grid grid-cols-4 gap-1">
                {shooting.map((split) => (
                  <ShootingRing key={split.key} split={split} />
                ))}
              </div>
            </div>
            <p className="sr-only">
              {shooting.map((s) => `${s.label} ${s.invalid ? '要確認' : formatPct(s.pct)}`).join('、')}
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <SectionLabel>SEASON TOTALS</SectionLabel>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-3">
              <p className="col-span-3 px-1 text-[11px] text-muted-foreground">全公式戦の合計(2Q制・4Q制の合算)</p>
              <StatTile label="PTS" value={totals.pts} />
              <StatTile label="REB" value={totals.reb} index={1} />
              <StatTile label="AST" value={totals.ast} index={2} />
              <StatTile label="STL" value={totals.stl} index={3} />
              <StatTile label="BLK" value={totals.blk} index={4} />
              <StatTile label="TO" value={totals.tov} index={5} />
            </div>
          </section>
        </>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>HOT ZONES</SectionLabel>
        <div className="[&>div]:rounded-2xl [&>div]:bg-card">
          <HotZoneSection shots={shots} />
        </div>
      </section>

      <ShareUrlSection key={team.id} team={team} onTeamUpdated={onTeamUpdated} />

      {/* 退出は誤タップを避けるため、切り替えとは離れた最下部に折りたたんで置く */}
      <section className="mt-2 rounded-2xl border border-destructive/25">
        <button
          type="button"
          onClick={() => setDangerOpen((o) => !o)}
          aria-expanded={dangerOpen}
          className="flex min-h-12 w-full items-center gap-2 px-4 text-left"
        >
          <TriangleAlert className="size-4 text-destructive" />
          <span className="flex-1 font-heading text-xs tracking-[0.2em] text-destructive">DANGER ZONE</span>
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-300', dangerOpen && 'rotate-180')} />
        </button>
        <div className={cn('grid transition-[grid-template-rows] duration-300', dangerOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 px-4 pb-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                退出すると、この端末は「{team.name}」の記録を見られなくなります。もう一度参加するには招待リンクが必要です。
                {otherTeams.length > 0
                  ? `退出後は「${otherTeams[0].name}」の表示に切り替わります。表示するチームを変えたいだけなら、上の「チームを切り替える」を使ってください。`
                  : 'ほかに所属しているチームはないため、退出後はチームの作成・参加画面に移ります。'}
              </p>
              <Button
                variant="outline"
                className="h-11 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setConfirmLeave(true)}
              >
                <LogOut className="size-4" />
                このチームから退出する
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TeamSwitcherSheet
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        teams={teams}
        activeTeamId={team.id}
        onSwitch={handleSwitch}
      />

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に退出しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{team.name}」から退出します。チーム自体や他のメンバー・所属している他のチームには影響しません。
              {otherTeams.length > 0 && `退出後は「${otherTeams[0].name}」に切り替わります。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" disabled={leaving} onClick={handleLeaveTeam}>
              {leaving ? '退出中...' : '退出する'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
