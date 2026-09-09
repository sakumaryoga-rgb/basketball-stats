import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronDown } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useOtherTeamPlayers } from '@/hooks/useOtherTeamPlayers'
import { formatPositions, groupPlayersByPosition } from '@/lib/stats'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PositionSelect } from '@/components/PositionSelect'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'

function AddPlayerDialog({ teamId, teams, addPlayer }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('new')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [position, setPosition] = useState('')
  const [position2, setPosition2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { players: otherPlayers, loading: otherLoading } = useOtherTeamPlayers(teams, teamId)

  function reset() {
    setName('')
    setNumber('')
    setPosition('')
    setPosition2('')
    setError('')
    setMode('new')
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await addPlayer({ name, number: number ? Number(number) : null, position, position2 })
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
        position2: existing.position2,
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
                <PositionSelect id="player-position" value={position} onChange={setPosition} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="player-position2">ポジション(第2)</Label>
              <PositionSelect id="player-position2" value={position2} onChange={setPosition2} />
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

function PlayerRow({ player }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <Avatar className="size-9 shrink-0 text-sm font-medium">
        <AvatarImage src={player.photo_url} alt={player.name} />
        <AvatarFallback className="tabular-nums">{player.number ?? '-'}</AvatarFallback>
      </Avatar>
      <Link to={`/players/${player.id}`} className="flex-1 min-w-0">
        <p className="font-medium truncate">{player.name}</p>
        {player.position && (
          <p className="text-xs text-muted-foreground">{formatPositions(player.position, player.position2)}</p>
        )}
      </Link>
    </li>
  )
}

function RosterRow({ player, checked, disabled, onToggleStarter }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-lg transition-colors duration-300',
        player.is_starter && 'bg-primary/5'
      )}
    >
      <Link to={`/players/${player.id}`} className="flex flex-1 min-w-0 items-center gap-3 rounded-lg hover:bg-muted/50">
        <Avatar className="size-8 shrink-0 text-xs font-medium">
          <AvatarImage src={player.photo_url} alt={player.name} />
          <AvatarFallback className="tabular-nums">{player.number ?? '-'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{player.name}</p>
          {player.position && (
            <p className="text-xs text-muted-foreground">{formatPositions(player.position, player.position2)}</p>
          )}
        </div>
      </Link>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-muted-foreground">STARTING FIVE</span>
        <Switch checked={checked} onCheckedChange={onToggleStarter} disabled={disabled} />
      </div>
    </li>
  )
}

export function Players({ teamId, teams = [] }) {
  const { players: allPlayers, addPlayer, updatePlayer } = usePlayers(teamId)
  const players = allPlayers.filter((p) => !p.guest_game_id)
  const [viewMode, setViewMode] = useState('starting') // 'starting' | 'roster'
  const [openGroups, setOpenGroups] = useState({})

  const positionGroups = useMemo(() => groupPlayersByPosition(players), [players])
  const starters = useMemo(() => players.filter((p) => p.is_starter), [players])
  const startersCount = starters.length

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleToggleStarter(player) {
    if (!player.is_starter && startersCount >= 5) return
    await updatePlayer(player.id, { is_starter: !player.is_starter })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-wide">PLAYERS</h1>
        <AddPlayerDialog teamId={teamId} teams={teams} addPlayer={addPlayer} />
      </div>

      {players.length > 0 && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'starting' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setViewMode('starting')}
          >
            STARTING
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'roster' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setViewMode('roster')}
          >
            ROSTER
          </Button>
        </div>
      )}

      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">まだ選手が登録されていません</p>
      ) : viewMode === 'roster' ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground mb-2">
            STARTING FIVE(試合追加時のデフォルト) ・ {startersCount}/5人選択中
          </p>
          {positionGroups.map(({ key, players: groupPlayers }) => {
            const open = !!openGroups[key]
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  className="flex w-full items-center justify-between rounded-lg -mx-2 px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>
                    {key} ({groupPlayers.length}人)
                  </span>
                  <ChevronDown className={cn('size-4 transition-transform duration-300', open && 'rotate-180')} />
                </button>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-300 ease-in-out',
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    <ul className="flex flex-col gap-2 pt-2 pb-1">
                      {groupPlayers.map((player) => (
                        <RosterRow
                          key={player.id}
                          player={player}
                          checked={player.is_starter}
                          disabled={!player.is_starter && startersCount >= 5}
                          onToggleStarter={() => handleToggleStarter(player)}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : starters.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          まだSTARTING FIVEが選ばれていません。ROSTERタブから選択してください
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {starters.map((player) => (
            <PlayerRow key={player.id} player={player} />
          ))}
        </ul>
      )}
    </div>
  )
}
