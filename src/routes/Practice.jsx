import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { useGames } from '@/hooks/useGames'
import { usePlayers } from '@/hooks/usePlayers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

function CreateScrimmageDialog({ createGame }) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        スクリメージを追加
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>スクリメージを追加</DialogTitle>
          <DialogDescription>
            GAME同様に記録できますが、公式スタッツ(TEAM/個人記録)には反映されません
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scrimmage-opponent">対戦相手 (任意)</Label>
            <Input
              id="scrimmage-opponent"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="例: 紅白戦"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scrimmage-date">日付</Label>
              <Input id="scrimmage-date" type="date" required value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scrimmage-location">会場</Label>
              <Input id="scrimmage-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="任意" />
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
  )
}

function CreateShootingDialog({ createGame, players }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [memo, setMemo] = useState('')
  const [gameDate, setGameDate] = useState(todayStr())
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleOpenChange(next) {
    if (next) {
      setMemo('')
      setGameDate(todayStr())
      setSelectedPlayerIds([])
      setError('')
    }
    setOpen(next)
  }

  function togglePlayer(playerId) {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (selectedPlayerIds.length === 0) {
      setError('シューティングを行う選手を選択してください')
      return
    }
    setSaving(true)
    setError('')
    try {
      const game = await createGame({ opponentName: memo, gameDate })
      setOpen(false)
      navigate(`/shooting/${game.id}`, { state: { playerIds: selectedPlayerIds } })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" />
        シューティングを追加
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>シューティングを追加</DialogTitle>
          <DialogDescription>
            コートをタップしてゾーンごとの試投数・成功数をまとめて記録します(公式スタッツには反映されません)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shooting-date">日付</Label>
            <Input id="shooting-date" type="date" required value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shooting-memo">メモ (任意)</Label>
            <Input id="shooting-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例: 朝練シュート" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>シューティングを行う選手(複数選択可)</Label>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">先に選手を登録してください</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto -mx-1 px-1">
                {players.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedPlayerIds.includes(p.id)}
                      onCheckedChange={() => togglePlayer(p.id)}
                    />
                    {p.number != null ? `#${p.number} ` : ''}
                    {p.name}
                  </label>
                ))}
              </div>
            )}
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
  )
}

export function Practice({ teamId }) {
  const location = useLocation()
  const { games: scrimmages, createGame: createScrimmage } = useGames(teamId, 'practice')
  const { games: shootingSessions, createGame: createShooting } = useGames(teamId, 'shooting')
  const { players } = usePlayers(teamId)
  // useGamesは日付の新しい順に返すため、先頭5件が直近のワークアウトになる
  const recentShootingSessions = shootingSessions.slice(0, 5)
  // シューティング画面で「ワークアウトを完了する」を押した直後だけ表示する完了メッセージ
  const [flashMessage, setFlashMessage] = useState(location.state?.flashMessage ?? null)

  return (
    <div className="flex flex-col gap-6">
      {flashMessage && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm text-primary">
          <span>{flashMessage}</span>
          <button onClick={() => setFlashMessage(null)} aria-label="閉じる" className="shrink-0">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-heading tracking-wide">PRACTICE</h1>
        <p className="text-xs text-muted-foreground mt-1">
          ここで記録した内容は公式スタッツ(TEAM/個人記録)には反映されません
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">スクリメージ</h2>
          <CreateScrimmageDialog createGame={createScrimmage} />
        </div>
        {scrimmages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">まだスクリメージが登録されていません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {scrimmages.map((game) => (
              <li key={game.id}>
                <Link
                  to={`/games/${game.id}`}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{game.opponent_name ? `vs ${game.opponent_name}` : 'スクリメージ'}</p>
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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">シューティング(直近5件)</h2>
          <CreateShootingDialog createGame={createShooting} players={players} />
        </div>
        {recentShootingSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">まだシューティング記録がありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentShootingSessions.map((session) => (
              <li key={session.id}>
                <Link
                  to={`/shooting/${session.id}`}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{session.opponent_name || 'シューティング'}</p>
                    <p className="text-xs text-muted-foreground">{session.game_date}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
