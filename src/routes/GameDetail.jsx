import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Undo2, ChevronLeft, Minus, Plus, Play, Pause, UserPlus, Check, Repeat, FileText, Flag, Pencil, Trash2, X } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useGameStats } from '@/hooks/useGameStats'
import { useGameLineups } from '@/hooks/useGameLineups'
import { useOpponentScoreEvents } from '@/hooks/useOpponentScoreEvents'
import { STAT_CATEGORIES, STAT_KEY_LABEL, quarterOptions, formatClock, formatQuarter } from '@/lib/stats'
import { snapToZoneCategory } from '@/lib/hotZones'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BoxScoreTable } from '@/components/BoxScoreTable'
import { CourtDiagram } from '@/components/CourtDiagram'
import { GameLogPanel } from '@/components/GameLogPanel'
import { WheelPicker } from '@/components/WheelPicker'
import { Switch } from '@/components/ui/switch'
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
import { gameParticipants, isGuest } from '@/lib/roster'
import { positionColor } from '@/lib/positionStyle'
import { Jersey } from '@/components/fun/Jersey'
import { GuestTag, GUEST_COLOR } from '@/components/fun/GuestTag'
import { CourtLines } from '@/components/fun/CourtLines'
import { Glow } from '@/components/fun/Glow'

function playerColor(p) {
  return isGuest(p) ? GUEST_COLOR : positionColor(p.position)
}

