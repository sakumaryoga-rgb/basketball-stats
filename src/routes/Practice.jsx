import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, Plus, Shirt, Swords, Target, X } from 'lucide-react'
import { useGames } from '@/hooks/useGames'
import { useTeamScoresByGame } from '@/hooks/useTeamScoresByGame'
import { PageHeader } from '@/components/fun/PageHeader'
import { EmptyState } from '@/components/fun/EmptyState'
import { LoadingState } from '@/components/fun/LoadingState'
import { GameScoreCard } from '@/components/fun/GameScoreCard'
import { PracticeHeatmap } from '@/components/fun/PracticeHeatmap'
import { WinRing } from '@/components/fun/WinRing'
import { DateTile } from '@/components/fun/DateTile'
import { usePlayers } from '@/hooks/usePlayers'
import { teamRoster } from '@/lib/roster'
import { useGameSetupDraft } from '@/hooks/useGameSetupDraft'
import { finishGameSetup } from '@/lib/gameSetup'
import { GameSetupSheet, OpponentField, PlayerToggleList, SetupField, SetupSection } from '@/components/fun/GameSetupSheet'
import { PlayerIcon } from '@/components/fun/PlayerIcon'
import { positionColor } from '@/lib/positionStyle'
import { saveShootingParticipants } from '@/lib/shootingParticipants'
import { LineupEditor } from '@/components/fun/LineupEditor'
import { GuestDraftField } from '@/components/fun/GuestDraftField'
import { useShootingParticipants } from '@/hooks/useShootingParticipants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function CreateScrimmageDialog({ createGame, players, addPlayer, onLineupWarning }) {
  const [open, setOpen] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [gameDate, setGameDate] = useState(todayStr())
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const roster = useMemo(() => teamRoster(players), [players])
  const draft = useGameSetupDraft(roster)
  const bodyRef = useRef(null)

  function handleOpenChange(next) {
    if (next) {
      draft.reset()
      setError('')
      onLineupWarning('')
    }
    setOpen(next)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (draft.startersError) {
      setError(draft.startersError)
      return
    }
    setSaving(true)
    setError('')
    try {
      const game = await createGame({ opponentName, gameDate, location })
      // 作成画面で追加したゲストの登録と、変更したSTARTING FIVEの反映
      const warning = await finishGameSetup({
        gameId: game.id,
        roster,
        lineup: draft.lineup,
        draftGuests: draft.draftGuests,
        addPlayer,
      })
      if (warning) onLineupWarning(`スクリメージは作成しました。${warning}`)
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
    <>
      <Button size="sm" onClick={() => handleOpenChange(true)}>
        <Plus className="size-4" />
        スクリメージを追加
      </Button>
      <GameSetupSheet
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow="NEW SCRIMMAGE"
        title="スクリメージを追加"
        description="GAME同様に記録できますが、公式スタッツ(TEAM/個人記録)には反映されません"
        onSubmit={handleCreate}
        submitLabel="スクリメージを作成"
        savingLabel="作成中..."
        saving={saving}
        error={error}
        bodyRef={bodyRef}
      >
        <SetupSection icon={Swords} title="MATCHUP">
          <OpponentField
            id="scrimmage-opponent"
            label="対戦相手 (任意)"
            value={opponentName}
            onChange={setOpponentName}
            placeholder="例: 紅白戦"
          />
        </SetupSection>
        <SetupSection icon={CalendarDays} title="DATE & PLACE">
          <div className="flex flex-col gap-3">
            <SetupField id="scrimmage-date" label="日付">
              <Input id="scrimmage-date" type="date" required value={gameDate} onChange={(e) => setGameDate(e.target.value)} className="h-11 rounded-xl text-base" />
            </SetupField>
            <SetupField id="scrimmage-location" label="会場">
              <Input id="scrimmage-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="任意" className="h-11 rounded-xl text-base" />
            </SetupField>
          </div>
        </SetupSection>
        <SetupSection icon={Shirt} title="LINEUP" sub="このスクリメージのSTARTING FIVE(PLAYERSタブの設定が初期値)とゲスト">
          <LineupEditor players={draft.editorPlayers} value={draft.lineup} onChange={draft.setLineupDraft} scrollRef={bodyRef} />
          <GuestDraftField guests={draft.draftGuests} onAdd={draft.addGuest} onRemove={draft.removeGuest} />
        </SetupSection>
      </GameSetupSheet>
    </>
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
      // 参加メンバーを保存しておき、記録画面を開き直してもこのメンバーだけを表示する
      saveShootingParticipants(game.id, selectedPlayerIds)
      setOpen(false)
      navigate(`/shooting/${game.id}`, { state: { playerIds: selectedPlayerIds } })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => handleOpenChange(true)}>
        <Plus className="size-4" />
        シューティングを追加
      </Button>
      <GameSetupSheet
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow="NEW SHOOTING"
        title="シューティングを追加"
        description="コートをタップしてゾーンごとの試投数・成功数をまとめて記録します(公式スタッツには反映されません)"
        onSubmit={handleCreate}
        submitLabel={selectedPlayerIds.length > 0 ? `${selectedPlayerIds.length}人で作成する` : '作成する'}
        savingLabel="作成中..."
        saving={saving}
        error={error}
      >
        <SetupSection icon={CalendarDays} title="DATE & MEMO">
          <div className="flex flex-col gap-3">
            <SetupField id="shooting-date" label="日付">
              <Input id="shooting-date" type="date" required value={gameDate} onChange={(e) => setGameDate(e.target.value)} className="h-11 rounded-xl text-base" />
            </SetupField>
            <SetupField id="shooting-memo" label="メモ (任意)">
              <Input id="shooting-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例: 朝練シュート" className="h-11 rounded-xl text-base" />
            </SetupField>
          </div>
        </SetupSection>
        <SetupSection icon={Target} title="PLAYERS" sub="シューティングを行う選手(複数選択可)。あとから記録画面で追加もできます">
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">先に選手を登録してください</p>
          ) : (
            <PlayerToggleList
              players={players}
              selectedIds={selectedPlayerIds}
              onToggle={togglePlayer}
              renderJersey={(p) => <PlayerIcon player={p} color={positionColor(p.position)} className="size-8 shrink-0" />}
            />
          )}
        </SetupSection>
      </GameSetupSheet>
    </>
  )
}

