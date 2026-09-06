import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers } from '@/hooks/usePlayers'
import { usePeriodStats } from '@/hooks/usePeriodStats'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { LEADER_CATEGORIES, LEADER_PERIODS, formatAvg, formatPct, pct, perGame } from '@/lib/stats'
import { cn } from '@/lib/utils'

const RANK_STYLE = [
  'bg-[oklch(0.8_0.16_85)] text-[oklch(0.28_0.08_75)]', // 金
  'bg-[oklch(0.82_0.005_0)] text-[oklch(0.3_0_0)]', // 銀
  'bg-[oklch(0.68_0.13_50)] text-[oklch(0.99_0_0)]', // 銅
]

export function Leaders({ teamId }) {
  const { players } = usePlayers(teamId)
  const [period, setPeriod] = useState('season')
  const { periodStats } = usePeriodStats(teamId, period)
  const [category, setCategory] = useState(LEADER_CATEGORIES[0].key)

  const activeCategory = LEADER_CATEGORIES.find((c) => c.key === category)

  const ranking = useMemo(() => {
    const playersById = new Map(players.map((p) => [p.id, p]))
    const list = periodStats
      .filter((s) => s.games_played > 0)
      .map((s) => {
        const player = playersById.get(s.player_id)
        let value
        if (activeCategory.type === 'avg') {
          value = perGame(s[activeCategory.key], s.games_played)
        } else {
          value = pct(s[activeCategory.made], s[activeCategory.att])
        }
        return { player, value, games_played: s.games_played }
      })
      .filter((row) => row.player && row.value !== null)
      .sort((a, b) => b.value - a.value)

    return list
  }, [players, periodStats, activeCategory])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-heading tracking-wide">LEADERS</h1>

      <div className="flex flex-wrap gap-2">
        {LEADER_PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              period === p.key ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-background hover:bg-muted'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {LEADER_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              category === c.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">まだデータがありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ranking.map((row, i) => (
            <li key={row.player.id}>
              <Link
                to={`/players/${row.player.id}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50"
              >
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                    RANK_STYLE[i] ?? 'bg-muted text-muted-foreground'
                  )}
                >
                  {i + 1}
                </div>
                <Avatar className="size-8 shrink-0 text-xs font-medium">
                  <AvatarImage src={row.player.photo_url} alt={row.player.name} />
                  <AvatarFallback className="tabular-nums">{row.player.number ?? '-'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {row.player.number != null ? `#${row.player.number} ` : ''}
                    {row.player.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.games_played}試合</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-primary">
                  {activeCategory.type === 'avg' ? formatAvg(row.value) : formatPct(row.value)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
