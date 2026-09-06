import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers } from '@/hooks/usePlayers'
import { useSeasonStats } from '@/hooks/useSeasonStats'
import { LEADER_CATEGORIES, formatAvg, formatPct, pct, perGame } from '@/lib/stats'
import { cn } from '@/lib/utils'

const RANK_STYLE = [
  'bg-primary text-primary-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-foreground',
]

export function Leaders({ teamId }) {
  const { players } = usePlayers(teamId)
  const { seasonStats } = useSeasonStats(teamId)
  const [category, setCategory] = useState(LEADER_CATEGORIES[0].key)

  const activeCategory = LEADER_CATEGORIES.find((c) => c.key === category)

  const ranking = useMemo(() => {
    const playersById = new Map(players.map((p) => [p.id, p]))
    const list = seasonStats
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
  }, [players, seasonStats, activeCategory])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">スタッツリーダー</h1>

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
                    RANK_STYLE[i] ?? 'text-muted-foreground'
                  )}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {row.player.number != null ? `#${row.player.number} ` : ''}
                    {row.player.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.games_played}試合</p>
                </div>
                <p className="text-xl font-bold tabular-nums">
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
