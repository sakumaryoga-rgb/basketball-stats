import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useTournaments } from '@/hooks/useTournaments'
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

// GAMEタブは大会単位の一覧。大会を作成し、その中で複数の試合を追加していく
// (過去の記録を大会単位で参照しやすくするため)。日程・会場は大会作成時に入力し、
// 大会内で試合を追加するたびに同じ内容を入力する手間を省く
export function Tournaments({ teamId }) {
  const { tournaments, createTournament, deleteTournament } = useTournaments(teamId)
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-wide">GAMES</h1>
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
      </div>

      {tournaments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">まだ大会が登録されていません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tournaments.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Link
                to={`/games/t/${t.id}`}
                className="flex-1 min-w-0 rounded-lg border px-3 py-2.5 hover:bg-muted/50"
              >
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.game_date}
                  {t.location ? ` ・ ${t.location}` : ''}
                  {' ・ '}
                  {t.period_system === '2q' ? '2Q制' : '4Q制'}
                </p>
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
          ))}
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
