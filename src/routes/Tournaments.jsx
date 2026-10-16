import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Flame, Plus, Snowflake, Trash2, Trophy } from 'lucide-react'
import { useTournaments } from '@/hooks/useTournaments'
import { useGames } from '@/hooks/useGames'
import { useTeamScoresByGame } from '@/hooks/useTeamScoresByGame'
import { summarizeRecord, streakLabel } from '@/lib/record'
import { PageHeader } from '@/components/fun/PageHeader'
import { EmptyState } from '@/components/fun/EmptyState'
import { CourtLines } from '@/components/fun/CourtLines'
import { WinRing } from '@/components/fun/WinRing'
import { ResultDots } from '@/components/fun/ResultDots'
import { DateTile } from '@/components/fun/DateTile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// シーズン通算の成績を電光掲示板風にまとめたヒーローカード
// 勝敗・勝率は2Q制/4Q制の合算のまま。大会数・平均得点・平均失点だけをperiodSystemで切り替える
function SeasonHero({ record, tournamentCount, avgFor, avgAgainst, periodSystem, onPeriodSystemChange }) {
  const label = streakLabel(record.streak)
  return (
    <div className="relative overflow-hidden rounded-2xl bg-secondary p-4 text-secondary-foreground shadow-md animate-rise-in">
      <CourtLines className="text-white/10" />
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/30 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <WinRing value={record.winRate} size={80} stroke={7} track="white">
          <span className="font-heading text-2xl tabular-nums">
            {record.winRate == null ? '-' : Math.round(record.winRate * 100)}
            <span className="text-xs">%</span>
          </span>
          <span className="mt-0.5 font-heading text-[9px] tracking-widest opacity-70">WIN</span>
        </WinRing>
        <div className="flex-1 min-w-0">
          <p className="font-heading text-[10px] tracking-[0.2em] opacity-70">SEASON RECORD</p>
          <p className="font-heading text-4xl leading-none tabular-nums mt-1">
            {record.wins}
            <span className="mx-1 opacity-40">-</span>
            {record.losses}
            {record.ties > 0 && (
              <>
                <span className="mx-1 opacity-40">-</span>
                {record.ties}
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {record.form.length > 0 ? (
              <ResultDots results={record.form} size="xs" />
            ) : (
              <span className="text-xs opacity-70">最初の試合を記録しよう!</span>
            )}
            {label && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  record.streak.type === 'W' ? 'bg-chart-3 text-[oklch(0.28_0.08_75)]' : 'bg-white/15'
                }`}
              >
                {record.streak.type === 'W' ? <Flame className="size-3" /> : <Snowflake className="size-3" />}
                {label}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-2">
        <span className="font-heading text-[10px] tracking-[0.2em] opacity-70">
          {periodSystem === '2q' ? '2Q制' : '4Q制'}の大会・試合
        </span>
        <div className="flex rounded-lg bg-white/10 p-0.5">
          {[
            { key: '2q', label: '2Q制' },
            { key: '4q', label: '4Q制' },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onPeriodSystemChange(o.key)}
              aria-pressed={periodSystem === o.key}
              className={`min-h-8 rounded-md px-3 text-[11px] font-bold transition-colors ${
                periodSystem === o.key ? 'bg-white text-secondary shadow' : 'text-secondary-foreground/70'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-2 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/5 py-2 text-center">
        {[
          { label: 'TOURNAMENTS', value: tournamentCount },
          { label: 'AVG PTS', value: avgFor ?? '-' },
          { label: 'AVG OPP', value: avgAgainst ?? '-' },
        ].map((s) => (
          <div key={s.label}>
            <p className="font-heading text-xl leading-none tabular-nums">{s.value}</p>
            <p className="mt-1 font-heading text-[9px] tracking-widest opacity-60">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// GAMEタブは大会単位の一覧。大会を作成し、その中で複数の試合を追加していく
// (過去の記録を大会単位で参照しやすくするため)。日程・会場は大会作成時に入力し、
// 大会内で試合を追加するたびに同じ内容を入力する手間を省く
export function Tournaments({ teamId }) {
  const { tournaments, createTournament, deleteTournament } = useTournaments(teamId)
  // シーズン成績・大会ごとの勝敗を出すため、大会に属する公式戦をまとめて取得する
  const { games: officialGames } = useGames(teamId, 'official')
  const scoresByGameId = useTeamScoresByGame(officialGames.map((g) => g.id))

  const seasonRecord = useMemo(() => summarizeRecord(officialGames, scoresByGameId), [officialGames, scoresByGameId])
  const recordByTournament = useMemo(() => {
    const groups = new Map()
    for (const g of officialGames) {
      if (!g.tournament_id) continue
      const list = groups.get(g.tournament_id) ?? []
      list.push(g)
      groups.set(g.tournament_id, list)
    }
    const map = {}
    for (const [id, list] of groups) map[id] = { ...summarizeRecord(list, scoresByGameId), total: list.length }
    return map
  }, [officialGames, scoresByGameId])
  // 既存の記録の大半が2Q制のため、デフォルトは2Q制(LEADERS/TEAMと同じ)
  const [heroPeriodSystem, setHeroPeriodSystem] = useState('2q')
  const heroTournamentCount = tournaments.filter((t) => t.period_system === heroPeriodSystem).length
  const { avgFor, avgAgainst } = useMemo(() => {
    const finals = officialGames.filter((g) => g.status === 'final' && g.period_system === heroPeriodSystem)
    if (finals.length === 0) return { avgFor: null, avgAgainst: null }
    const sumFor = finals.reduce((acc, g) => acc + (scoresByGameId[g.id] ?? 0), 0)
    const sumAgainst = finals.reduce((acc, g) => acc + (g.opponent_score ?? 0), 0)
    return { avgFor: (sumFor / finals.length).toFixed(1), avgAgainst: (sumAgainst / finals.length).toFixed(1) }
  }, [officialGames, scoresByGameId, heroPeriodSystem])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [gameDate, setGameDate] = useState(todayStr())
  const [location, setLocation] = useState('')
  // 既存の試合の大半が2Q制のため、作成フォームのデフォルトも2Q制にしておく
  const [periodSystem, setPeriodSystem] = useState('2q')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createTournament({ name, gameDate, location, periodSystem })
      setName('')
      setGameDate(todayStr())
      setLocation('')
      setPeriodSystem('2q')
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await deleteTournament(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="GAMES" eyebrow="GAME DAY">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            大会を作成
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>大会を作成</DialogTitle>
              <DialogDescription>大会の中に複数の試合を追加できます</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tournament-name">大会名</Label>
                <Input
                  id="tournament-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 〇〇カップ"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tournament-date">日程</Label>
                  <Input id="tournament-date" type="date" required value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tournament-location">会場</Label>
                  <Input id="tournament-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="任意" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>クォーター制</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={periodSystem === '2q' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setPeriodSystem('2q')}
                  >
                    2Q制(前半・後半)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={periodSystem === '4q' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setPeriodSystem('4q')}
                  >
                    4Q制(1〜4Q)
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">作成後は変更できません</p>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? '作成中...' : '作成する'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <SeasonHero
        record={seasonRecord}
        tournamentCount={heroTournamentCount}
        avgFor={avgFor}
        avgAgainst={avgAgainst}
        periodSystem={heroPeriodSystem}
        onPeriodSystemChange={setHeroPeriodSystem}
      />

      {tournaments.length === 0 ? (
        <EmptyState title="まだ大会が登録されていません" description="「大会を作成」から最初の大会を登録しましょう" />
      ) : (
        <ul className="flex flex-col gap-2">
          <li className="font-heading text-xs tracking-[0.2em] text-muted-foreground px-1">TOURNAMENTS</li>
          {tournaments.map((t, i) => {
            const rec = recordByTournament[t.id]
            const perfect = rec && rec.played >= 2 && rec.losses === 0 && rec.ties === 0
            return (
            <li key={t.id} className="flex items-center gap-1">
              <Link
                to={`/games/t/${t.id}`}
                className="press animate-rise-in flex flex-1 min-w-0 items-center gap-3 rounded-xl border bg-card p-2.5 shadow-xs hover:shadow-md"
                style={{ '--i': i }}
              >
                <DateTile date={t.game_date} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate flex items-center gap-1">
                    {perfect && <Trophy className="size-3.5 shrink-0 text-chart-3" />}
                    <span className="truncate">{t.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.location ? `${t.location} ・ ` : ''}
                    {t.period_system === '2q' ? '2Q制' : '4Q制'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 min-h-4">
                    {rec?.live && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 font-heading text-[9px] tracking-wider leading-none text-primary-foreground">
                        <span className="size-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {rec && rec.played > 0 ? (
                      <>
                        <ResultDots results={[...rec.form]} size="xs" />
                        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                          {rec.wins}勝{rec.losses}敗{rec.ties > 0 ? `${rec.ties}分` : ''}
                        </span>
                      </>
                    ) : (
                      !rec?.live && (
                        <span className="text-[11px] text-muted-foreground">
                          {rec?.total ? `${rec.total}試合 予定` : '試合未登録'}
                        </span>
                      )
                    )}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="大会を削除"
                onClick={() => setDeleteTarget(t)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
            )
          })}
        </ul>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」とその中の試合・スタッツをすべて削除します。元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>削除する</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
