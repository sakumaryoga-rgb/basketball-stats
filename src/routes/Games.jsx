import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
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

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Games({ teamId }) {
  const { games, createGame } = useGames(teamId)
  const [open, setOpen] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [gameDate, setGameDate] = useState(todayStr())
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createGame({ opponentName, gameDate, location })
      setOpponentName('')
      setLocation('')
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-wide">GAME</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            試合を作成
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>試合を作成</DialogTitle>
              <DialogDescription>対戦相手と日程を入力してください</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="opponent-name">対戦相手</Label>
                <Input
                  id="opponent-name"
                  required
                  value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)}
                  placeholder="例: 〇〇中学校"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="game-date">日付</Label>
                  <Input id="game-date" type="date" required value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="game-location">会場</Label>
                  <Input id="game-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="任意" />
                </div>
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
    </div>
  )
}
