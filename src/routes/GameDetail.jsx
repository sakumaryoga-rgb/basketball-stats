import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Undo2, ChevronLeft, Minus, Plus, Play, Pause } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useGameStats } from '@/hooks/useGameStats'
import { STAT_CATEGORIES, STAT_KEY_LABEL, formatClock, formatQuarter } from '@/lib/stats'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BoxScoreTable } from '@/components/BoxScoreTable'
import { CourtDiagram } from '@/components/CourtDiagram'
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

const STATUS_LABEL = { scheduled: '予定', in_progress: '試合中', final: '終了' }

const EMPTY_STATS = {
  pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
  fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
}

export function GameDetail({ teamId }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players } = usePlayers(teamId)
  const { games, updateGame, deleteGame } = useGames(teamId)
  const { events, boxScore, recordStat, undoLast } = useGameStats(id)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeCategoryKey, setActiveCategoryKey] = useState('fg2')
  const [pendingOutcome, setPendingOutcome] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(600)
  const [clockRunning, setClockRunning] = useState(false)
  const [statsTab, setStatsTab] = useState('basic')
  const [shotChartPlayerId, setShotChartPlayerId] = useState('all')

  const game = games.find((g) => g.id === id)
  const activeCategory = STAT_CATEGORIES.find((c) => c.key === activeCategoryKey)

  useEffect(() => {
    if (!clockRunning) return
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [clockRunning])

  const boxByPlayer = useMemo(() => {
    const map = new Map()
    for (const row of boxScore) map.set(row.player_id, row)
    return map
  }, [boxScore])

  const rows = useMemo(() => {
    return players
      .filter((p) => boxByPlayer.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, number: p.number, ...EMPTY_STATS, ...boxByPlayer.get(p.id) }))
      .sort((a, b) => b.pts - a.pts)
  }, [players, boxByPlayer])

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
  const lastEventPlayer = lastEvent ? players.find((p) => p.id === lastEvent.player_id) : null
  const lastEventLabel = lastEvent ? STAT_KEY_LABEL[lastEvent.stat_key] : null

  if (!game) {
    return <p className="text-sm text-muted-foreground py-8 text-center">読み込み中...</p>
  }

  async function handleStart() {
    await updateGame(game.id, { status: 'in_progress' })
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

  async function advanceQuarter() {
    const next = game.quarter >= 5 ? 1 : game.quarter + 1
    setSecondsLeft(600)
    setClockRunning(false)
    await updateGame(game.id, { quarter: next, home_fouls: 0, away_fouls: 0 })
  }

  function adjustClock(delta) {
    setSecondsLeft((s) => Math.max(0, s + delta))
  }

  function handleCategorySelect(key) {
    setActiveCategoryKey(key)
    setPendingOutcome(null)
  }

  function handleShotOutcome(outcome) {
    if (!selectedPlayerId) return
    const statKey = outcome === 'make' ? activeCategory.make : activeCategory.miss
    if (activeCategory.kind === 'ft') {
      recordStat(selectedPlayerId, statKey, { quarter: game.quarter })
    } else {
      setPendingOutcome({ statKey })
    }
  }

  function handleCourtTap({ x, y }) {
    if (!pendingOutcome || !selectedPlayerId) return
    recordStat(selectedPlayerId, pendingOutcome.statKey, { quarter: game.quarter, shotX: x, shotY: y })
    setPendingOutcome(null)
  }

  function handlePairClick(statKey) {
    if (!selectedPlayerId) return
    recordStat(selectedPlayerId, statKey, { quarter: game.quarter })
  }

  function handleSingleClick() {
    if (!selectedPlayerId) return
    recordStat(selectedPlayerId, activeCategory.stat, { quarter: game.quarter })
  }

  async function handleConfirmDelete() {
    await deleteGame(game.id)
    navigate('/games')
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        試合一覧
      </button>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">vs {game.opponent_name}</p>
          <Badge variant={game.status === 'in_progress' ? 'default' : 'secondary'}>{STATUS_LABEL[game.status]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          {formatDate(game.game_date)}
          {game.location ? ` ・ ${game.location}` : ''}
        </p>

        {game.status !== 'scheduled' && (
          <button
            onClick={advanceQuarter}
            className="self-center rounded-full border px-3 py-1 text-sm font-medium text-primary hover:bg-muted"
          >
            {formatQuarter(game.quarter)} ⇅
          </button>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => adjustClock(-1)}>
            <Minus className="size-3.5" />
          </Button>
          <button
            onClick={() => setClockRunning((r) => !r)}
            className="flex items-center gap-2 text-3xl font-bold tabular-nums"
          >
            {clockRunning ? <Pause className="size-5 text-primary" /> : <Play className="size-5 text-primary" />}
            {formatClock(secondsLeft)}
          </button>
          <Button variant="outline" size="icon-sm" onClick={() => adjustClock(1)}>
            <Plus className="size-3.5" />
          </Button>
        </div>

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

      {game.status === 'in_progress' && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">選手を選択</p>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">先に選手を登録してください</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selectedPlayerId === p.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  )}
                >
                  {p.number != null ? `#${p.number} ` : ''}
                  {p.name}
                  <span className="opacity-70 tabular-nums">{playerPtsById.get(p.id) ?? 0}</span>
                </button>
              ))}
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
              <p className="text-xs text-muted-foreground text-center">
                {pendingOutcome ? 'コートをタップして位置を記録' : '成功・失敗を選ぶとコートが有効になります'}
              </p>
              <CourtDiagram active={!!pendingOutcome} onTap={handleCourtTap} />
            </>
          )}

          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" disabled={!lastEvent} onClick={undoLast}>
            <Undo2 className="size-3.5" />
            {lastEvent ? `取り消す(${lastEventPlayer?.name ?? '?'} ・ ${lastEventLabel})` : '取り消す'}
          </Button>
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
            ベーシック
          </button>
          <button
            onClick={() => setStatsTab('shoot')}
            className={cn(
              'pb-2 text-sm font-medium border-b-2 -mb-px',
              statsTab === 'shoot' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            )}
          >
            シュート
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
              {players.map((p) => (
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