// 一覧の行に重ねて表示する参加選手アイコンの最大数。これを超える分は「+N」で示す
const MAX_VISIBLE_AVATARS = 3

// 左のアイコンが一番上に来るよう(左→右で徐々に奥へ)重ねて表示する
function ParticipantAvatars({ players }) {
  if (players.length === 0) return null
  const visible = players.slice(0, MAX_VISIBLE_AVATARS)
  const overflow = players.length - visible.length

  return (
    <div className="flex items-center shrink-0">
      {visible.map((p, i) => (
        <Avatar
          key={p.id}
          size="sm"
          className={cn('ring-2 ring-background', i > 0 && '-ml-2')}
          style={{ zIndex: visible.length - i }}
        >
          <AvatarImage src={p.photo_url} alt={p.name} />
          <AvatarFallback className="text-[10px]">{p.number ?? p.name?.[0] ?? '-'}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div
          className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-background -ml-2"
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 leading-none">
          <h2 className="font-heading text-lg tracking-wide leading-none">{title}</h2>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// 成功率に応じてリングの色を変える(よく入った日は金色でちょっと特別感を出す)
function ringColor(rate) {
  if (rate == null) return 'var(--muted-foreground)'
  if (rate >= 0.5) return 'var(--chart-3)'
  if (rate >= 0.35) return 'var(--primary)'
  return 'var(--secondary)'
}

export function Practice({ teamId }) {
  const location = useLocation()
  const { games: scrimmages, loading: scrimmagesLoading, createGame: createScrimmage } = useGames(teamId, 'practice')
  const { games: shootingSessions, loading: shootingLoading, createGame: createShooting } = useGames(teamId, 'shooting')
  const { players: allPlayers, addPlayer } = usePlayers(teamId)
  // usePlayersは過去の試合のゲストも含むため、シューティングの選手選択や新しい試合の
  // 初期ロスターにはチームの恒久的なロスターだけを渡す
  const players = useMemo(() => teamRoster(allPlayers), [allPlayers])
  const [scrimmageLineupWarning, setScrimmageLineupWarning] = useState('')
  // useGamesは日付の新しい順に返すため、先頭5件が直近のワークアウトになる
  const recentShootingSessions = shootingSessions.slice(0, 5)
  // 追加時に選んだだけの選手ではなく、実際にshooting_entriesへ記録がある選手だけを参加者とする
  const summaryByGame = useShootingParticipants(recentShootingSessions.map((s) => s.id))
  const scrimmageScores = useTeamScoresByGame(
    scrimmages.map((g) => g.id),
    'player_practice_game_stats'
  )
  const playersById = new Map(players.map((p) => [p.id, p]))
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
        <PageHeader title="PRACTICE" eyebrow="GRIND TIME" />
        <p className="text-xs text-muted-foreground mt-2">
          ここで記録した内容は公式スタッツ(TEAM/個人記録)には反映されません
        </p>
      </div>

      <PracticeHeatmap sessions={[...scrimmages, ...shootingSessions]} />

      <div className="flex flex-col gap-3">
        <SectionHeader icon={Swords} title="SCRIMMAGE" sub="スクリメージ">
          <CreateScrimmageDialog createGame={createScrimmage} players={players} addPlayer={addPlayer} onLineupWarning={setScrimmageLineupWarning} />
        </SectionHeader>
        {scrimmageLineupWarning && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{scrimmageLineupWarning}</p>
        )}
        {scrimmages.length === 0 && scrimmagesLoading ? (
          <LoadingState />
        ) : scrimmages.length === 0 ? (
          <EmptyState title="まだスクリメージが登録されていません" description="紅白戦や練習試合もGAME同様に記録できます" />
        ) : (
          <ul className="flex flex-col gap-2">
            {scrimmages.map((game, i) => (
              <li key={game.id}>
                <GameScoreCard
                  game={game}
                  teamScore={scrimmageScores[game.id]}
                  to={`/games/${game.id}`}
                  title={game.opponent_name ? `vs ${game.opponent_name}` : 'スクリメージ'}
                  index={i}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeader icon={Target} title="SHOOTING" sub="シューティング(直近5件)">
          <CreateShootingDialog createGame={createShooting} players={players} />
        </SectionHeader>
        {recentShootingSessions.length === 0 && shootingLoading ? (
          <LoadingState />
        ) : recentShootingSessions.length === 0 ? (
          <EmptyState title="まだシューティング記録がありません" description="コートをタップしてゾーンごとの成功数を記録しよう" />
        ) : (
          <ul className="flex flex-col gap-2">
            {recentShootingSessions.map((session, i) => {
              const summary = summaryByGame[session.id]
              const participants = (summary?.participants ?? []).map((id) => playersById.get(id)).filter(Boolean)
              const rate = summary?.attempts ? summary.makes / summary.attempts : null
              return (
                <li key={session.id}>
                  <Link
                    to={`/shooting/${session.id}`}
                    className="press animate-rise-in flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-xs hover:shadow-md"
                    style={{ '--i': i }}
                  >
                    <DateTile date={session.game_date} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.opponent_name || 'シューティング'}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {summary?.attempts ? (
                          <>
                            <span className="font-heading text-sm text-foreground">{summary.makes}</span>
                            <span className="mx-0.5">/</span>
                            {summary.attempts} 本成功
                          </>
                        ) : (
                          'まだ記録がありません'
                        )}
                      </p>
                      <div className="mt-1.5">
                        <ParticipantAvatars players={participants} />
                      </div>
                    </div>
                    <WinRing value={rate} size={52} stroke={5} color={ringColor(rate)} track="var(--foreground)">
                      <span className="font-heading text-sm tabular-nums">
                        {rate == null ? '-' : Math.round(rate * 100)}
                        {rate != null && <span className="text-[8px]">%</span>}
                      </span>
                      <span className="font-heading text-[7px] tracking-widest text-muted-foreground">FG</span>
                    </WinRing>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