// スタッツの種類ボタンに大きく出す略称(下に日本語の名称を小さく添える)
const CATEGORY_SHORT = { fg2: '2P', fg3: '3P', ft: 'FT', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', tov: 'TO', pf: 'FOUL' }

function AddGuestDialog({ addPlayer, gameId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const guest = await addPlayer({ name, number: number ? Number(number) : null, guestGameId: gameId })
      setName('')
      setNumber('')
      setOpen(false)
      onAdded?.(guest)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError('') }}>
      <DialogTrigger
        render={
          <button className="press flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm font-bold text-muted-foreground hover:bg-muted" />
        }
      >
        <UserPlus className="size-3.5" />
        ゲストを追加
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ゲストを追加</DialogTitle>
          <DialogDescription>この試合だけ参加する選手です。ロスターやシーズン成績には反映されません</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-name">名前</Label>
            <Input id="guest-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田太郎" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-number">背番号</Label>
            <Input id="guest-number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="任意" />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? '追加中...' : '追加する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const MINUTES = Array.from({ length: 21 }, (_, i) => i)
const SECONDS = Array.from({ length: 60 }, (_, i) => i)

function TimePickerDialog({ open, onOpenChange, secondsLeft, onApply }) {
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const openCountRef = useRef(0)

  // openがtrueになった瞬間の secondsLeft でホイールの位置を初期化する。
  // ダイアログを開くのが親からの直接のprop変更(onOpenChange経由ではない)でも
  // 確実に効くようにopenを監視し、WheelPickerをkeyで強制的に作り直すことで
  // 前回開いたときのスクロール位置が残ってしまう問題を避ける。
  useLayoutEffect(() => {
    if (open) {
      openCountRef.current += 1
      setMinutes(Math.floor(secondsLeft / 60))
      setSeconds(secondsLeft % 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleApply() {
    onApply(minutes * 60 + seconds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>タイマーを設定</DialogTitle>
          <DialogDescription>スライドして時間を調整します</DialogDescription>
        </DialogHeader>
        <div className="relative flex items-center justify-center gap-3 py-2">
          <WheelPicker key={`m-${openCountRef.current}`} values={MINUTES} value={minutes} onChange={setMinutes} />
          <span className="text-xl font-bold text-muted-foreground">:</span>
          <WheelPicker key={`s-${openCountRef.current}`} values={SECONDS} value={seconds} onChange={setSeconds} />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 h-9 rounded-md border-y bg-muted/30" />
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
          <Button type="button" onClick={handleApply}>
            設定する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssistDialog({ pending, players, onSelect, onSkip }) {
  const candidates = pending ? players.filter((p) => p.id !== pending.shooterId) : []
  return (
    <Dialog open={!!pending} onOpenChange={(next) => !next && onSkip()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>アシストした選手を選択</DialogTitle>
          <DialogDescription>コートに出ている選手から選んでください</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">他に出場中の選手がいません</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="press flex min-h-12 min-w-0 items-center gap-2 rounded-xl border bg-background px-2 text-left hover:bg-muted"
              >
                <Jersey number={p.number} color={playerColor(p)} className="size-8 shrink-0" />
                <span className="min-w-0 truncate text-sm font-bold">{p.name}</span>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onSkip}>
            アシストなし
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_LABEL = { scheduled: '予定', in_progress: '試合中', final: '終了' }
const HOT_ZONE_ENABLED_KEY = 'hotZoneEnabled'

const EMPTY_STATS = {
  pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
  fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, plus_minus: 0,
}

export function GameDetail({ teamId }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players, addPlayer } = usePlayers(teamId)
  const { games, updateGame, deleteGame, refresh: refreshGames } = useGames(teamId)
  const game = games.find((g) => g.id === id)
  const { events, boxScore, recordStat, undoLast, editStat, deleteStat } = useGameStats(id, game?.game_type)
  const { lineups, substitute, incrementSeconds } = useGameLineups(id)
  const { events: opponentEvents, recordOpponentStat, undoLastOpponentStat } = useOpponentScoreEvents(id)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeCategoryKey, setActiveCategoryKey] = useState('fg2')
  const [pendingOutcome, setPendingOutcome] = useState(null)
  // 2P/3Pが成功した直後に表示する「アシストした選手」選択ダイアログの対象
  const [pendingAssist, setPendingAssist] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(600)
  const [clockRunning, setClockRunning] = useState(false)
  const [statsTab, setStatsTab] = useState('basic')
  const [shotChartPlayerId, setShotChartPlayerId] = useState('all')
  const [hotZoneEnabled, setHotZoneEnabled] = useState(
    () => localStorage.getItem(HOT_ZONE_ENABLED_KEY) !== 'false'
  )
  const [recordedFlash, setRecordedFlash] = useState(null)
  const flashTimerRef = useRef(null)
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [substitutionTarget, setSubstitutionTarget] = useState(null)
  const [substituting, setSubstituting] = useState(false)
  const pendingSecondsRef = useRef(0)
  const longPressTimerRef = useRef(null)
  const longPressFiredRef = useRef(false)
  // 長押しで交代ダイアログを開いてから少しの間は、交代先のタップを受け付けない。
  // 指を離した瞬間のタップが、開いたばかりのダイアログの選手ボタンに当たって
  // 意図しない交代になるのを防ぐ
  const substitutionReadyRef = useRef(true)
  const substitutionReadyTimerRef = useRef(null)

  const activeCategory = STAT_CATEGORIES.find((c) => c.key === activeCategoryKey)

  // この試合のロスター: 通常の選手全員 + この試合限定のゲスト(他の試合のゲストは含めない)
  const gamePlayers = useMemo(() => gameParticipants(players, game?.id), [players, game])

  function showRecordedFlash(playerId, statKey) {
    const playerName = gamePlayers.find((p) => p.id === playerId)?.name ?? '?'
    clearTimeout(flashTimerRef.current)
    setRecordedFlash(`${playerName}: ${STAT_KEY_LABEL[statKey]} を記録しました`)
    flashTimerRef.current = setTimeout(() => setRecordedFlash(null), 1600)
  }

  useEffect(() => () => clearTimeout(flashTimerRef.current), [])
  useEffect(() => () => clearTimeout(longPressTimerRef.current), [])
  useEffect(() => () => clearTimeout(substitutionReadyTimerRef.current), [])

  useEffect(() => {
    if (!clockRunning) return
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        // 0に到達したら自動停止し、これ以上出場時間を加算しない。念のため
        // 既に0の状態でtickが来た場合も同様に扱う(二重にsetClockRunning(false)を
        // 呼んでも副作用は無い)。
        if (s <= 0) {
          setClockRunning(false)
          return 0
        }
        const next = Math.max(0, s - 1)
        pendingSecondsRef.current += 1
        // 出場時間の書き込み回数を抑えるため、5秒分たまってからまとめて反映する
        if (pendingSecondsRef.current >= 5) {
          const delta = pendingSecondsRef.current
          pendingSecondsRef.current = 0
          incrementSeconds(delta)
        }
        if (next === 0) {
          setClockRunning(false)
        }
        return next
      })
    }, 1000)
    return () => {
      clearInterval(timer)
      if (pendingSecondsRef.current > 0) {
        const delta = pendingSecondsRef.current
        pendingSecondsRef.current = 0
        incrementSeconds(delta)
      }
    }
  }, [clockRunning, incrementSeconds])

  const onCourtIds = useMemo(() => new Set(lineups.filter((l) => l.on_court).map((l) => l.player_id)), [lineups])
  const lineupByPlayer = useMemo(() => new Map(lineups.map((l) => [l.player_id, l])), [lineups])
  const starters = useMemo(() => gamePlayers.filter((p) => onCourtIds.has(p.id)), [gamePlayers, onCourtIds])
  const reserves = useMemo(() => gamePlayers.filter((p) => !onCourtIds.has(p.id)), [gamePlayers, onCourtIds])

  const boxByPlayer = useMemo(() => {
    const map = new Map()
    for (const row of boxScore) map.set(row.player_id, row)
    return map
  }, [boxScore])

  const rows = useMemo(() => {
    return gamePlayers
      .filter((p) => boxByPlayer.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        isGuest: isGuest(p),
        ...EMPTY_STATS,
        ...boxByPlayer.get(p.id),
        seconds_played: lineupByPlayer.get(p.id)?.seconds_played ?? 0,
      }))
      .sort((a, b) => b.pts - a.pts)
  }, [gamePlayers, boxByPlayer, lineupByPlayer])

  const teamScore = rows.reduce((sum, r) => sum + r.pts, 0)

  const playerPtsById = useMemo(() => {
    const map = new Map()
    for (const row of rows) map.set(row.id, row.pts)
    return map
  }, [rows])

  const shots = useMemo(() => {
    return events
      .filter((e) => e.shot_x != null && e.shot_y != null)
      .filter((e) => shotChartPlayerId === 'all' || e.player_id === shotChartPlayerId)
      .map((e) => ({ id: e.id, x: Number(e.shot_x), y: Number(e.shot_y), made: e.stat_key.endsWith('_make') }))
  }, [events, shotChartPlayerId])

  const lastEvent = events[events.length - 1]
  const lastEventPlayer = lastEvent ? gamePlayers.find((p) => p.id === lastEvent.player_id) : null
  const lastEventLabel = lastEvent ? STAT_KEY_LABEL[lastEvent.stat_key] : null

  if (!game) {
    return <p className="text-sm text-muted-foreground py-8 text-center">読み込み中...</p>
  }

  // 2Q制(前半・後半・1OT)はperiod_systemを持つ公式試合のみ対象。スクリメージ/シューティングは
  // period_systemの値によらず常に従来の4Q表示(1Q〜4Q・OT1・OT2)のまま
  const periodSystem = game.game_type === 'official' ? game.period_system : '4q'

  async function handleStart() {
    await updateGame(game.id, { status: 'in_progress' })
    setClockRunning(true)
  }

  async function toggleClock() {
    if (game.status === 'scheduled') {
      await updateGame(game.id, { status: 'in_progress' })
    }
    setClockRunning((r) => !r)
  }

  async function handleFinish() {
    setClockRunning(false)
    await updateGame(game.id, { status: 'final' })
  }

  async function handleReopen() {
    await updateGame(game.id, { status: 'in_progress' })
  }

  // opponent_score_eventsへの記録とgames.opponent_scoreの更新は、Postgres側のRPC
  // (record_opponent_score/undo_last_opponent_score)が同一トランザクションで
  // 原子的に行う。クライアント側は現在のgame.opponent_scoreを一切参照しない
  // (連続入力時のロスト・アップデートを防ぐため)。RPC後にrefreshGames()を呼び、
  // 画面表示をrealtime通知を待たず即座に同期する。
  async function recordOpponentScore(statKey) {
    const newScore = await recordOpponentStat(statKey, game.quarter)
    if (newScore != null) await refreshGames()
  }

  async function undoOpponentScore() {
    const newScore = await undoLastOpponentStat()
    if (newScore != null) await refreshGames()
  }

  async function adjustTimeouts(side, delta) {
    const field = side === 'home' ? 'home_timeouts_remaining' : 'away_timeouts_remaining'
    await updateGame(game.id, { [field]: Math.max(0, game[field] + delta) })
  }

  async function adjustFouls(side, delta) {
    const field = side === 'home' ? 'home_fouls' : 'away_fouls'
    await updateGame(game.id, { [field]: Math.max(0, game[field] + delta) })
  }

  async function handleQuarterChange(next) {
    setSecondsLeft(600)
    setClockRunning(false)
    await updateGame(game.id, { quarter: next, home_fouls: 0, away_fouls: 0 })
  }

  function adjustClock(delta) {
    setSecondsLeft((s) => Math.max(0, s + delta))
  }

  function handlePlayerPressStart(player) {
    longPressFiredRef.current = false
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      substitutionReadyRef.current = false
      clearTimeout(substitutionReadyTimerRef.current)
      substitutionReadyTimerRef.current = setTimeout(() => (substitutionReadyRef.current = true), 400)
      setSubstitutionTarget(player)
    }, 500)
  }

  function handlePlayerPressEnd() {
    clearTimeout(longPressTimerRef.current)
  }

  function handlePlayerClick(player) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    setSelectedPlayerId(player.id)
  }

  async function handleSubstitute(otherPlayer) {
    if (!substitutionTarget) return
    if (!substitutionReadyRef.current) return
    setSubstituting(true)
    const targetOnCourt = onCourtIds.has(substitutionTarget.id)
    const playerOutId = targetOnCourt ? substitutionTarget.id : otherPlayer.id
    const playerInId = targetOnCourt ? otherPlayer.id : substitutionTarget.id
    await substitute(playerOutId, playerInId)
    setSubstituting(false)
    setSubstitutionTarget(null)
  }

  function handleCategorySelect(key) {
    setActiveCategoryKey(key)
    setPendingOutcome(null)
  }

  function handleHotZoneToggle(next) {
    setHotZoneEnabled(next)
    localStorage.setItem(HOT_ZONE_ENABLED_KEY, String(next))
    setPendingOutcome(null)
  }

  async function handleShotOutcome(outcome) {
    if (!selectedPlayerId) return
    const statKey = outcome === 'make' ? activeCategory.make : activeCategory.miss
    if (activeCategory.kind === 'ft' || !hotZoneEnabled) {
      const shooterId = selectedPlayerId
      const ok = await recordStat(shooterId, statKey, { quarter: game.quarter })
      if (ok) {
        showRecordedFlash(shooterId, statKey)
        if (activeCategory.kind === 'shot' && outcome === 'make') {
          setPendingAssist({ shooterId, quarter: game.quarter })
        }
      }
    } else {
      setPendingOutcome({ statKey })
    }
  }

  async function handleCourtTap({ x, y }) {
    if (!pendingOutcome || !selectedPlayerId) return
    const statKey = pendingOutcome.statKey
    const shooterId = selectedPlayerId
    setPendingOutcome(null)
    // 指操作でアーク3のライン付近を誤タップしても、記録するスタッツは選択中の
    // カテゴリ(2P/3P)で確定しているため、ホットゾーンの記録だけをそのカテゴリに
    // 矛盾しない最寄りのゾーンへ自動補正する(スタッツの値自体は変えない)
    const { shotX, shotY } = snapToZoneCategory(x, y, statKey.startsWith('fg3_'))
    const ok = await recordStat(shooterId, statKey, { quarter: game.quarter, shotX, shotY })
    if (ok) {
      showRecordedFlash(shooterId, statKey)
      if (statKey.endsWith('_make')) {
        setPendingAssist({ shooterId, quarter: game.quarter })
      }
    }
  }

  // アシストした選手を選んだ場合は、その選手のASTとして別途記録する。
  // 「アシストなし」を選んだ/ダイアログを閉じた場合は何も記録しない
  async function handleAssistSelect(assistPlayerId) {
    if (!pendingAssist) return
    const { quarter } = pendingAssist
    setPendingAssist(null)
    const ok = await recordStat(assistPlayerId, 'ast', { quarter })
    if (ok) showRecordedFlash(assistPlayerId, 'ast')
  }

  function handleAssistSkip() {
    setPendingAssist(null)
  }

  async function handlePairClick(statKey) {
    if (!selectedPlayerId) return
    const ok = await recordStat(selectedPlayerId, statKey, { quarter: game.quarter })
    if (ok) showRecordedFlash(selectedPlayerId, statKey)
  }

  async function handleSingleClick() {
    if (!selectedPlayerId) return
    const statKey = activeCategory.stat
    const ok = await recordStat(selectedPlayerId, statKey, { quarter: game.quarter })
    if (ok) showRecordedFlash(selectedPlayerId, statKey)
  }

  // 公式試合は大会(tournament)配下の試合一覧に、スクリメージはPRACTICE一覧に戻る
  const listPath = game.game_type === 'official' ? `/games/t/${game.tournament_id}` : '/practice'

  async function handleConfirmDelete() {
    await deleteGame(game.id)
    navigate(listPath)
  }

  const isLive = game.status === 'in_progress'
  const recording = game.status !== 'final'
  const selectedPlayer = selectedPlayerId ? gamePlayers.find((p) => p.id === selectedPlayerId) : null

  return (
    <div className="flex flex-col gap-4 max-w-full overflow-x-hidden overscroll-x-none">
      <button onClick={() => navigate(listPath)} className="flex min-h-9 items-center gap-1 self-start text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        {game.game_type === 'official' ? '試合一覧' : 'PRACTICE一覧'}
      </button>

      {/* スコアボード: スコア・クォーター・ゲームクロック・TO/チームファウル・相手の得点・試合の開始/終了 */}
      <section className="relative overflow-hidden rounded-3xl bg-secondary p-4 text-secondary-foreground shadow-lg">
        <CourtLines className="text-white/[0.07]" />
        <Glow className="-right-16 -top-20 size-56" opacity={0.4} />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-base font-bold">{game.opponent_name ? `vs ${game.opponent_name}` : 'スクリメージ'}</p>
              {game.game_type === 'practice' && (
                <span className="shrink-0 rounded-full border border-white/30 px-1.5 font-heading text-[9px] leading-4 tracking-wider text-white/80">
                  PRACTICE
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-white/60">
              {formatDate(game.game_date)}
              {game.location ? ` ・ ${game.location}` : ''}
            </p>
          </div>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] tracking-wider',
              isLive ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-white/80'
            )}
          >
            {isLive && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
            {isLive ? 'LIVE' : game.status === 'final' ? 'FINAL' : STATUS_LABEL[game.status]}
          </span>
        </div>

        <div className="relative mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 text-center">
            <p className="font-heading text-[10px] tracking-[0.2em] text-white/60">自チーム</p>
            <p className="font-heading text-6xl leading-none tabular-nums" aria-label={`自チーム ${teamScore}点`}>{teamScore}</p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {recording ? (
              <select
                value={game.quarter}
                onChange={(e) => handleQuarterChange(Number(e.target.value))}
                aria-label="クォーター"
                className="min-h-8 rounded-full bg-white/15 px-3 text-center font-heading text-sm tracking-wider text-white outline-none focus-visible:ring-2 focus-visible:ring-chart-3 [&>option]:text-foreground"
              >
                {quarterOptions(periodSystem).map((q) => (
                  <option key={q} value={q}>
                    {formatQuarter(q, periodSystem)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-full bg-white/10 px-3 font-heading text-sm leading-8 tracking-wider">{formatQuarter(game.quarter, periodSystem)}</span>
            )}
            <button
              onClick={() => {
                setClockRunning(false)
                setTimePickerOpen(true)
              }}
              aria-label={`ゲームクロック ${formatClock(secondsLeft)}。タップで時間を設定`}
              className={cn('rounded-lg px-1 font-heading text-3xl leading-none tabular-nums', clockRunning ? 'text-chart-3' : 'text-white')}
            >
              {formatClock(secondsLeft)}
            </button>
            <button
              onClick={toggleClock}
              aria-label={clockRunning ? '一時停止' : '開始'}
              className={cn(
                'press flex size-11 items-center justify-center rounded-full shadow-md',
                clockRunning ? 'bg-white text-secondary' : 'bg-primary text-primary-foreground'
              )}
            >
              {clockRunning ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
            </button>
          </div>
          <div className="min-w-0 text-center">
            <p className="truncate font-heading text-[10px] tracking-[0.2em] text-white/60">{game.opponent_name || '相手'}</p>
            <p className="font-heading text-6xl leading-none tabular-nums text-white/90" aria-label={`相手 ${game.opponent_score}点`}>
              {game.opponent_score}
            </p>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-6 gap-1">
          {[-10, -5, -1, 1, 5, 10].map((delta) => (
            <button
              key={delta}
              onClick={() => adjustClock(delta)}
              aria-label={`クロックを${delta > 0 ? `${delta}秒進める` : `${-delta}秒戻す`}`}
              className="press min-h-9 rounded-lg bg-white/10 text-xs font-bold tabular-nums hover:bg-white/15"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        <TimePickerDialog
          open={timePickerOpen}
          onOpenChange={setTimePickerOpen}
          secondsLeft={secondsLeft}
          onApply={setSecondsLeft}
        />

        {/* 左が自チーム、右が相手(上のスコアと同じ並び) */}
        <div className="relative mt-2 grid grid-cols-2 gap-2">
          {[
            { side: 'home', label: '自チーム' },
            { side: 'away', label: game.opponent_name || '相手' },
          ].map(({ side, label }) => {
            const fouls = side === 'home' ? game.home_fouls : game.away_fouls
            const timeouts = side === 'home' ? game.home_timeouts_remaining : game.away_timeouts_remaining
            return (
              <div key={side} className="flex min-w-0 flex-col gap-1 rounded-2xl bg-white/[0.08] p-1.5" aria-label={label} role="group">
                <TeamCounter
                  label="TO 残り"
                  value={timeouts}
                  onMinus={() => adjustTimeouts(side, -1)}
                  onPlus={() => adjustTimeouts(side, 1)}
                />
                <TeamCounter
                  label="チームF"
                  value={fouls}
                  alert={fouls >= 5}
                  onMinus={() => adjustFouls(side, -1)}
                  onPlus={() => adjustFouls(side, 1)}
                />
              </div>
            )
          })}
        </div>

        {recording && (
          <div className="relative mt-2 flex items-center gap-1.5 rounded-2xl bg-white/[0.08] p-1.5">
            <span className="shrink-0 pl-1.5 text-[10px] font-bold leading-tight text-white/70">相手の<br />点数</span>
            <button
              onClick={undoOpponentScore}
              disabled={opponentEvents.length === 0}
              aria-label="相手の点数を1つ取り消す"
              className="press flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 disabled:opacity-35"
            >
              <Undo2 className="size-4" />
            </button>
            {[
              { key: 'ft_make', label: 'FT', sub: '+1' },
              { key: 'fg2_make', label: '2P', sub: '+2' },
              { key: 'fg3_make', label: '3P', sub: '+3' },
            ].map((o) => (
              <button
                key={o.key}
                onClick={() => recordOpponentScore(o.key)}
                className="press flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-white text-secondary"
              >
                <span className="font-heading text-base leading-none">{o.label}</span>
                <span className="text-[10px] font-bold text-muted-foreground">{o.sub}</span>
              </button>
            ))}
          </div>
        )}

        {game.status === 'final' && (
          <Button className="relative mt-3 h-11 w-full rounded-xl bg-white/10 text-white hover:bg-white/20" onClick={handleReopen}>
            <Pencil className="size-4" />
            記録を修正する
          </Button>
        )}
        {game.status === 'scheduled' && (
          <Button className="relative mt-3 h-12 w-full rounded-xl font-heading text-base tracking-wider" onClick={handleStart}>
            <Play className="size-4" />
            試合開始
          </Button>
        )}
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              vs {game.opponent_name} の試合記録とスタッツをすべて削除します。元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>削除する</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssistDialog
        pending={pendingAssist}
        players={starters}
        onSelect={handleAssistSelect}
        onSkip={handleAssistSkip}
      />

      <Dialog open={!!substitutionTarget} onOpenChange={(o) => !o && setSubstitutionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>選手交代</DialogTitle>
            <DialogDescription>
              {substitutionTarget &&
                (onCourtIds.has(substitutionTarget.id)
                  ? `${substitutionTarget.name} と交代するRESERVEの選手を選んでください`
                  : `${substitutionTarget.name} と交代するSTARTING FIVEの選手を選んでください`)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
            {(substitutionTarget && onCourtIds.has(substitutionTarget.id) ? reserves : starters)
              .filter((p) => p.id !== substitutionTarget?.id)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={substituting}
                  onClick={() => handleSubstitute(p)}
                  className="press flex min-h-12 items-center gap-2.5 rounded-xl border bg-background px-2.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <Jersey number={p.number} color={playerColor(p)} className="size-8 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                  {isGuest(p) && <GuestTag className="text-muted-foreground" />}
                  <Repeat className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            {substitutionTarget &&
              (onCourtIds.has(substitutionTarget.id) ? reserves : starters).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">交代できる選手がいません</p>
              )}
          </div>
        </DialogContent>
      </Dialog>

      {recording && (
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-heading text-lg leading-none tracking-wide">ON COURT</h2>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Repeat className="size-3 shrink-0" />
                タップで選択・長押しで交代
              </p>
            </div>
            <AddGuestDialog addPlayer={addPlayer} gameId={game.id} onAdded={(guest) => guest && setSelectedPlayerId(guest.id)} />
          </div>

          {gamePlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">先に選手を登録してください</p>
          ) : (
            <>
              {starters.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                  PLAYERSタブでSTARTING FIVEを設定してください
                </p>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {starters.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handlePlayerClick(p)}
                      onPointerDown={() => handlePlayerPressStart(p)}
                      onPointerUp={handlePlayerPressEnd}
                      onPointerLeave={handlePlayerPressEnd}
                      onContextMenu={(e) => e.preventDefault()}
                      aria-pressed={selectedPlayerId === p.id}
                      aria-label={`${p.number != null ? `#${p.number} ` : ''}${p.name}${isGuest(p) ? '(ゲスト)' : ''} ${playerPtsById.get(p.id) ?? 0}点`}
                      className={cn(
                        'press relative flex min-h-24 min-w-0 select-none flex-col items-center justify-start gap-0.5 rounded-2xl border px-0.5 pt-1.5 pb-1 transition-[background-color,transform,box-shadow] [-webkit-touch-callout:none]',
                        selectedPlayerId === p.id
                          ? 'border-secondary bg-secondary text-secondary-foreground shadow-md ring-2 ring-chart-3 -translate-y-0.5'
                          : 'bg-background hover:bg-muted',
                        isGuest(p) && selectedPlayerId !== p.id && 'border-dashed'
                      )}
                    >
                      <Jersey number={p.number} color={playerColor(p)} className="size-9" />
                      <span className="w-full truncate px-0.5 text-center text-[11px] font-bold leading-tight">{p.name}</span>
                      <span className="font-heading text-sm leading-none tabular-nums">
                        {playerPtsById.get(p.id) ?? 0}
                        <span className="ml-0.5 text-[9px] opacity-60">PTS</span>
                      </span>
                      <span className="text-[9px] leading-none tabular-nums opacity-60">
                        {formatClock(lineupByPlayer.get(p.id)?.seconds_played ?? 0)}
                      </span>
                      {isGuest(p) && (
                        <span className="absolute -top-1.5 rounded-full bg-muted px-1 font-heading text-[8px] leading-3 tracking-wider text-muted-foreground ring-1 ring-border">
                          GUEST
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <p className="font-heading text-[11px] tracking-[0.2em] text-muted-foreground">RESERVE</p>
                {reserves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">-</p>
                ) : (
                  <div className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1" data-no-pull-refresh>
                    {reserves.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePlayerClick(p)}
                        onPointerDown={() => handlePlayerPressStart(p)}
                        onPointerUp={handlePlayerPressEnd}
                        onPointerLeave={handlePlayerPressEnd}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-pressed={selectedPlayerId === p.id}
                        aria-label={`${p.number != null ? `#${p.number} ` : ''}${p.name}${isGuest(p) ? '(ゲスト)' : ''} ${playerPtsById.get(p.id) ?? 0}点`}
                        className={cn(
                          'press flex min-h-10 max-w-[11rem] shrink-0 select-none items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors [-webkit-touch-callout:none]',
                          selectedPlayerId === p.id
                            ? 'border-secondary bg-secondary text-secondary-foreground ring-2 ring-chart-3'
                            : 'bg-background hover:bg-muted',
                          isGuest(p) && selectedPlayerId !== p.id && 'border-dashed'
                        )}
                      >
                        <Jersey number={p.number} color={playerColor(p)} className="size-7 shrink-0" />
                        <span className="min-w-0 truncate font-bold">{p.name}</span>
                        {isGuest(p) && <GuestTag className="opacity-70" />}
                        <span className="shrink-0 font-heading tabular-nums opacity-70">{playerPtsById.get(p.id) ?? 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 記録する選手 → スタッツの種類 → 結果 の順に、上から下へ指を動かすだけで記録できる並び */}
          <div
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-2xl px-3 py-1.5',
              selectedPlayer ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'
            )}
            aria-live="polite"
          >
            {selectedPlayer ? (
              <>
                <Jersey number={selectedPlayer.number} color={playerColor(selectedPlayer)} className="size-7 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{selectedPlayer.name}</span>
                {isGuest(selectedPlayer) && <GuestTag className="text-white/70" />}
                <span className="shrink-0 font-heading text-[10px] tracking-[0.2em] text-chart-3">RECORDING</span>
              </>
            ) : (
              <span className="text-xs font-bold">記録する選手をタップしてください</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {STAT_CATEGORIES.map((cat) => {
              const active = activeCategoryKey === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategorySelect(cat.key)}
                  aria-pressed={active}
                  className={cn(
                    'press flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 transition-colors',
                    active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-background hover:bg-muted'
                  )}
                >
                  <span className="font-heading text-base leading-none tracking-wide">{CATEGORY_SHORT[cat.key] ?? cat.label}</span>
                  <span className={cn('mt-0.5 whitespace-nowrap text-[10px] leading-none', active ? 'text-white/80' : 'text-muted-foreground')}>
                    {cat.label}
                  </span>
                </button>
              )
            })}
          </div>

          {(activeCategory.kind === 'shot' || activeCategory.kind === 'ft') && (
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!selectedPlayerId}
                onClick={() => handleShotOutcome('miss')}
                aria-pressed={pendingOutcome?.statKey === activeCategory.miss}
                className={cn(
                  'press flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 font-heading text-xl tracking-wider transition-colors disabled:opacity-40',
                  pendingOutcome?.statKey === activeCategory.miss
                    ? 'border-secondary bg-secondary text-secondary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                )}
              >
                <X className="size-5" />
                失敗
              </button>
              <button
                disabled={!selectedPlayerId}
                onClick={() => handleShotOutcome('make')}
                aria-pressed={pendingOutcome?.statKey === activeCategory.make}
                className={cn(
                  'press flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 font-heading text-xl tracking-wider shadow-sm transition-colors disabled:opacity-40',
                  pendingOutcome?.statKey === activeCategory.make
                    ? 'border-secondary bg-secondary text-secondary-foreground'
                    : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                <Check className="size-5" />
                成功
              </button>
            </div>
          )}

          {activeCategory.kind === 'pair' && (
            <div className="grid grid-cols-2 gap-2">
              {[activeCategory.left, activeCategory.right].map((side) => (
                <button
                  key={side.key}
                  disabled={!selectedPlayerId}
                  onClick={() => handlePairClick(side.key)}
                  className="press min-h-16 rounded-2xl border-2 border-primary bg-primary font-heading text-lg tracking-wider text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40"
                >
                  {side.label}
                </button>
              ))}
            </div>
          )}

          {activeCategory.kind === 'single' && (
            <button
              disabled={!selectedPlayerId}
              onClick={handleSingleClick}
              className="press min-h-16 rounded-2xl border-2 border-primary bg-primary font-heading text-lg tracking-wider text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40"
            >
              {activeCategory.label}を記録
            </button>
          )}

          {activeCategory.kind === 'shot' && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold">ホットゾーンを記録</span>
                  <span className="text-[11px] text-muted-foreground">オフにするとシュート位置の記録をスキップします</span>
                </div>
                <Switch checked={hotZoneEnabled} onCheckedChange={handleHotZoneToggle} />
              </div>
              <p className={cn('text-center text-xs', pendingOutcome ? 'font-bold text-primary' : 'text-muted-foreground')}>
                {!hotZoneEnabled
                  ? '成功・失敗を選ぶとすぐに記録されます'
                  : pendingOutcome
                    ? 'コートをタップして位置を記録'
                    : '成功・失敗を選ぶとコートが有効になります'}
              </p>
              {recordedFlash && <RecordedFlash key={recordedFlash} message={recordedFlash} />}
              <CourtDiagram active={hotZoneEnabled && !!pendingOutcome} onTap={handleCourtTap} />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            {activeCategory.kind !== 'shot' && recordedFlash && <RecordedFlash key={recordedFlash} message={recordedFlash} />}
            <button
              disabled={!lastEvent}
              onClick={undoLast}
              className="press flex min-h-11 items-center justify-center gap-1.5 rounded-xl border bg-background px-3 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <Undo2 className="size-4 shrink-0" />
              <span className="truncate">{lastEvent ? `取り消す(${lastEventPlayer?.name ?? '?'} ・ ${lastEventLabel})` : '取り消す'}</span>
            </button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-3 rounded-xl bg-muted p-1" role="tablist">
          {[
            { key: 'basic', label: 'BOX SCORE' },
            { key: 'shoot', label: 'SHOT CHART' },
            { key: 'log', label: 'PLAY LOG' },
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={statsTab === t.key}
              onClick={() => setStatsTab(t.key)}
              className={cn(
                'min-h-9 rounded-lg font-heading text-xs tracking-wider transition-colors',
                statsTab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {statsTab === 'basic' && <BoxScoreTable rows={rows} linkToPlayers />}

        {statsTab === 'shoot' && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1" data-no-pull-refresh>
              <button
                onClick={() => setShotChartPlayerId('all')}
                className={cn(
                  'min-h-8 shrink-0 rounded-full border px-3 text-xs font-bold',
                  shotChartPlayerId === 'all' ? 'border-secondary bg-secondary text-secondary-foreground' : 'bg-background'
                )}
              >
                全体
              </button>
              {/* チーム全員ではなく、この試合に出場した選手(ボックススコアに行がある選手)のみ */}
              {rows.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setShotChartPlayerId(p.id)}
                  className={cn(
                    'min-h-8 shrink-0 rounded-full border px-3 text-xs font-bold',
                    shotChartPlayerId === p.id ? 'border-secondary bg-secondary text-secondary-foreground' : 'bg-background'
                  )}
                >
                  {p.number != null ? `#${p.number} ` : ''}
                  {p.name}
                </button>
              ))}
            </div>
            <CourtDiagram shots={shots} />
            <p className="text-xs text-muted-foreground text-center">青丸=成功 ・ 赤×=失敗</p>
          </div>
        )}

        {statsTab === 'log' && (
          <GameLogPanel
            events={events}
            gamePlayers={gamePlayers}
            periodSystem={periodSystem}
            onEdit={editStat}
            onDelete={deleteStat}
          />
        )}
      </section>

      {/* 試合終了・スコアシート・削除(試合中に頻繁には押さないものは下にまとめる) */}
      <section className="flex flex-col gap-2 rounded-3xl border bg-card p-3">
        <h2 className="font-heading text-sm tracking-[0.2em] text-muted-foreground">GAME</h2>
        {/* 試合開始・記録を修正する はスコアボード側に出す */}
        {game.status === 'in_progress' && (
          <Button className="h-12 w-full rounded-xl bg-secondary font-heading text-base tracking-wider text-secondary-foreground hover:bg-secondary/90" onClick={handleFinish}>
            <Flag className="size-4" />
            試合終了
          </Button>
        )}
        <div className="flex gap-2">
          {game.game_type !== 'shooting' && (
            <Link
              to={`/scoresheet/${game.id}`}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm hover:bg-muted"
            >
              <FileText className="size-4" />
              スコアシートを表示
            </Link>
          )}
          <Button variant="ghost" className="h-11 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            削除
          </Button>
        </div>
      </section>
    </div>
  )
}

// TO残り/チームファウルの増減。片手でも押しやすいよう36px角のボタンにする
function TeamCounter({ label, value, alert, onMinus, onPlus }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <button onClick={onMinus} aria-label={`${label}を1減らす`} className="press flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/15">
        <Minus className="size-3.5" />
      </button>
      <span className={cn('min-w-0 truncate text-center text-xs tabular-nums', alert ? 'font-bold text-[oklch(0.75_0.17_25)]' : 'text-white/85')}>
        {label} <span className="font-heading text-base">{value}</span>
      </span>
      <button onClick={onPlus} aria-label={`${label}を1増やす`} className="press flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/15">
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

function RecordedFlash({ message }) {
  return (
    <p
      className="flex items-center justify-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary animate-in fade-in-0 slide-in-from-bottom-1"
    >
      <Check className="size-3.5 shrink-0" />
      {message}
    </p>
  )
}
