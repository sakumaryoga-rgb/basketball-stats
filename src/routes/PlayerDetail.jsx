import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Pencil, X } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { usePlayers } from '@/hooks/usePlayers'
import { useShotChart } from '@/hooks/useShotChart'
import { usePracticeStats } from '@/hooks/usePracticeStats'
import { uploadPlayerPhoto, deletePlayerPhoto } from '@/lib/uploadPlayerPhoto'
import { formatAvg, formatClock, formatPct, formatPlusMinus, formatPositions, pct, perGame } from '@/lib/stats'
import { formatMadeAttempt, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PositionSelect } from '@/components/PositionSelect'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { HotZoneSection } from '@/components/HotZoneSection'
import { HotZoneChart } from '@/components/HotZoneChart'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

function usePlayerLog(playerId, teamId) {
  const [season, setSeason] = useState(null)
  const [gameLog, setGameLog] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!playerId || !teamId) return
    setLoading(true)
    const [seasonRes, statsRes, gamesRes] = await Promise.all([
      supabase.from('player_season_stats').select('*').eq('player_id', playerId).maybeSingle(),
      supabase.from('player_game_stats').select('*').eq('player_id', playerId),
      supabase.from('games').select('id, opponent_name, game_date, status, period_system').eq('team_id', teamId),
    ])
    if (seasonRes.error) console.error('シーズンスタッツの取得に失敗しました', seasonRes.error)
    if (statsRes.error) console.error('試合ごとのスタッツの取得に失敗しました', statsRes.error)
    if (gamesRes.error) console.error('試合一覧の取得に失敗しました', gamesRes.error)

    const gamesById = new Map((gamesRes.data ?? []).map((g) => [g.id, g]))
    setSeason(seasonRes.data ?? null)
    setGameLog(
      (statsRes.data ?? [])
        .filter((row) => gamesById.has(row.game_id))
        .map((row) => ({ ...row, game: gamesById.get(row.game_id) }))
        .sort((a, b) => (a.game.game_date < b.game.game_date ? 1 : -1))
    )
    setLoading(false)
  }, [playerId, teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!playerId) return
    const channel = supabase
      .channel(`player-log-${playerId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events', filter: `player_id=eq.${playerId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [playerId, refresh])

  return { season, gameLog, loading }
}

const PERIOD_SUM_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov']

