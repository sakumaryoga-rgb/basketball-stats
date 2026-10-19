import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Hand, MapPinned, Plus, Search, Star, UserRound, Users } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { teamRoster } from '@/lib/roster'
import { useOtherTeamPlayers } from '@/hooks/useOtherTeamPlayers'
import { POSITIONS, UNSET_POSITION, formatPositions, groupPlayersByPosition } from '@/lib/stats'
import { positionColor } from '@/lib/positionStyle'
import { PageHeader } from '@/components/fun/PageHeader'
import { EmptyState } from '@/components/fun/EmptyState'
import { LoadingState } from '@/components/fun/LoadingState'
import { StartingCourt } from '@/components/fun/StartingCourt'
import { Jersey } from '@/components/fun/Jersey'
import { PlayerIcon } from '@/components/fun/PlayerIcon'
import { GameSetupSheet, SetupField, SetupSection } from '@/components/fun/GameSetupSheet'
import { useLongPressDrag } from '@/hooks/useLongPressDrag'
import { PlayerPhotoField } from '@/components/fun/PlayerPhotoField'
import { applyPlayerPhotoChange } from '@/lib/uploadPlayerPhoto'
import { createPortal } from 'react-dom'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PositionSelect } from '@/components/PositionSelect'
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

function AddPlayerDialog({ teamId, teams, addPlayer }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('new')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [position, setPosition] = useState('')
  const [position2, setPosition2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState({ displayUrl: null, blob: null, removed: false })
  const { players: otherPlayers, loading: otherLoading } = useOtherTeamPlayers(teams, teamId)

  function reset() {
    setName('')
    setNumber('')
    setPosition('')
    setPosition2('')
    setError('')
    setMode('new')
    setPhoto({ displayUrl: null, blob: null, removed: false })
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      // 画像は任意。選んでいれば先にアップロードしてから選手を登録する(選手IDはまだ無いので仮のフォルダ)
      const photoUrl = await applyPlayerPhotoChange({ folder: `new-${crypto.randomUUID()}`, photo, currentUrl: null })
      await addPlayer({ name, number: number ? Number(number) : null, position, position2, photoUrl: photoUrl ?? null })
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

  function handleOpenChange(next) {
    if (!next) reset()
    setOpen(next)
  }

  return (
    <>
      <Button size="sm" onClick={() => handleOpenChange(true)}>
        <Plus className="size-4" />
        選手を追加
      </Button>
      <GameSetupSheet
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow="NEW PLAYER"
        title="選手を追加"
        description="ロスターに新しい選手を登録します"
        onSubmit={mode === 'new' ? handleAdd : (e) => e.preventDefault()}
        submitLabel={mode === 'new' ? '追加する' : undefined}
        savingLabel="追加中..."
        saving={saving}
        error={error}
      >
        {teams.length > 1 && (
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist">
            {[
              { key: 'new', label: '新規登録' },
              { key: 'existing', label: '既存の選手から追加' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={mode === t.key}
                onClick={() => setMode(t.key)}
                className={cn(
                  'min-h-10 rounded-lg text-sm font-bold transition-colors',
                  mode === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {mode === 'new' ? (
          <>
            <SetupSection icon={UserRound} title="PROFILE">
              <PlayerPhotoField value={photo} onChange={setPhoto} number={number} color={positionColor(position)} />
              <SetupField id="player-name" label="名前">
                <Input id="player-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田太郎" className="h-11 rounded-xl text-base" />
              </SetupField>
              <SetupField id="player-number" label="背番号">
                <Input id="player-number" type="number" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="例: 7" className="h-11 rounded-xl text-base" />
              </SetupField>
            </SetupSection>
            <SetupSection icon={MapPinned} title="POSITION">
              <SetupField id="player-position" label="ポジション">
                <PositionSelect id="player-position" value={position} onChange={setPosition} className="h-11 w-full rounded-xl text-base" />
              </SetupField>
              <SetupField id="player-position2" label="ポジション(第2)">
                <PositionSelect id="player-position2" value={position2} onChange={setPosition2} className="h-11 w-full rounded-xl text-base" />
              </SetupField>
            </SetupSection>
          </>
        ) : (
          <SetupSection icon={Users} title="OTHER TEAMS" sub="所属している他のチームの選手を、このチームにも登録します">
            {otherLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">読み込み中...</p>
            ) : otherPlayers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">他のチームに選手が登録されていません</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {otherPlayers.map((p) => (
                  <li key={p.id} className="flex min-h-14 items-center gap-3 rounded-xl border bg-background px-3 py-2">
                    <Avatar className="size-9 shrink-0 text-xs font-medium">
                      <AvatarImage src={p.photo_url} alt={p.name} />
                      <AvatarFallback className="tabular-nums">{p.number ?? '-'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.teams?.name}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg" disabled={saving} onClick={() => handleAddExisting(p)}>
                      追加
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SetupSection>
        )}
      </GameSetupSheet>
    </>
  )
}

function PositionChip({ position }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-heading text-[10px] tracking-wider leading-none text-white"
      style={{ background: positionColor(position) }}
    >
      {position}
    </span>
  )
}

function PlayerFace({ player, className }) {
  if (player.photo_url) {
    return (
      <Avatar className={cn('size-12 shrink-0', className)}>
        <AvatarImage src={player.photo_url} alt={player.name} />
        <AvatarFallback className="tabular-nums">{player.number ?? '-'}</AvatarFallback>
      </Avatar>
    )
  }
  return <Jersey number={player.number} color={positionColor(player.position)} className={cn('size-12 shrink-0', className)} />
}

// ROSTERの選手カード。上部の帯でポジション、右上の★でSTARTING FIVEかどうかが一目で分かる
function RosterCard({ player, index, onToggleStarter }) {
  const starter = player.is_starter
  return (
    <li
      className={cn(
        'press animate-rise-in relative overflow-hidden rounded-xl border bg-card shadow-xs',
        starter && 'border-chart-3 ring-2 ring-chart-3/50'
      )}
      style={{ '--i': index }}
    >
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: positionColor(player.position) }} />
      <span className="pointer-events-none absolute -right-1 bottom-0 font-heading text-6xl leading-none text-foreground/[0.06] tabular-nums">
        {player.number ?? ''}
      </span>
      <Link to={`/players/${player.id}`} className="flex flex-col items-start gap-2 p-3 pt-4">
        <PlayerFace player={player} />
        <div className="w-full min-w-0 pr-1">
          <p className="text-[10px] font-heading tracking-wider text-muted-foreground leading-none">
            {player.number != null ? `#${player.number}` : 'NO NUMBER'}
          </p>
          <p className="mt-0.5 text-sm font-bold truncate">{player.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-1 min-h-4">
            {player.position ? <PositionChip position={player.position} /> : <span className="text-[10px] text-muted-foreground">ポジション未設定</span>}
            {player.position2 && <PositionChip position={player.position2} />}
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onToggleStarter}
        aria-pressed={starter}
        aria-label={starter ? 'STARTING FIVEから外す' : 'STARTING FIVEに入れる'}
        className={cn(
          'absolute right-1 top-2.5 flex size-11 items-center justify-center rounded-full transition-all active:scale-90',
          starter ? 'bg-chart-3 text-[oklch(0.28_0.08_75)] shadow' : 'bg-muted text-muted-foreground hover:text-foreground'
        )}
      >
        <Star className={cn('size-4', starter && 'fill-current animate-check-pop')} />
      </button>
    </li>
  )
}

function StarterPips({ count }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'size-2.5 rounded-full transition-colors duration-300',
            i < count ? 'bg-chart-3 shadow-[0_0_0_2px_oklch(0.8_0.16_85/0.3)]' : 'bg-muted-foreground/25'
          )}
        />
      ))}
    </div>
  )
}

