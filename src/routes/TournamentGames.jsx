import { useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, MapPin, Pencil, Plus, Shirt, Swords, Trash2 } from 'lucide-react'
import { useTournaments } from '@/hooks/useTournaments'
import { useGames } from '@/hooks/useGames'
import { usePlayers } from '@/hooks/usePlayers'
import { applyStartingLineup } from '@/hooks/useGameLineups'
import { initialLineup, sameStarters } from '@/lib/lineupDraft'
import { useTeamScoresByGame } from '@/hooks/useTeamScoresByGame'
import { summarizeRecord } from '@/lib/record'
import { GameScoreCard } from '@/components/fun/GameScoreCard'
import { EmptyState } from '@/components/fun/EmptyState'
import { DateTile } from '@/components/fun/DateTile'
import { ResultDots } from '@/components/fun/ResultDots'
import { GameSetupSheet, OpponentField, SetupSection } from '@/components/fun/GameSetupSheet'
import { LineupEditor } from '@/components/fun/LineupEditor'
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

// 1つの大会に属する試合の一覧。大会単位でGAMEタブから遷移してくる。
// 日程・会場は大会作成時に入力済みのため、試合追加時は対戦相手のみ入力すればよい
export function TournamentGames({ teamId }) {
  const { tournamentId } = useParams()
  const navigate = useNavigate()
  const { tournaments, updateTournament, deleteTournament } = useTournaments(teamId)
  const { games, createGame } = useGames(teamId, 'official', tournamentId)
  const tournament = tournaments.find((t) => t.id === tournamentId)
  const teamScoresByGameId = useTeamScoresByGame(games.map((g) => g.id))
  const record = useMemo(() => summarizeRecord(games, teamScoresByGameId), [games, teamScoresByGameId])

  const [open, setOpen] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { players } = usePlayers(teamId)
  const roster = useMemo(() => players.filter((p) => !p.guest_game_id), [players])
  // STARTING FIVE / RESERVEの下書き。nullの間は(選手の読み込み後も)DBトリガーと同じ初期状態を表示する
  const [lineupDraft, setLineupDraft] = useState(null)
  const lineup = lineupDraft ?? initialLineup(roster)
  const [lineupWarning, setLineupWarning] = useState('')
  const sheetBodyRef = useRef(null)

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
      const game = await createGame({
        opponentName,
        gameDate: tournament.game_date,
        location: tournament.location,
        periodSystem: tournament.period_system,
      })
      // STARTING FIVEを初期状態から変えた場合だけ、作成後のgame_lineupsに反映する
      if (!sameStarters(lineup, initialLineup(roster))) {
        try {
          await applyStartingLineup(game.id, lineup.starters)
        } catch (lineupErr) {
          console.error('STARTING FIVEの反映に失敗しました', lineupErr)
          setLineupWarning(`「vs ${opponentName}」のSTARTING FIVEを反映できませんでした。試合画面の選手交代で設定してください`)
        }
      }
      setOpponentName('')
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleOpenChange(next) {
    if (next) {
      setOpponentName('')
      setLineupDraft(null)
      setError('')
      setLineupWarning('')
    }
    setOpen(next)
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
        <div className="flex min-w-0 items-center gap-3">
          <DateTile date={tournament.game_date} />
          <div className="min-w-0">
            <h1 className="text-2xl font-heading tracking-wide truncate leading-tight">{tournament.name}</h1>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              {tournament.location && (
                <>
                  <MapPin className="size-3 shrink-0" />
                  {tournament.location} ・{' '}
                </>
              )}
              {tournament.period_system === '2q' ? '2Q制' : '4Q制'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" onClick={() => handleOpenChange(true)}>
            <Plus className="size-4" />
            試合を追加
          </Button>
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

      {lineupWarning && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{lineupWarning}</p>
      )}

      <GameSetupSheet
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow="NEW GAME"
        title="試合を追加"
        description={`${tournament.name} の試合を追加します`}
        onSubmit={handleCreate}
        submitLabel="試合を作成"
        savingLabel="作成中..."
        saving={saving}
        error={error}
        bodyRef={sheetBodyRef}
      >
        <SetupSection icon={Swords} title="MATCHUP" sub="日程・会場・クォーター制は大会の設定を使います">
          <OpponentField
            id="opponent-name"
            label="対戦相手"
            required
            value={opponentName}
            onChange={setOpponentName}
            placeholder="ここにチーム名を入力"
          />
          <div className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5">
            <DateTile date={tournament.game_date} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{tournament.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {tournament.location && (
                  <>
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{tournament.location}</span>
                  </>
                )}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 font-heading text-xs tracking-wider text-secondary-foreground">
              {tournament.period_system === '2q' ? '2Q制' : '4Q制'}
            </span>
          </div>
        </SetupSection>
        <SetupSection icon={Shirt} title="LINEUP" sub="この試合のSTARTING FIVE(PLAYERSタブの設定が初期値)">
          <LineupEditor players={roster} value={lineup} onChange={setLineupDraft} scrollRef={sheetBodyRef} />
        </SetupSection>
      </GameSetupSheet>

      {games.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 animate-rise-in">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-[10px] tracking-[0.2em] text-muted-foreground">RECORD</span>
            <span className="font-heading text-xl tabular-nums leading-none">
              {record.wins}-{record.losses}
              {record.ties > 0 ? `-${record.ties}` : ''}
            </span>
          </div>
          {record.form.length > 0 ? (
            <ResultDots results={record.form} />
          ) : (
            <span className="text-xs text-muted-foreground">{games.length}試合 登録済み</span>
          )}
        </div>
      )}

      {games.length === 0 ? (
        <EmptyState title="まだ試合が登録されていません" description="「試合を追加」で対戦相手を登録するとここに並びます" />
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((game, i) => (
            <li key={game.id}>
              <GameScoreCard
                game={game}
                teamScore={teamScoresByGameId[game.id]}
                to={`/games/${game.id}`}
                title={`vs ${game.opponent_name}`}
                showDate={false}
                index={i}
              />
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
