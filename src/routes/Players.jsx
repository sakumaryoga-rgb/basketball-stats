import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useOtherTeamPlayers } from '@/hooks/useOtherTeamPlayers'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
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

function AddPlayerDialog({ teamId, teams, addPlayer }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('new')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [position, setPosition] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { players: otherPlayers, loading: otherLoading } = useOtherTeamPlayers(teams, teamId)

  function reset() {
    setName('')
    setNumber('')
    setPosition('')
    setError('')
    setMode('new')
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await addPlayer({ name, number: number ? Number(number) : null, position })
      reset()
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExisting(existing) {
    setSaving(true)
    setError('')
    try {
      await addPlayer({
        name: existing.name,
        number: existing.number,
        position: existing.position,
        heightCm: existing.height_cm,
        weightKg: existing.weight_kg,
        photoUrl: existing.photo_url,
      })
      reset()
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        setOpen(next)
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        選手を追加
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>選手を追加</DialogTitle>
          <DialogDescription>ロスターに新しい選手を登録します</DialogDescription>
        </DialogHeader>

        {teams.length > 1 && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'new' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('new')}
            >
              新規登録
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'existing' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('existing')}
            >
              既存の選手から追加
            </Button>
          </div>
        )}

        {mode === 'new' ? (
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="player-name">名前</Label>
              <Input id="player-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田太郎" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="player-number">背番号</Label>
                <Input id="player-number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="例: 7" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="player-position">ポジション</Label>
                <Input id="player-position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="例: PG" />
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? '追加中...' : '追加する'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            {otherLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">読み込み中...</p>
            ) : otherPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">他のチームに選手が登録されていません</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {otherPlayers.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <Avatar className="size-8 shrink-0 text-xs font-medium">
                      <AvatarImage src={p.photo_url} alt={p.name} />
                      <AvatarFallback className="tabular-nums">{p.number ?? '-'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.teams?.name}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => handleAddExisting(p)}>
                      追加
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function Players({ teamId, teams = [] }) {
  const { players: allPlayers, addPlayer, removePlayer } = usePlayers(teamId)
  const players = allPlayers.filter((p) => !p.guest_game_id)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await removePlayer(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-wide">PLAYERS</h1>
        <AddPlayerDialog teamId={teamId} teams={teams} addPlayer={addPlayer} />
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">まだ選手が登録されていません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li key={player.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <Avatar className="size-9 shrink-0 text-sm font-medium">
                <AvatarImage src={player.photo_url} alt={player.name} />
                <AvatarFallback className="tabular-nums">{player.number ?? '-'}</AvatarFallback>
              </Avatar>
              <Link to={`/players/${player.id}`} className="flex-1 min-w-0">
                <p className="font-medium truncate">{player.name}</p>
                {player.position && <p className="text-xs text-muted-foreground">{player.position}</p>}
              </Link>
              <Button variant="ghost" size="icon-sm" aria-label="削除" onClick={() => setDeleteTarget(player)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} をロスターから削除します。これまでの試合のスタッツ記録も一緒に削除され、元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