function StatBlock({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function EditProfileDialog({ player, updatePlayer, children }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(player.name)
  const [number, setNumber] = useState(player.number ?? '')
  const [position, setPosition] = useState(player.position ?? '')
  const [position2, setPosition2] = useState(player.position2 ?? '')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(player.photo_url ?? '')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleOpenChange(next) {
    if (next) {
      setName(player.name)
      setNumber(player.number ?? '')
      setPosition(player.position ?? '')
      setPosition2(player.position2 ?? '')
      setPhotoFile(null)
      setPhotoPreview(player.photo_url ?? '')
      setRemovePhoto(false)
      setError('')
    }
    setOpen(next)
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setRemovePhoto(false)
  }

  function handleRemovePhoto() {
    setPhotoFile(null)
    setPhotoPreview('')
    setRemovePhoto(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let photoUrl = player.photo_url ?? null
      if (photoFile) {
        photoUrl = await uploadPlayerPhoto(player.id, photoFile)
        if (player.photo_url) await deletePlayerPhoto(player.photo_url)
      } else if (removePhoto) {
        if (player.photo_url) await deletePlayerPhoto(player.photo_url)
        photoUrl = null
      }
      await updatePlayer(player.id, {
        name,
        number: number ? Number(number) : null,
        position: position || null,
        position2: position2 || null,
        photo_url: photoUrl,
      })
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>プロフィールを編集</DialogTitle>
          <DialogDescription>選手の情報と写真を更新します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarImage src={photoPreview} alt={name} />
              <AvatarFallback className="text-base">{number || '-'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="player-photo">写真</Label>
              <Input id="player-photo" type="file" accept="image/*" onChange={handlePhotoChange} />
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="flex items-center gap-1 text-xs text-destructive self-start"
                >
                  <X className="size-3" />
                  写真を削除
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">名前</Label>
            <Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-number">背番号</Label>
              <Input id="edit-number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-position">ポジション</Label>
              <PositionSelect id="edit-position" value={position} onChange={setPosition} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-position2">ポジション(第2)</Label>
            <PositionSelect id="edit-position2" value={position2} onChange={setPosition2} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PlayerDetail({ teamId }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players, updatePlayer } = usePlayers(teamId)
  const { season, gameLog } = usePlayerLog(id, teamId)
  const { shots } = useShotChart(teamId, id)
  const practiceStats = usePracticeStats(teamId, id)
  const [statsMode, setStatsMode] = useState('official')
  // 既存の記録の大半が2Q制のため、デフォルトは2Q制で表示する
  const [periodMode, setPeriodMode] = useState('2q')

  const player = players.find((p) => p.id === id)

  const careerHigh = useMemo(() => {
    if (gameLog.length === 0) return null
    return gameLog.reduce((best, row) => (best === null || row.pts > best.pts ? row : best), null)
  }, [gameLog])

  // 「試合ごとの成績」に表示するのは直近5試合分のみ(gameLogは日付降順ソート済み)
  const recentGames = useMemo(() => gameLog.slice(0, 5), [gameLog])

  const averages = useMemo(() => {
    if (!season) return null
    const g = season.games_played
    return {
      pts: perGame(season.pts, g),
      reb: perGame(season.reb, g),
      ast: perGame(season.ast, g),
      stl: perGame(season.stl, g),
      blk: perGame(season.blk, g),
      tov: perGame(season.tov, g),
      fgPct: pct(season.fgm, season.fga),
      tpPct: pct(season.tpm, season.tpa),
      ftPct: pct(season.ftm, season.fta),
    }
  }, [season])

  // 「1試合平均」は大会の2Q制/4Q制で切り替えられるようにするため、season(全期間合算)とは
  // 別に、対象期間の試合(gameLog)だけをその場で合算して平均を出す
  const periodGames = useMemo(
    () => gameLog.filter((row) => row.game.period_system === periodMode),
    [gameLog, periodMode]
  )
  const periodAverages = useMemo(() => {
    const g = periodGames.length
    const sums = Object.fromEntries(PERIOD_SUM_KEYS.map((k) => [k, 0]))
    for (const row of periodGames) {
      for (const k of PERIOD_SUM_KEYS) sums[k] += row[k] ?? 0
    }
    return Object.fromEntries(PERIOD_SUM_KEYS.map((k) => [k, perGame(sums[k], g)]))
  }, [periodGames])

  if (!player) {
    return <p className="text-sm text-muted-foreground py-8 text-center">読み込み中...</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        戻る
      </button>

      <div className="flex items-center gap-3">
        <Avatar size="lg" className="size-12 text-lg font-medium">
          <AvatarImage src={player.photo_url} alt={player.name} />
          <AvatarFallback className="text-lg tabular-nums">{player.number ?? '-'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-medium">{player.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatPositions(player.position, player.position2)}
          </p>
        </div>
        <EditProfileDialog player={player} updatePlayer={updatePlayer}>
          <Button variant="outline" size="icon-sm" aria-label="編集">
            <Pencil className="size-4" />
          </Button>
        </EditProfileDialog>
      </div>

      <div className="flex rounded-lg border p-1">
        {[
          { key: 'official', label: 'OFFICIAL' },
          { key: 'practice', label: 'PRACTICE' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatsMode(tab.key)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
              statsMode === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {statsMode === 'official' && (season && season.games_played > 0 ? (
        <>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">1試合平均 ({periodGames.length}試合)</p>
              <div className="flex rounded-md border p-0.5">
                <button
                  type="button"
                  onClick={() => setPeriodMode('2q')}
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                    periodMode === '2q' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  2Q制
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodMode('4q')}
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                    periodMode === '4q' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  4Q制
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="PPG" value={formatAvg(periodAverages.pts)} />
              <StatBlock label="RPG" value={formatAvg(periodAverages.reb)} />
              <StatBlock label="APG" value={formatAvg(periodAverages.ast)} />
              <StatBlock label="SPG" value={formatAvg(periodAverages.stl)} />
              <StatBlock label="BPG" value={formatAvg(periodAverages.blk)} />
              <StatBlock label="TOPG" value={formatAvg(periodAverages.tov)} />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-3">シュート成功率</p>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="FG%" value={formatPct(averages.fgPct)} />
              <StatBlock label="3P%" value={formatPct(averages.tpPct)} />
              <StatBlock label="FT%" value={formatPct(averages.ftPct)} />
            </div>
          </div>

          <HotZoneSection shots={shots} />

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-3">シーズン合計</p>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="PTS" value={season.pts} />
              <StatBlock label="REB" value={season.reb} />
              <StatBlock label="AST" value={season.ast} />
              <StatBlock label="STL" value={season.stl} />
              <StatBlock label="BLK" value={season.blk} />
              <StatBlock label="TO" value={season.tov} />
              <StatBlock label={<span className="font-latin">+/-</span>} value={<span className="font-latin">{formatPlusMinus(season.plus_minus)}</span>} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">直近5試合</p>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left font-normal py-2 pr-3">試合</th>
                    <th className="text-right font-normal py-2 px-2">MIN</th>
                    <th className="text-right font-normal py-2 px-2">PTS</th>
                    <th className="text-right font-normal py-2 px-2">REB</th>
                    <th className="text-right font-normal py-2 px-2">AST</th>
                    <th className="text-right font-normal py-2 px-2">STL</th>
                    <th className="text-right font-normal py-2 px-2">BLK</th>
                    <th className="text-right font-normal py-2 px-2">TO</th>
                    <th className="text-right font-normal py-2 px-2">PF</th>
                    <th className="text-right font-normal py-2 px-2">FG</th>
                    <th className="text-right font-normal py-2 px-2">3P</th>
                    <th className="text-right font-normal py-2 px-2">FT</th>
                    <th className="text-right font-normal py-2 pl-2 font-latin">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGames.map((row) => (
                    <tr key={row.game_id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <Link to={`/games/${row.game_id}`} className="hover:underline">
                          {formatDate(row.game.game_date)} vs {row.game.opponent_name}
                        </Link>
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap text-muted-foreground">
                        {formatClock(row.seconds_played ?? 0)}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums font-medium">{row.pts}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.reb}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.ast}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.stl}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.blk}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.tov}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.pf}</td>
                      <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{formatMadeAttempt(row.fgm, row.fga)}</td>
                      <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{formatMadeAttempt(row.tpm, row.tpa)}</td>
                      <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{formatMadeAttempt(row.ftm, row.fta)}</td>
                      <td className="text-right py-2 pl-2 tabular-nums font-latin">{formatPlusMinus(row.plus_minus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {careerHigh && (
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-1">キャリアハイ (PTS)</p>
              <Link to={`/games/${careerHigh.game_id}`} className="text-sm font-medium hover:underline">
                {formatDate(careerHigh.game.game_date)} vs {careerHigh.game.opponent_name}
              </Link>
              <div className="grid grid-cols-3 gap-y-4 mt-3">
                <StatBlock label="PTS" value={careerHigh.pts} />
                <StatBlock label="REB" value={careerHigh.reb} />
                <StatBlock label="AST" value={careerHigh.ast} />
                <StatBlock label="STL" value={careerHigh.stl} />
                <StatBlock label="BLK" value={careerHigh.blk} />
                <StatBlock label="TO" value={careerHigh.tov} />
              </div>
              <div className="grid grid-cols-3 gap-y-4 mt-4 pt-4 border-t">
                <StatBlock label="FG" value={formatMadeAttempt(careerHigh.fgm, careerHigh.fga)} />
                <StatBlock label="3P" value={formatMadeAttempt(careerHigh.tpm, careerHigh.tpa)} />
                <StatBlock label="FT" value={formatMadeAttempt(careerHigh.ftm, careerHigh.fta)} />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">まだ試合の記録がありません</p>
      ))}

      {statsMode === 'practice' && (
        practiceStats.summary.fga === 0 && practiceStats.practiceGames.length === 0 && practiceStats.shootingSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">まだPRACTICEの記録がありません</p>
        ) : (
          <>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-3">シュート成功率 (スクリメージ+シューティング)</p>
              <div className="grid grid-cols-2 gap-y-4">
                <StatBlock label="FG%" value={formatPct(practiceStats.summary.fgPct)} />
                <StatBlock label="3P%" value={formatPct(practiceStats.summary.tpPct)} />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-3">ホットゾーン(フィールドゴール) ・ PRACTICE</p>
              {practiceStats.summary.fga === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">まだシュート位置の記録がありません</p>
              ) : (
                <HotZoneChart hotZones={practiceStats.hotZones} />
              )}
            </div>

            {practiceStats.practiceGames.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">スクリメージ (直近5試合)</p>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left font-normal py-2 pr-3">試合</th>
                        <th className="text-right font-normal py-2 px-2">MIN</th>
                        <th className="text-right font-normal py-2 px-2">PTS</th>
                        <th className="text-right font-normal py-2 px-2">REB</th>
                        <th className="text-right font-normal py-2 px-2">AST</th>
                        <th className="text-right font-normal py-2 px-2">FG</th>
                        <th className="text-right font-normal py-2 pl-2 font-latin">+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {practiceStats.practiceGames.slice(0, 5).map((row) => (
                        <tr key={row.game_id} className="border-b last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <Link to={`/games/${row.game_id}`} className="hover:underline">
                              {formatDate(row.game.game_date)}
                              {row.game.opponent_name ? ` vs ${row.game.opponent_name}` : ' スクリメージ'}
                            </Link>
                          </td>
                          <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap text-muted-foreground">
                            {formatClock(row.seconds_played ?? 0)}
                          </td>
                          <td className="text-right py-2 px-2 tabular-nums font-medium">{row.pts}</td>
                          <td className="text-right py-2 px-2 tabular-nums">{row.reb}</td>
                          <td className="text-right py-2 px-2 tabular-nums">{row.ast}</td>
                          <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{formatMadeAttempt(row.fgm, row.fga)}</td>
                          <td className="text-right py-2 pl-2 tabular-nums font-latin">{formatPlusMinus(row.plus_minus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {practiceStats.shootingSessions.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">シューティング</p>
                <ul className="flex flex-col gap-2">
                  {practiceStats.shootingSessions.map((session) => (
                    <li key={session.game.id}>
                      <Link
                        to={`/shooting/${session.game.id}`}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{session.game.opponent_name || 'シューティング'}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(session.game.game_date)}</p>
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {session.makes}/{session.attempts}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}
