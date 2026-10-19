import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Trash2, Check, Pencil, UserPlus } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { teamRoster } from '@/lib/roster'
import { loadShootingParticipants, saveShootingParticipants } from '@/lib/shootingParticipants'
import { positionColor } from '@/lib/positionStyle'
import { Jersey } from '@/components/fun/Jersey'
import { CourtLines } from '@/components/fun/CourtLines'
import { Glow } from '@/components/fun/Glow'
import { GameSetupSheet, PlayerToggleList } from '@/components/fun/GameSetupSheet'
import { ShootingRing } from '@/components/fun/ShootingRing'
import { useGames } from '@/hooks/useGames'
import { useShootingEntries } from '@/hooks/useShootingEntries'
import { formatDate } from '@/lib/format'
import { formatPct } from '@/lib/stats'
import { ZONES, ZONE_ORDER, classifyShotZone, aggregateHotZonesFromTallies, isThreePointZone } from '@/lib/hotZones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CourtDiagram } from '@/components/CourtDiagram'
import { HotZoneChart } from '@/components/HotZoneChart'
import { cn } from '@/lib/utils'
import {
  Dialog,
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

function ZoneEntryDialog({ zone, existing, onClose, onConfirm }) {
  const [attempts, setAttempts] = useState('')
  const [makes, setMakes] = useState('')
  const [error, setError] = useState('')

  // このダイアログはゾーンをタップするたびに開閉されるだけでアンマウントされないため、
  // 開くたびに前回入力した値をクリアしないと、誤って前の数値に上書き入力してしまう
  useEffect(() => {
    if (zone) {
      setAttempts('')
      setMakes('')
      setError('')
    }
  }, [zone])

  if (!zone) return null

  function handleConfirm() {
    const a = Number(attempts) || 0
    const m = Number(makes) || 0
    if (a <= 0) {
      setError('試投数を入力してください')
      return
    }
    if (m > a) {
      setError('成功数は試投数以下にしてください')
      return
    }
    onConfirm(a, m)
  }

  return (
    <Dialog open={!!zone} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ZONES[zone].label}</DialogTitle>
          <DialogDescription>
            現在: {existing.makes}/{existing.attempts}本
            {existing.attempts > 0 && ` (${formatPct(existing.pct)})`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zone-attempts">試投数</Label>
            <Input
              id="zone-attempts"
              type="number"
              inputMode="numeric"
              min="0"
              autoFocus
              value={attempts}
              onChange={(e) => setAttempts(e.target.value)}
              placeholder="例: 10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zone-makes">成功数</Label>
            <Input
              id="zone-makes"
              type="number"
              inputMode="numeric"
              min="0"
              value={makes}
              onChange={(e) => setMakes(e.target.value)}
              placeholder="例: 6"
            />
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
          <Button type="button" onClick={handleConfirm}>
            追加する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ShootingDetail({ teamId }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { players: allPlayers } = usePlayers(teamId)
  // シューティングはチームの選手だけが対象。過去の試合のゲストは選手一覧に出さない
  const players = useMemo(() => teamRoster(allPlayers), [allPlayers])
  const { games, updateGame, deleteGame } = useGames(teamId, 'shooting')
  const { entries, addTally, resetZone } = useShootingEntries(id)
  // シューティング追加時に選手を選んでいれば、その選手だけをこの画面に表示し、1人目を
  // 最初から選択済みにしておく(追加直後にもう一度選手を選び直す手間を省く)。
  // location.stateはマウント直後にuseActiveShareToken(App.jsx)がURLへ?t=を付与するための
  // replaceナビゲーションで失われてしまうため、マウント時に一度だけstateで捕まえておく
  // stateが無い(一覧から開き直した等)場合は、作成時にこの端末へ保存した参加メンバーを使う
  const [participantIds] = useState(() => location.state?.playerIds ?? loadShootingParticipants(id))
  const [selectedPlayerId, setSelectedPlayerId] = useState(() => participantIds?.[0] ?? null)
  const [pendingZone, setPendingZone] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false)
  const [completeError, setCompleteError] = useState('')
  // 完了済み(status='final')のセッションは、意図せずタップして下書きに戻ってしまわないよう
  // デフォルトで読み取り専用にし、「記録を修正する」を押した時だけ編集可能にする
  const [isEditing, setIsEditing] = useState(false)

  // この画面に表示する選手の集合。「追加時に選んだ選手」と「実際に記録(shooting_entries)が
  // ある選手」を合わせて初期化した後は、新しく記録が付いた選手を追加するだけで
  // 一度加えた選手を取り除くことはない。記録を全て削除しても対象の選手が
  // 選手一覧から消えてしまわないようにするための措置(記録の削除は「この選手の記録」の
  // ゴミ箱アイコンから行う想定で、これが唯一の訂正手段のため、選手ごと消えると
  // 選び直しすらできなくなってしまう)
  const [visiblePlayerIds, setVisiblePlayerIds] = useState(
    () => new Set([...(participantIds ?? []), ...entries.map((e) => e.player_id)])
  )
  useEffect(() => {
    setVisiblePlayerIds((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const e of entries) {
        if (!next.has(e.player_id)) {
          next.add(e.player_id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [entries])
  // 参加メンバーだけを表示する(チーム全員に戻すことはしない)。メンバーを増やすときは「選手を追加」から
  const visiblePlayers = useMemo(() => players.filter((p) => visiblePlayerIds.has(p.id)), [players, visiblePlayerIds])
  useEffect(() => {
    if (visiblePlayerIds.size > 0) saveShootingParticipants(id, [...visiblePlayerIds])
  }, [id, visiblePlayerIds])
  const [addOpen, setAddOpen] = useState(false)
  const [addSelection, setAddSelection] = useState([])
  const addCandidates = useMemo(() => players.filter((p) => !visiblePlayerIds.has(p.id)), [players, visiblePlayerIds])

  function handleAddOpenChange(next) {
    if (next) setAddSelection([])
    setAddOpen(next)
  }

  function handleAddPlayers(e) {
    e.preventDefault()
    if (addSelection.length === 0) return
    setVisiblePlayerIds((prev) => new Set([...prev, ...addSelection]))
    if (!selectedPlayerId) setSelectedPlayerId(addSelection[0])
    setAddOpen(false)
  }

  const session = games.find((g) => g.id === id)

  const playerEntries = useMemo(
    () => entries.filter((e) => e.player_id === selectedPlayerId),
    [entries, selectedPlayerId]
  )
  const playerHotZones = useMemo(() => aggregateHotZonesFromTallies(playerEntries), [playerEntries])
  // 成功率(2P%/3P%)・ホットゾーンの表示対象は、PLAYERSで選んだ選手と同じ。
  // PLAYERSで「全体」を選ぶ(=記録する選手が未選択)と全員分を表示する
  const statsPlayerId = selectedPlayerId ?? 'all'
  const statsEntries = useMemo(
    () => (statsPlayerId === 'all' ? entries : entries.filter((e) => e.player_id === statsPlayerId)),
    [entries, statsPlayerId]
  )
  const statsHotZones = useMemo(() => aggregateHotZonesFromTallies(statsEntries), [statsEntries])
  // 2P% / 3P%(ゾーンの区分で2Pと3Pに分ける。TEAMタブと同じリング表示)
  const shootingSplits = useMemo(() => {
    const sum = { two: { made: 0, att: 0 }, three: { made: 0, att: 0 } }
    for (const e of statsEntries) {
      const bucket = isThreePointZone(e.zone) ? sum.three : sum.two
      bucket.made += e.makes
      bucket.att += e.attempts
    }
    return [
      { key: '2p', label: '2P%', ...sum.two },
      { key: '3p', label: '3P%', ...sum.three },
    ].map((s) => ({ ...s, pct: s.att > 0 ? (s.made / s.att) * 100 : null, invalid: s.made > s.att }))
  }, [statsEntries])

  const playerTotals = playerEntries.reduce(
    (acc, e) => ({ attempts: acc.attempts + e.attempts, makes: acc.makes + e.makes }),
    { attempts: 0, makes: 0 }
  )

  if (!session) {
    return <p className="text-sm text-muted-foreground py-8 text-center">読み込み中...</p>
  }

  // 完了済みで、まだ「記録を修正する」を押していない間は読み取り専用にする
  const readOnly = session.status === 'final' && !isEditing

  function handleCourtTap({ x, y }) {
    if (!selectedPlayerId || readOnly) return
    setPendingZone(classifyShotZone(x, y))
  }

  // 完了済み(status='final')のセッションに手を加えた場合、「ワークアウトを完了する」を
  // もう一度押すまで個人のPRACTICE記録に反映されないよう、編集を始めた時点で下書き状態に戻す
  async function ensureDraft() {
    if (session.status !== 'final') return
    try {
      await updateGame(session.id, { status: 'scheduled' })
    } catch (err) {
      console.error('ワークアウトの状態更新に失敗しました', err)
    }
  }

  // 完了済みセッションをタップしただけで意図せず下書きに戻ってしまわないよう、
  // 「記録を修正する」を押した時だけ明示的に編集モードへ入る
  async function handleStartEditing() {
    await ensureDraft()
    setIsEditing(true)
  }

  async function handleConfirmZone(attempts, makes) {
    await addTally(selectedPlayerId, pendingZone, attempts, makes)
    setPendingZone(null)
  }

  async function handleResetZone(zone) {
    await resetZone(selectedPlayerId, zone)
  }

  async function handleConfirmDelete() {
    await deleteGame(session.id)
    navigate('/practice')
  }

  async function handleCompleteWorkout() {
    if (entries.length === 0) return
    setCompleteError('')
    try {
      await updateGame(session.id, { status: 'final' })
    } catch (err) {
      console.error('ワークアウトの完了処理に失敗しました', err)
      setCompleteError('完了処理に失敗しました。もう一度お試しください。')
      return
    }
    setIsEditing(false)
    setShowCompleteAnimation(true)
    // ポップアップのアニメーションを少し見せてから遷移する
    setTimeout(() => {
      navigate('/practice', { state: { flashMessage: 'ワークアウトの内容を記録しました。' } })
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate('/practice')} className="flex min-h-9 items-center gap-1 self-start text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        PRACTICE一覧
      </button>

      <section className="relative overflow-hidden rounded-3xl bg-secondary p-4 text-secondary-foreground shadow-lg">
        <CourtLines className="text-white/[0.07]" />
        <Glow className="-right-16 -top-20 size-52" opacity={0.4} />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-heading text-[10px] tracking-[0.25em] text-chart-3">SHOOTING</p>
            <p className="truncate text-xl font-bold leading-tight">{session.opponent_name || 'シューティング'}</p>
            <p className="text-[11px] text-white/60">{formatDate(session.game_date)}</p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 font-heading text-[11px] tracking-wider',
              session.status === 'final' ? 'bg-white/15 text-white' : 'bg-chart-3 text-secondary'
            )}
          >
            {session.status === 'final' ? '完了' : '下書き'}
          </span>
        </div>
        <div className="relative mt-3 flex flex-col gap-2 rounded-2xl bg-white/[0.08] p-2.5">
          <p className="truncate text-center text-xs font-bold text-white/80">
            {statsPlayerId === 'all' ? '全体' : (visiblePlayers.find((p) => p.id === statsPlayerId)?.name ?? '全体')}
            <span className="ml-1 font-normal text-white/50">(PLAYERSで切り替え)</span>
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {shootingSplits.map((split) => (
              <ShootingRing key={split.key} split={split} onDark />
            ))}
          </div>
        </div>
        {session.status !== 'final' && (
          <p className="relative mt-2 text-[11px] text-white/60">「ワークアウトを完了する」を押すまで、個人のPRACTICE記録には反映されません</p>
        )}
        <div className="relative mt-3">
          {readOnly ? (
            <Button className="h-11 w-full rounded-xl bg-white/10 text-white hover:bg-white/20" onClick={handleStartEditing}>
              <Pencil className="size-4" />
              記録を修正する
            </Button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Button className="h-12 w-full rounded-xl font-heading text-base tracking-wider" disabled={entries.length === 0} onClick={handleCompleteWorkout}>
                <Check className="size-4" />
                ワークアウトを完了する
              </Button>
              {entries.length === 0 && <p className="text-center text-xs text-white/60">まだ記録がありません</p>}
              {completeError && <p className="text-center text-xs text-[oklch(0.75_0.17_25)]">{completeError}</p>}
            </div>
          )}
        </div>
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>このシューティング記録をすべて削除します。元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>削除する</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCompleteAnimation}>
        <DialogContent showCloseButton={false} className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 animate-check-pop">
            <Check className="size-8" strokeWidth={3} />
          </div>
          <p className="font-medium">ワークアウトを記録しました</p>
        </DialogContent>
      </Dialog>

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg leading-none tracking-wide">PLAYERS</h2>
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleAddOpenChange(true)}
              className="press flex min-h-10 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm font-bold text-muted-foreground hover:bg-muted"
            >
              <UserPlus className="size-4" />
              選手を追加
            </button>
          )}
        </div>
        {visiblePlayers.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {readOnly ? '記録のある選手はいません' : '「選手を追加」からシューティングを行う選手を選んでください'}
          </p>
        ) : (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1" data-no-pull-refresh>
            {/* 全体: 全員分の成功率・ホットゾーンを表示する(記録はしない) */}
            <button
              onClick={() => setSelectedPlayerId(null)}
              aria-pressed={!selectedPlayerId}
              className={cn(
                'press flex min-h-11 shrink-0 select-none items-center rounded-full border px-4 text-sm font-bold transition-colors',
                !selectedPlayerId ? 'border-secondary bg-secondary text-secondary-foreground ring-2 ring-chart-3' : 'bg-background hover:bg-muted'
              )}
            >
              全体
            </button>
            {visiblePlayers.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id)}
                aria-pressed={selectedPlayerId === p.id}
                className={cn(
                  'press flex min-h-11 max-w-[11rem] shrink-0 select-none items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm font-bold transition-colors',
                  selectedPlayerId === p.id ? 'border-secondary bg-secondary text-secondary-foreground ring-2 ring-chart-3' : 'bg-background hover:bg-muted'
                )}
              >
                <Jersey number={p.number} color={positionColor(p.position)} className="size-8 shrink-0" />
                <span className="min-w-0 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        <p className={cn('text-center text-xs', selectedPlayerId && !readOnly ? 'font-bold text-primary' : 'text-muted-foreground')}>
          {readOnly
            ? '内容を修正するには「記録を修正する」を押してください'
            : selectedPlayerId
              ? 'コートをタップしてゾーンを選び、試投数・成功数をまとめて記録します'
              : '記録するには選手を選んでください(全体では記録できません)'}
        </p>
        <CourtDiagram active={!!selectedPlayerId && !readOnly} onTap={handleCourtTap} />
      </section>

      <ZoneEntryDialog
        zone={pendingZone}
        existing={pendingZone ? playerHotZones[pendingZone] : { attempts: 0, makes: 0, pct: null }}
        onClose={() => setPendingZone(null)}
        onConfirm={handleConfirmZone}
      />

      <GameSetupSheet
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        eyebrow="ADD PLAYERS"
        title="選手を追加"
        description="このシューティングに参加する選手を追加します"
        onSubmit={handleAddPlayers}
        submitLabel={addSelection.length > 0 ? `${addSelection.length}人を追加する` : '選手を選んでください'}
        savingLabel="追加中..."
        saving={false}
        submitDisabled={addSelection.length === 0}
      >
        {addCandidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">追加できる選手はいません</p>
        ) : (
          <PlayerToggleList
            players={addCandidates}
            selectedIds={addSelection}
            onToggle={(pid) => setAddSelection((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]))}
            renderJersey={(p) => <Jersey number={p.number} color={positionColor(p.position)} className="size-8 shrink-0" />}
          />
        )}
      </GameSetupSheet>

      {selectedPlayerId && (
        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-3 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-heading text-lg leading-none tracking-wide">ZONES</h2>
            {playerTotals.attempts > 0 && (
              <span className="font-heading text-sm tabular-nums text-muted-foreground">
                {playerTotals.makes}/{playerTotals.attempts}
              </span>
            )}
          </div>
          {playerEntries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">まだ記録がありません</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {ZONE_ORDER.filter((key) => playerHotZones[key].attempts > 0).map((key) => (
                <li key={key} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-bold">{ZONES[key].label}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-muted-foreground">
                      {playerHotZones[key].makes}/{playerHotZones[key].attempts}
                      <span className="ml-1 font-heading text-foreground">{formatPct(playerHotZones[key].pct)}</span>
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => handleResetZone(key)}
                        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="リセット"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-3xl border bg-card p-3 shadow-sm">
        <h2 className="font-heading text-lg leading-none tracking-wide">HOT ZONES</h2>
        <p className="text-xs text-muted-foreground">
          {statsPlayerId === 'all' ? '全体' : (visiblePlayers.find((p) => p.id === statsPlayerId)?.name ?? '全体')}
          (PLAYERSで切り替え)
        </p>
        <HotZoneChart hotZones={statsHotZones} />
      </section>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        このシューティングを削除
      </button>
    </div>
  )
}
