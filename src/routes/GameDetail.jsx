import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Undo2, ChevronLeft, Minus, Plus, Play, Pause, UserPlus, Check, Repeat } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useGameStats } from '@/hooks/useGameStats'
import { useGameLineups } from '@/hooks/useGameLineups'
import { STAT_CATEGORIES, STAT_KEY_LABEL, QUARTER_OPTIONS, formatClock, formatQuarter } from '@/lib/stats'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BoxScoreTable } from '@/components/BoxScoreTable'
import { CourtDiagram } from '@/components/CourtDiagram'
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
          <button className="flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" />
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
          <div className="flex flex-wrap gap-2">
            {candidates.map((p) => (
              <Button key={p.id} type="button" variant="outline" onClick={() => onSelect(p.id)}>
                {p.number != null ? `#${p.number} ` : ''}
                {p.name}
              </Button>
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
  const { games, updateGame, deleteGame } = useGames(teamId)
  const game = games.find((g) => g.id === id)
  const { events, boxScore, recordStat, undoLast } = useGameStats(id, game?.game_type)
  const { lineups, substitute, incrementSeconds } = useGameLineups(id)
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

  const activeCategory = STAT_CATEGORIES.find((c) => c.key === activeCategoryKey)

  // この試合のロスター: 通常の選手全員 + この試合限定のゲスト(他の試合のゲストは含めない)
  const gamePlayers = useMemo(
    () => players.filter((p) => !p.guest_game_id || p.guest_game_id === game?.id),
    [players, game]
  )

  function showRecordedFlash(playerId, statKey) {
    const playerName = gamePlayers.find((p) => p.id === playerId)?.name ?? '?'
    clearTimeout(flashTimerRef.current)
    setRecordedFlash(`${playerName}: ${STAT_KEY_LABEL[statKey]} を記録しました`)
    flashTimerRef.current = setTimeout(() => setRecordedFlash(null), 1600)
  }

  useEffect(() => () => clearTimeout(flashTimerRef.current), [])
  useEffect(() => () => clearTimeout(longPressTimerRef.current), [])

  useEffect(() => {
    if (!clockRunning) return
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
      pendingSecondsRef.current += 1
      // 出場時間の書き込み回数を抑えるため、5秒分たまってからまとめて反映する
      if (pendingSecondsRef.current >= 5) {
        const delta = pendingSecondsRef.current
        pendingSecondsRef.current = 0
        incrementSeconds(delta)
      }
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
        isGuest: !!p.guest_game_id,
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

  async function adjustOpponentScore(delta) {
    await updateGame(game.id, { opponent_score: Math.max(0, game.opponent_score + delta) })
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
    const ok = await recordStat(shooterId, statKey, { quarter: game.quarter, shotX: x, shotY: y })
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

  const listPath = game.game_type === 'official' ? '/games' : '/practice'

  async function handleConfirmDelete() {
    await deleteGame(game.id)
    navigate(listPath)
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(listPath)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        {game.game_type === 'official' ? '試合一覧' : 'PRACTICE一覧'}
      </button>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-medium">{game.opponent_name ? `vs ${game.opponent_name}` : 'スクリメージ'}</p>
            {game.game_type === 'practice' && <Badge variant="outline">PRACTICE</Badge>}
          </div>
          <Badge variant={game.status === 'in_progress' ? 'default' : 'secondary'}>{STATUS_LABEL[game.status]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          {formatDate(game.game_date)}
          {game.location ? ` ・ ${game.location}` : ''}
        </p>

        {game.status !== 'final' && (
          <select
            value={game.quarter}
            onChange={(e) => handleQuarterChange(Number(e.target.value))}
            className="self-center rounded-full border px-3 py-1 text-sm font-medium text-primary bg-background hover:bg-muted"
          >
            {QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {formatQuarter(q)}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => adjustClock(-1)}>
            <Minus className="size-3.5" />
          </Button>
          <button onClick={toggleClock} aria-label={clockRunning ? '一時停止' : '開始'} className="shrink-0">
            {clockRunning ? <Pause className="size-5 text-primary" /> : <Play className="size-5 text-primary" />}
          </button>
          <button
            onClick={() => {
              setClockRunning(false)
              setTimePickerOpen(true)
            }}
            className="text-3xl font-bold tabular-nums"
          >
            {formatClock(secondsLeft)}
          </button>
          <Button variant="outline" size="icon-sm" onClick={() => adjustClock(1)}>
            <Plus className="size-3.5" />
          </Button>
        </div>

        <TimePickerDialog
          open={timePickerOpen}
          onOpenChange={setTimePickerOpen}
          secondsLeft={secondsLeft}
          onApply={setSecondsLeft}
        />

        <div className="flex items-center justify-center gap-6">
          <p className="text-3xl font-bold tabular-nums">{teamScore}</p>
          <span className="text-muted-foreground">-</span>
          <p className="text-3xl font-bold tabular-nums">{game.opponent_score}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-muted-foreground truncate max-w-full">自チーム</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-xs" onClick={() => adjustTimeouts('home', -1)}>
                <Minus className="size-3" />
              </Button>
              <span className="text-xs tabular-nums">TO 残り{game.home_timeouts_remaining}</span>
              <Button variant="outline" size="icon-xs" onClick={() => adjustTimeouts('home', 1)}>
                <Plus className="size-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-xs" onClick={() => adjustFouls('home', -1)}>
                <Minus className="size-3" />
              </Button>
              <span className={cn('text-xs tabular-nums', game.home_fouls >= 5 && 'font-bold text-destructive')}>
                チームF {game.home_fouls}
              </span>
              <Button variant="outline" size="icon-xs" onClick={() => adjustFouls('home', 1)}>
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-muted-foreground truncate max-w-full">{game.opponent_name}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-xs" onClick={() => adjustTimeouts('away', -1)}>
                <Minus className="size-3" />
              </Button>
              <span className="text-xs tabular-nums">TO 残り{game.away_timeouts_remaining}</span>
              <Button variant="outline" size="icon-xs" onClick={() => adjustTimeouts('away', 1)}>
                <Plus className="size-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-xs" onClick={() => adjustFouls('away', -1)}>
                <Minus className="size-3" />
              </Button>
              <span className={cn('text-xs tabular-nums', game.away_fouls >= 5 && 'font-bold text-destructive')}>
                チームF {game.away_fouls}
              </span>
              <Button variant="outline" size="icon-xs" onClick={() => adjustFouls('away', 1)}>
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
        </div>

        {game.status !== 'final' && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">相手の点数</span>
            <Button variant="outline" size="icon-sm" onClick={() => adjustOpponentScore(-1)}>
              <Minus className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => adjustOpponentScore(1)}>+1</Button>
            <Button variant="outline" size="sm" onClick={() => adjustOpponentScore(2)}>+2</Button>
            <Button variant="outline" size="sm" onClick={() => adjustOpponentScore(3)}>+3</Button>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {game.status === 'scheduled' && (
            <Button className="flex-1" onClick={handleStart}>試合開始</Button>
          )}
          {game.status === 'in_progress' && (
            <Button className="flex-1" onClick={handleFinish}>試合終了</Button>
          )}
          {game.status === 'final' && (
            <Button className="flex-1" variant="outline" onClick={handleReopen}>記録を修正する</Button>
          )}
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>削除</Button>
        </div>
      </div>

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
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {(substitutionTarget && onCourtIds.has(substitutionTarget.id) ? reserves : starters)
              .filter((p) => p.id !== substitutionTarget?.id)
              .map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  className="justify-start"
                  disabled={substituting}
                  onClick={() => handleSubstitute(p)}
                >
                  {p.number != null ? `#${p.number} ` : ''}
                  {p.name}
                </Button>
              ))}
            {substitutionTarget &&
              (onCourtIds.has(substitutionTarget.id) ? reserves : starters).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">交代できる選手がいません</p>
              )}
          </div>
        </DialogContent>
      </Dialog>

      {game.status !== 'final' && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">選手を選択</p>
            <AddGuestDialog addPlayer={addPlayer} gameId={game.id} onAdded={(guest) => guest && setSelectedPlayerId(guest.id)} />
          </div>
          {gamePlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">先に選手を登録してください</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-heading tracking-wide text-muted-foreground">STARTING FIVE</p>
                {starters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">TEAMタブでSTARTING FIVEを設定してください</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {starters.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePlayerClick(p)}
                        onPointerDown={() => handlePlayerPressStart(p)}
                        onPointerUp={handlePlayerPressEnd}
                        onPointerLeave={handlePlayerPressEnd}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors select-none',
                          selectedPlayerId === p.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted'
                        )}
                      >
                        {p.number != null ? `#${p.number} ` : ''}
                        {p.name}
                        {p.guest_game_id && (
                          <span className="rounded bg-muted-foreground/20 px-1 text-[10px] leading-4">ゲスト</span>
                        )}
                        <span className="opacity-70 tabular-nums">{playerPtsById.get(p.id) ?? 0}</span>
                        <span className="opacity-70 tabular-nums text-[10px]">
                          {formatClock(lineupByPlayer.get(p.id)?.seconds_played ?? 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-heading tracking-wide text-muted-foreground">RESERVE</p>
                {reserves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">-</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {reserves.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePlayerClick(p)}
                        onPointerDown={() => handlePlayerPressStart(p)}
                        onPointerUp={handlePlayerPressEnd}
                        onPointerLeave={handlePlayerPressEnd}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors select-none',
                          selectedPlayerId === p.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted'
                        )}
                      >
                        {p.number != null ? `#${p.number} ` : ''}
                        {p.name}
                        {p.guest_game_id && (
                          <span className="rounded bg-muted-foreground/20 px-1 text-[10px] leading-4">ゲスト</span>
                        )}
                        <span className="opacity-70 tabular-nums">{playerPtsById.get(p.id) ?? 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Repeat className="size-3" />
                選手を長押しすると交代できます
              </p>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {STAT_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleCategorySelect(cat.key)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  activeCategoryKey === cat.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {(activeCategory.kind === 'shot' || activeCategory.kind === 'ft') && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={pendingOutcome?.statKey === activeCategory.miss ? 'default' : 'outline'}
                disabled={!selectedPlayerId}
                onClick={() => handleShotOutcome('miss')}
              >
                失敗
              </Button>
              <Button
                variant={pendingOutcome?.statKey === activeCategory.make ? 'default' : 'outline'}
                disabled={!selectedPlayerId}
                onClick={() => handleShotOutcome('make')}
              >
                成功
              </Button>
            </div>
          )}

          {activeCategory.kind === 'pair' && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!selectedPlayerId} onClick={() => handlePairClick(activeCategory.left.key)}>
                {activeCategory.left.label}
              </Button>
              <Button variant="outline" disabled={!selectedPlayerId} onClick={() => handlePairClick(activeCategory.right.key)}>
                {activeCategory.right.label}
              </Button>
            </div>
          )}

          {activeCategory.kind === 'single' && (
            <Button variant="outline" disabled={!selectedPlayerId} onClick={handleSingleClick}>
              {activeCategory.label}を記録
            </Button>
          )}

          {activeCategory.kind === 'shot' && (
            <>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">ホットゾーンを記録</span>
                  <span className="text-[11px] text-muted-foreground">
                    オフにするとシュート位置の記録をスキップします
                  </span>
                </div>
                <Switch checked={hotZoneEnabled} onCheckedChange={handleHotZoneToggle} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {!hotZoneEnabled
                  ? '成功・失敗を選ぶとすぐに記録されます'
                  : pendingOutcome
                    ? 'コートをタップして位置を記録'
                    : '成功・失敗を選ぶとコートが有効になります'}
              </p>
              {recordedFlash && (
                <p
                  key={recordedFlash}
                  className="flex items-center justify-center gap-1 text-xs text-primary animate-in fade-in-0 slide-in-from-bottom-1"
                >
                  <Check className="size-3.5 shrink-0" />
                  {recordedFlash}
                </p>
              )}
              <CourtDiagram active={hotZoneEnabled && !!pendingOutcome} onTap={handleCourtTap} />
            </>
          )}

          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" className="self-start text-muted-foreground" disabled={!lastEvent} onClick={undoLast}>
              <Undo2 className="size-3.5" />
              {lastEvent ? `取り消す(${lastEventPlayer?.name ?? '?'} ・ ${lastEventLabel})` : '取り消す'}
            </Button>
            {activeCategory.kind !== 'shot' && recordedFlash && (
              <p
                key={recordedFlash}
                className="flex items-center gap-1 text-xs text-primary animate-in fade-in-0 slide-in-from-bottom-1"
              >
                <Check className="size-3.5 shrink-0" />
                {recordedFlash}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-4 border-b">
          <button
            onClick={() => setStatsTab('basic')}
            className={cn(
              'pb-2 text-sm font-medium border-b-2 -mb-px',
              statsTab === 'basic' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            )}
          >
            BOX SCORE
          </button>
          <button
            onClick={() => setStatsTab('shoot')}
            className={cn(
              'pb-2 text-sm font-medium border-b-2 -mb-px',
              statsTab === 'shoot' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            )}
          >
            SHOT CHART
          </button>
        </div>

        {statsTab === 'basic' ? (
          <BoxScoreTable rows={rows} linkToPlayers />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setShotChartPlayerId('all')}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs',
                  shotChartPlayerId === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
                )}
              >
                全体
              </button>
              {gamePlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setShotChartPlayerId(p.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs',
                    shotChartPlayerId === p.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
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
      </div>
    </div>
  )
}
