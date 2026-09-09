import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTournaments } from '@/hooks/useTournaments'
import { useGames } from '@/hooks/useGames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

const STATUS_LABEL = {
  scheduled: '予定',
  in_progress: '試合中',
  final: '終了',
}

const STATUS_VARIANT = {
  scheduled: 'outline',
  in_progress: 'default',
  final: 'secondary',
}

// 1つの大会に属する試合の一覧。大会単位でGAMEタブから遷移してくる。
// 日程・会場は大会作成時に入力済みのため、試合追加時は対戦相手のみ入力すればよい
export function TournamentGames({ teamId }) {
  const { tournamentId } = useParams()
  const navigate = useNavigate()
  const { tournaments, updateTournament, deleteTournament } = useTournaments(teamId)
  const { games, createGame } = useGames(teamId, 'official', tournamentId)
  const tournament = tournaments.find((t) => t.id === tournamentId)

  const [open, setOpen] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGameDate, setEditGameDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createGame({ opponentName, gameDate: tournament.game_date, location: tournament.location })
      setOpponentName('')
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function openEdit() {
    setEditName(tournament.name)
    setEditGameDate(tournament.game_date)
    setEditLocation(tournament.location ?? '')
    setEditError('')
    setEditOpen(true)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      await updateTournament(tournamentId, { name: editName, game_date: editGameDate, location: editLocation || null })
      setEditOpen(false)
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleConfirmDelete() {
    await deleteTournament(tournamentId)
    navigate('/games')
  }

  if (!tournament) {
    return <p className="text-sm text-muted-foreground py-8 text-center">読み込み中...</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        大会一覧
      </button>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading tracking-wide truncate">{tournament.name}</h1>
          <p className="text-xs text-muted-foreground">
            {tournament.game_date}
            {tournament.location ? ` ・ ${tournament.location}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" />
              試合を追加
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>試合を追加</DialogTitle>
                <DialogDescription>対戦相手を入力してください(日程・会場は大会の設定を使用します)</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="opponent-name">対戦相手</Label>
                  <Input
                    id="opponent-name"
                    required
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                    placeholder="ここにチーム名を入力"
                  />
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
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="大会を編集"
            onClick={openEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="大会を削除"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">まだ試合が登録されていません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                to={`/games/${game.id}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">vs {game.opponent_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {game.game_date}
                    {game.location ? ` ・ ${game.location}` : ''}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[game.status]}>{STATUS_LABEL[game.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>大会を編集</DialogTitle>
            <DialogDescription>大会名・日程・会場を変更できます</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tournament-name">大会名</Label>
              <Input id="edit-tournament-name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-tournament-date">日程</Label>
                <Input id="edit-tournament-date" type="date" required value={editGameDate} onChange={(e) => setEditGameDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-tournament-location">会場</Label>
                <Input id="edit-tournament-location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="任意" />
              </div>
            </div>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? '保存中...' : '保存する'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{tournament.name}」とその中の試合・スタッツをすべて削除します。元に戻せません。
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
