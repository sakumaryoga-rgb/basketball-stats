import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Trash2, Check, Pencil } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useShootingEntries } from '@/hooks/useShootingEntries'
import { formatDate } from '@/lib/format'
import { formatPct } from '@/lib/stats'
import { ZONES, ZONE_ORDER, classifyShotZone, aggregateHotZonesFromTallies } from '@/lib/hotZones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  const { players } = usePlayers(teamId)
  const { games, updateGame, deleteGame } = useGames(teamId, 'shooting')
  const { entries, addTally, resetZone } = useShootingEntries(id)
  // シューティング追加時に選手を選んでいれば、その選手だけをこの画面に表示し、1人目を
  // 最初から選択済みにしておく(追加直後にもう一度選手を選び直す手間を省く)。
  // location.stateはマウント直後にuseActiveShareToken(App.jsx)がURLへ?t=を付与するための
  // replaceナビゲーションで失われてしまうため、マウント時に一度だけstateで捕まえておく
  const [participantIds] = useState(() => location.state?.playerIds ?? null)
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
  const visiblePlayers = useMemo(() => {
    if (visiblePlayerIds.size > 0) return players.filter((p) => visiblePlayerIds.has(p.id))
    return players
  }, [players, visiblePlayerIds])

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
      <button onClick={() => navigate('/practice')} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        PRACTICE一覧
      </button>

      <div className="flex flex-col gap-1 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium truncate">{session.opponent_name || 'シューティング'}</p>
            <Badge variant={session.status === 'final' ? 'secondary' : 'outline'} className="shrink-0">
              {session.status === 'final' ? '完了' : '下書き'}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => setConfirmDelete(true)}>
            削除
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(session.game_date)}</p>
        {session.status !== 'final' && (
          <p className="text-xs text-muted-foreground">
            「ワークアウトを完了する」を押すまで、個人のPRACTICE記録には反映されません
          </p>
        )}
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

      {readOnly ? (
        <Button variant="outline" className="w-full" onClick={handleStartEditing}>
          <Pencil className="size-4" />
          記録を修正する
        </Button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button variant="destructive" className="w-full" disabled={entries.length === 0} onClick={handleCompleteWorkout}>
            ワークアウトを完了する
          </Button>
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">まだ記録がありません</p>
          )}
          {completeError && <p className="text-xs text-destructive text-center">{completeError}</p>}
        </div>
      )}

      <Dialog open={showCompleteAnimation}>
        <DialogContent showCloseButton={false} className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 animate-check-pop">
            <Check className="size-8" strokeWidth={3} />
          </div>
          <p className="font-medium">ワークアウトを記録しました</p>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-heading tracking-wide text-muted-foreground">選手を選択</p>
        {visiblePlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground">先に選手を登録してください</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visiblePlayers.map((p) => (
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
          {readOnly
            ? '内容を修正するには上の「記録を修正する」を押してください'
            : selectedPlayerId
              ? 'コートをタップしてゾーンを選び、試投数・成功数をまとめて記録します'
              : '先に選手を選択してください'}
        </p>
        <CourtDiagram active={!!selectedPlayerId && !readOnly} onTap={handleCourtTap} />
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
                    {!readOnly && (
                      <button
                        onClick={() => handleResetZone(key)}
                        className="text-muted-foreground hover:text-destructive"
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
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">セッション全体のホットゾーン</p>
        <HotZoneChart hotZones={sessionHotZones} />
      </div>
    </div>
  )
}
