import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useShootingEntries } from '@/hooks/useShootingEntries'
import { formatDate } from '@/lib/format'
import { formatPct } from '@/lib/stats'
import { ZONES, ZONE_ORDER, classifyShotZone, aggregateHotZonesFromTallies } from '@/lib/hotZones'
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
  const { players } = usePlayers(teamId)
  const { games, deleteGame } = useGames(teamId, 'shooting')
  const { entries, addTally, resetZone } = useShootingEntries(id)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [pendingZone, setPendingZone] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const session = games.find((g) => g.id === id)

  const playerEntries = useMemo(
    () => entries.filter((e) => e.player_id === selectedPlayerId),
    [entries, selectedPlayerId]
  )
  const playerHotZones = useMemo(() => aggregateHotZonesFromTallies(playerEntries), [playerEntries])
  const sessionHotZones = useMemo(() => aggregateHotZonesFromTallies(entries), [entries])

  const playerTotals = playerEntries.reduce(
    (acc, e) => ({ attempts: acc.attempts + e.attempts, makes: acc.makes + e.makes }),
    { attempts: 0, makes: 0 }
  )

  if (!session) {
    return <p className="text-sm text-muted-foreground py-8 text-center">読み込み中...</p>
  }

  function handleCourtTap({ x, y }) {
    if (!selectedPlayerId) return
    setPendingZone(classifyShotZone(x, y))
  }

  async function handleConfirmZone(attempts, makes) {
    await addTally(selectedPlayerId, pendingZone, attempts, makes)
    setPendingZone(null)
  }

  async function handleConfirmDelete() {
    await deleteGame(session.id)
    navigate('/practice')
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate('/practice')} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        PRACTICE一覧
      </button>

      <div className="flex flex-col gap-1 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">{session.opponent_name || 'シューティング'}</p>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            削除
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(session.game_date)}</p>
      </div>

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

      <div className="flex flex-col gap-2">
        <p className="text-xs font-heading tracking-wide text-muted-foreground">選手を選択</p>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">先に選手を登録してください</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors select-none',
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
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground text-center">
          {selectedPlayerId
            ? 'コートをタップしてゾーンを選び、試投数・成功数をまとめて記録します'
            : '先に選手を選択してください'}
        </p>
        <CourtDiagram active={!!selectedPlayerId} onTap={handleCourtTap} />
      </div>

      <ZoneEntryDialog
        zone={pendingZone}
        existing={pendingZone ? playerHotZones[pendingZone] : { attempts: 0, makes: 0, pct: null }}
        onClose={() => setPendingZone(null)}
        onConfirm={handleConfirmZone}
      />

      {selectedPlayerId && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            この選手の記録 {playerTotals.attempts > 0 && `(${playerTotals.makes}/${playerTotals.attempts})`}
          </p>
          {playerEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">まだ記録がありません</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {ZONE_ORDER.filter((key) => playerHotZones[key].attempts > 0).map((key) => (
                <li key={key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{ZONES[key].label}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-muted-foreground">
                      {playerHotZones[key].makes}/{playerHotZones[key].attempts} ({formatPct(playerHotZones[key].pct)})
                    </span>
                    <button
                      onClick={() => resetZone(selectedPlayerId, key)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="リセット"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">セッション全体のホットゾーン</p>
        <HotZoneChart hotZones={sessionHotZones} />
      </div>
    </div>
  )
}