export function Players({ teamId, teams = [] }) {
  const { players: allPlayers, loading: playersLoading, addPlayer, updatePlayer } = usePlayers(teamId)
  const players = teamRoster(allPlayers)
  const [viewMode, setViewMode] = useState('starting') // 'starting' | 'roster'
  const [positionFilter, setPositionFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  // STARTING FIVEが5人埋まっている状態で6人目をONにしようとした選手。
  // nullでなければ「誰と入れ替えるか」の選択ダイアログを表示する
  const [swapTarget, setSwapTarget] = useState(null)

  const normalizedSearch = search.trim().toLowerCase()
  const filteredPlayers = useMemo(
    () => (normalizedSearch ? players.filter((p) => p.name.toLowerCase().includes(normalizedSearch)) : players),
    [players, normalizedSearch]
  )

  const positionGroups = useMemo(() => groupPlayersByPosition(filteredPlayers), [filteredPlayers])
  // STARTING FIVEの人数(5人制限の判定)は検索結果に関わらず常に全選手基準で数える
  const starters = useMemo(() => players.filter((p) => p.is_starter), [players])
  const startersCount = starters.length
  const allGroups = useMemo(() => groupPlayersByPosition(players), [players])
  const countByPosition = useMemo(() => Object.fromEntries(allGroups.map((g) => [g.key, g.players.length])), [allGroups])
  const rosterPlayers =
    positionFilter === 'ALL'
      ? filteredPlayers
      : (positionGroups.find((g) => g.key === positionFilter)?.players ?? [])

  // STARTINGタブのドラッグ&ドロップで変えた先発(is_starter)を、保存の完了を待たずに表示へ反映する上書き。
  // ROSTERタブの★で変えた場合は空に戻し、DBの値をそのまま使う
  const [starterOverrides, setStarterOverrides] = useState({})
  const isStarter = (p) => (p.id in starterOverrides ? starterOverrides[p.id] : !!p.is_starter)
  const courtStarters = players.filter(isStarter).slice(0, 5)
  const reservePlayers = players.filter((p) => !courtStarters.includes(p))
  const courtStarterIds = new Set(courtStarters.map((p) => p.id))

  async function applyStarterChanges(changes) {
    setStarterOverrides((prev) => ({ ...prev, ...changes }))
    try {
      await Promise.all(Object.entries(changes).map(([id, value]) => updatePlayer(id, { is_starter: value })))
    } catch (err) {
      console.error('STARTING FIVEの更新に失敗しました', err)
      setStarterOverrides((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(changes)) delete next[id]
        return next
      })
    }
  }

  // ドロップ先: 'court'(コートの余白) / 'slot:PG'(空き枠) / 'player:<id>'(選手) / 'reserve'(RESERVEの列)
  function canDropOn(dragId, dropKey) {
    const fromCourt = courtStarterIds.has(dragId)
    if (dropKey.startsWith('player:')) {
      const otherId = dropKey.slice(7)
      return otherId !== dragId && courtStarterIds.has(otherId) !== fromCourt
    }
    if (dropKey === 'reserve') return fromCourt
    // コートへ入れられるのは、RESERVEの選手で、かつ先発が5人未満のときだけ(5人なら選手の上で入れ替え)
    return !fromCourt && courtStarters.length < 5
  }

  function handleDrop(dragId, dropKey) {
    if (!canDropOn(dragId, dropKey)) return
    const fromCourt = courtStarterIds.has(dragId)
    if (dropKey.startsWith('player:')) {
      const otherId = dropKey.slice(7)
      applyStarterChanges({ [dragId]: !fromCourt, [otherId]: fromCourt })
    } else if (dropKey === 'reserve') {
      applyStarterChanges({ [dragId]: false })
    } else {
      applyStarterChanges({ [dragId]: true })
    }
  }

  const { drag, bind, rootRef } = useLongPressDrag({ onDrop: handleDrop })
  const draggedPlayer = drag ? players.find((p) => p.id === drag.id) : null
  const draggingFromCourt = drag ? courtStarterIds.has(drag.id) : false
  const courtDnd = { bind, drag, canDropOn: (key) => (drag ? canDropOn(drag.id, key) : false) }

  async function handleToggleStarter(player) {
    setStarterOverrides({})
    if (!player.is_starter && startersCount >= 5) {
      setSwapTarget(player)
      return
    }
    await updatePlayer(player.id, { is_starter: !player.is_starter })
  }

  async function handleSwap(outgoingPlayer) {
    if (!swapTarget) return
    setStarterOverrides({})
    const incomingPlayer = swapTarget
    setSwapTarget(null)
    await Promise.all([
      updatePlayer(outgoingPlayer.id, { is_starter: false }),
      updatePlayer(incomingPlayer.id, { is_starter: true }),
    ])
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="PLAYERS" eyebrow={players.length > 0 ? `${players.length} ON THE ROSTER` : 'ROSTER'}>
        <AddPlayerDialog teamId={teamId} teams={teams} addPlayer={addPlayer} />
      </PageHeader>

      {players.length > 0 && (
        <div className="relative grid grid-cols-2 rounded-xl bg-muted p-1">
          <span
            className={cn(
              'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-secondary shadow transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]',
              viewMode === 'roster' && 'translate-x-full'
            )}
          />
          {[
            { key: 'starting', label: 'STARTING' },
            { key: 'roster', label: 'ROSTER' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setViewMode(tab.key)}
              className={cn(
                'relative z-10 py-2.5 font-heading text-sm tracking-wider transition-colors',
                viewMode === tab.key ? 'text-secondary-foreground' : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {players.length === 0 && playersLoading ? (
        <LoadingState />
      ) : players.length === 0 ? (
        <EmptyState title="まだ選手が登録されていません" description="「選手を追加」からチームのメンバーを登録しましょう" />
      ) : viewMode === 'roster' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
            <div className="leading-none">
              <p className="font-heading text-xs tracking-wider">STARTING FIVE</p>
              <p className="mt-1 text-[10px] text-muted-foreground">★で選択(試合追加時のデフォルト)</p>
            </div>
            <div className="flex items-center gap-2">
              <StarterPips count={startersCount} />
              <span className="font-heading text-lg tabular-nums leading-none">{startersCount}/5</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="選手名で検索" className="pl-9" />
          </div>

          <div data-no-pull-refresh className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none]">
            {['ALL', ...POSITIONS, UNSET_POSITION]
              .filter((key) => key === 'ALL' || countByPosition[key])
              .map((key) => {
                const active = positionFilter === key
                const color = key === 'ALL' ? 'var(--secondary)' : positionColor(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPositionFilter(key)}
                    className={cn(
                      'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 font-heading text-xs tracking-wider transition-all active:scale-95',
                      active ? 'text-white border-transparent shadow' : 'bg-background text-muted-foreground'
                    )}
                    style={active ? { background: color } : undefined}
                  >
                    {!active && <span className="size-2 rounded-full" style={{ background: color }} />}
                    {key}
                    <span className={cn('tabular-nums', active ? 'opacity-80' : 'opacity-60')}>
                      {key === 'ALL' ? players.length : countByPosition[key]}
                    </span>
                  </button>
                )
              })}
          </div>

          {rosterPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">該当する選手が見つかりません</p>
          ) : (
            <ul key={positionFilter} className="grid grid-cols-2 gap-2">
              {rosterPlayers.map((player, i) => (
                <RosterCard key={player.id} player={player} index={i} onToggleStarter={() => handleToggleStarter(player)} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div ref={rootRef} className="flex flex-col gap-4">
          <p className="-mb-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Hand className="size-3.5" />
            長押ししてコートとRESERVEの間で運ぶと入れ替えられます
          </p>
          <StartingCourt starters={courtStarters} onPickStarter={() => setViewMode('roster')} dnd={courtDnd} />
          {courtStarters.length < 5 && (
            <p className="text-xs text-muted-foreground text-center -mt-2">
              空いている枠をタップするとROSTERから選べます。RESERVEの選手を運んで入れることもできます
            </p>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <h2 className="font-heading text-xs tracking-[0.2em] text-muted-foreground">RESERVE</h2>
              <span className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs tabular-nums text-muted-foreground">{reservePlayers.length}</span>
            </div>
            <ul
              data-no-pull-refresh
              data-drop="reserve"
              className={cn(
                'flex min-h-24 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain scroll-px-1 rounded-2xl px-1 py-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] transition-shadow',
                draggingFromCourt && 'bg-primary/5 ring-2 ring-primary/60 ring-inset'
              )}
            >
              {reservePlayers.length === 0 && (
                <li className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                  {draggingFromCourt ? 'ここで離すとRESERVEへ' : 'RESERVEの選手はいません'}
                </li>
              )}
              {reservePlayers.map((player, i) => {
                const over = drag?.over === `player:${player.id}` && courtDnd.canDropOn(`player:${player.id}`)
                return (
                  <li key={player.id} className="animate-rise-in shrink-0 snap-start" style={{ '--i': i }}>
                    <Link
                      to={`/players/${player.id}`}
                      draggable={false}
                      {...bind(player.id)}
                      data-drop={`player:${player.id}`}
                      className={cn(
                        'press flex w-20 select-none flex-col items-center gap-1 rounded-xl border bg-card px-1.5 py-2 transition-[opacity,box-shadow] [-webkit-touch-callout:none]',
                        drag?.id === player.id && 'opacity-40',
                        over && 'ring-2 ring-chart-3'
                      )}
                    >
                      <PlayerFace player={player} className="size-10" />
                      <span className="w-full truncate text-center text-[11px] font-medium">{player.name}</span>
                      <span className="font-heading text-[9px] tracking-wider text-muted-foreground leading-none">
                        {formatPositions(player.position, player.position2) || '-'}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
          {drag?.moved &&
            draggedPlayer &&
            createPortal(
              <div
                aria-hidden
                className="pointer-events-none fixed z-[100] flex flex-col items-center"
                style={{ left: 0, top: 0, transform: `translate3d(${drag.x - 28}px, ${drag.y - 64}px, 0) rotate(-4deg)` }}
              >
                <PlayerIcon player={draggedPlayer} color={positionColor(draggedPlayer.position)} className="size-14 drop-shadow-xl" />
                <span className="-mt-1 max-w-28 truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground shadow ring-2 ring-chart-3">
                  {draggedPlayer.name}
                </span>
              </div>,
              document.body
            )}
        </div>
      )}

      <Dialog open={!!swapTarget} onOpenChange={(o) => !o && setSwapTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>どの選手と入れ替えますか?</DialogTitle>
            <DialogDescription>
              STARTING FIVEは5人までです。{swapTarget?.name}を追加するには、他の1人と入れ替えてください。
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {starters.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => handleSwap(player)}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
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
                </button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
