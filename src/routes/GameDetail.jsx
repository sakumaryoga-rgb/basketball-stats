import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Undo2, ChevronLeft, Minus } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useGameStats } from '@/hooks/useGameStats'
import { STAT_BUTTONS } from '@/lib/stats'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BoxScoreTable } from '@/components/BoxScoreTable'
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

  const game = games.find((g) => g.id === id)

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

  const lastEvent = events[events.length - 1]
  const lastEventPlayer = lastEvent ? players.find((p) => p.id === lastEvent.player_id) : null
  const lastEventLabel = lastEvent ? STAT_BUTTONS.find((b) => b.key === lastEvent.stat_key)?.label : null

  if (!game) {
    return <p className="text-sm text-muted-foreground py-8 text-center">読み込み中...</p>
  }

  async function handleStart() {
    await updateGame(game.id, { status: 'in_progress' })
  }

  async function handleFinish() {
    await updateGame(game.id, { status: 'final' })
  }

  async function handleReopen() {
    await updateGame(game.id, { status: 'in_progress' })
  }

  async function adjustOpponentScore(delta) {
    await updateGame(game.id, { opponent_score: Math.max(0, game.opponent_score + delta) })
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

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">vs {game.opponent_name}</p>
          <Badge variant={game.status === 'in_progress' ? 'default' : 'secondary'}>{STATUS_LABEL[game.status]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(game.game_date)}
          {game.location ? ` ・ ${game.location}` : ''}
        </p>

        <div className="flex items-center justify-center gap-6 py-3">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums">{teamScore}</p>
            <p className="text-xs text-muted-foreground">自チーム</p>
          </div>
          <span className="text-muted-foreground">-</span>
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums">{game.opponent_score}</p>
            <p className="text-xs text-muted-foreground">{game.opponent_name}</p>
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
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selectedPlayerId === p.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  )}
                >
                  {p.number != null ? `#${p.number} ` : ''}
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            {STAT_BUTTONS.map((btn) => (
              <Button
                key={btn.key}
                variant="outline"
                disabled={!selectedPlayerId}
                onClick={() => recordStat(selectedPlayerId, btn.key)}
              >
                {btn.label}
              </Button>
            ))}
          </div>

          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" disabled={!lastEvent} onClick={undoLast}>
            <Undo2 className="size-3.5" />
            {lastEvent ? `取り消す(${lastEventPlayer?.name ?? '?'} ・ ${lastEventLabel})` : '取り消す'}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">ボックススコア</p>
        <BoxScoreTable rows={rows} linkToPlayers />
      </div>
    </div>
  )
}
