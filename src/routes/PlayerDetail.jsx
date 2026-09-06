import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Pencil, X } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { usePlayers } from '@/hooks/usePlayers'
import { uploadPlayerPhoto, deletePlayerPhoto } from '@/lib/uploadPlayerPhoto'
import { formatAvg, formatPct, pct, perGame } from '@/lib/stats'
import { formatMadeAttempt, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
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
      supabase.from('games').select('id, opponent_name, game_date, status').eq('team_id', teamId),
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
  const [heightCm, setHeightCm] = useState(player.height_cm ?? '')
  const [weightKg, setWeightKg] = useState(player.weight_kg ?? '')
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
      setHeightCm(player.height_cm ?? '')
      setWeightKg(player.weight_kg ?? '')
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
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
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
              <Input id="edit-position" value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-height">身長 (cm)</Label>
              <Input id="edit-height" type="number" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="例: 180" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-weight">体重 (kg)</Label>
              <Input id="edit-weight" type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="例: 75" />
            </div>
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

  const player = players.find((p) => p.id === id)

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
            {[player.position, player.height_cm ? `${player.height_cm}cm` : null, player.weight_kg ? `${player.weight_kg}kg` : null]
              .filter(Boolean)
              .join(' ・ ')}
          </p>
        </div>
        <EditProfileDialog player={player} updatePlayer={updatePlayer}>
          <Button variant="outline" size="icon-sm" aria-label="編集">
            <Pencil className="size-4" />
          </Button>
        </EditProfileDialog>
      </div>

      {season && season.games_played > 0 ? (
        <>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-3">1試合平均 ({season.games_played}試合)</p>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="PPG" value={formatAvg(averages.pts)} />
              <StatBlock label="RPG" value={formatAvg(averages.reb)} />
              <StatBlock label="APG" value={formatAvg(averages.ast)} />
              <StatBlock label="SPG" value={formatAvg(averages.stl)} />
              <StatBlock label="BPG" value={formatAvg(averages.blk)} />
              <StatBlock label="TOPG" value={formatAvg(averages.tov)} />
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

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-3">シーズン合計</p>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="PTS" value={season.pts} />
              <StatBlock label="REB" value={season.reb} />
              <StatBlock label="AST" value={season.ast} />
              <StatBlock label="STL" value={season.stl} />
              <StatBlock label="BLK" value={season.blk} />
              <StatBlock label="TO" value={season.tov} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">試合ごとの成績</p>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left font-normal py-2 pr-3 sticky left-0 bg-background">試合</th>
                    <th className="text-right font-normal py-2 px-2">PTS</th>
                    <th className="text-right font-normal py-2 px-2">REB</th>
                    <th className="text-right font-normal py-2 px-2">AST</th>
                    <th className="text-right font-normal py-2 px-2">FG</th>
                    <th className="text-right font-normal py-2 px-2">3P</th>
                    <th className="text-right font-normal py-2 pl-2">FT</th>
                  </tr>
                </thead>
                <tbody>
                  {gameLog.map((row) => (
                    <tr key={row.game_id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap sticky left-0 bg-background">
                        <Link to={`/games/${row.game_id}`} className="hover:underline">
                          {formatDate(row.game.game_date)} vs {row.game.opponent_name}
                        </Link>
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums font-medium">{row.pts}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.reb}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{row.ast}</td>
                      <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{formatMadeAttempt(row.fgm, row.fga)}</td>
                      <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{formatMadeAttempt(row.tpm, row.tpa)}</td>
                      <td className="text-right py-2 pl-2 tabular-nums whitespace-nowrap">{formatMadeAttempt(row.ftm, row.fta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">まだ試合の記録がありません</p>
      )}
    </div>
  )
}
