import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers } from '@/hooks/usePlayers'
import { teamRoster } from '@/lib/roster'
import { usePeriodStats } from '@/hooks/usePeriodStats'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { LEADER_CATEGORIES, LEADER_PERIODS, formatAvg, formatPct, pct, perGame } from '@/lib/stats'
import { cn } from '@/lib/utils'
import { Crown } from 'lucide-react'
import { PageHeader } from '@/components/fun/PageHeader'
import { EmptyState } from '@/components/fun/EmptyState'
import { LoadingState } from '@/components/fun/LoadingState'
import { Jersey } from '@/components/fun/Jersey'
import { positionColor } from '@/lib/positionStyle'

const PODIUM = [
  { rank: 2, height: 'h-14', color: 'bg-[oklch(0.82_0.005_0)] text-[oklch(0.3_0_0)]' },
  { rank: 1, height: 'h-20', color: 'bg-[oklch(0.8_0.16_85)] text-[oklch(0.28_0.08_75)]' },
  { rank: 3, height: 'h-10', color: 'bg-[oklch(0.68_0.13_50)] text-[oklch(0.99_0_0)]' },
]

function LeaderFace({ player, className }) {
  if (player.photo_url) {
    return (
      <Avatar className={cn('size-12 ring-2 ring-background', className)}>
        <AvatarImage src={player.photo_url} alt={player.name} />
        <AvatarFallback className="tabular-nums">{player.number ?? '-'}</AvatarFallback>
      </Avatar>
    )
  }
  return <Jersey number={player.number} color={positionColor(player.position)} className={cn('size-12', className)} />
}

// 上位3人を表彰台に乗せて見せる
function Podium({ rows, format }) {
  return (
    <div className="grid grid-cols-3 items-end gap-2 rounded-2xl bg-secondary px-3 pt-4 text-secondary-foreground shadow-md overflow-hidden">
      {PODIUM.map(({ rank, height, color }, i) => {
        const row = rows[rank - 1]
        if (!row) return <div key={rank} />
        return (
          <Link key={rank} to={`/players/${row.player.id}`} className="press flex min-w-0 flex-col items-center">
            {rank === 1 && <Crown className="size-5 text-chart-3 fill-chart-3 animate-check-pop" />}
            <LeaderFace player={row.player} className={rank === 1 ? 'size-14' : 'size-11'} />
            <p className="mt-1 w-full truncate text-center text-xs font-bold">{row.player.name}</p>
            <p className={cn('font-heading tabular-nums leading-none mt-0.5', rank === 1 ? 'text-2xl text-chart-3' : 'text-lg')}>
              {format(row.value)}
            </p>
            <div
              className={cn('animate-podium-up mt-2 flex w-full items-start justify-center rounded-t-lg pt-1 font-heading text-xl', height, color)}
              style={{ '--i': i }}
            >
              {rank}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

const RANK_STYLE = [
  'bg-[oklch(0.8_0.16_85)] text-[oklch(0.28_0.08_75)]', // 金
  'bg-[oklch(0.82_0.005_0)] text-[oklch(0.3_0_0)]', // 銀
  'bg-[oklch(0.68_0.13_50)] text-[oklch(0.99_0_0)]', // 銅
]

export function Leaders({ teamId }) {
  const { players, loading: playersLoading } = usePlayers(teamId)
  const [period, setPeriod] = useState('season')
  // 既存の記録の大半が2Q制のため、デフォルトは2Q制で表示する
  const [periodSystem, setPeriodSystem] = useState('2q')
  const { periodStats, loading: statsLoading } = usePeriodStats(teamId, period, periodSystem)
  const [category, setCategory] = useState(LEADER_CATEGORIES[0].key)

  const activeCategory = LEADER_CATEGORIES.find((c) => c.key === category)
  const formatValue = (v) => (activeCategory.type === 'avg' ? formatAvg(v) : formatPct(v))

  const ranking = useMemo(() => {
    // ゲスト選手(その試合限定の助っ人)はリーダーボードには出さない
    const playersById = new Map(teamRoster(players).map((p) => [p.id, p]))
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
      <PageHeader title="LEADERS" eyebrow="HALL OF FAME">
        <div className="flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setPeriodSystem('2q')}
            className={cn(
              'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
              periodSystem === '2q' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            2Q制
          </button>
          <button
            type="button"
            onClick={() => setPeriodSystem('4q')}
            className={cn(
              'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
              periodSystem === '4q' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            4Q制
          </button>
        </div>
      </PageHeader>

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

      {ranking.length === 0 && (playersLoading || statsLoading) ? (
        <LoadingState />
      ) : ranking.length === 0 ? (
        <EmptyState title="まだデータがありません" description="試合を記録すると、ここにランキングが並びます" />
      ) : (
        <>
          <Podium key={`${category}-${period}-${periodSystem}`} rows={ranking} format={formatValue} />
          {ranking.length > 3 && (
            <ul key={`list-${category}-${period}-${periodSystem}`} className="flex flex-col gap-2">
              {ranking.slice(3).map((row, idx) => {
                const i = idx + 3
                const ratio = ranking[0].value > 0 ? row.value / ranking[0].value : 0
                return (
                  <li key={row.player.id} className="animate-rise-in" style={{ '--i': idx }}>
                    <Link
                      to={`/players/${row.player.id}`}
                      className="press flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 hover:shadow-md"
                    >
                      <div
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-full font-heading text-sm tabular-nums',
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
                        <p className="font-medium truncate text-sm">
                          {row.player.number != null ? `#${row.player.number} ` : ''}
                          {row.player.name}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="animate-bar-grow h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(4, ratio * 100)}%`, '--i': idx }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{row.games_played}試合</span>
                        </div>
                      </div>
                      <p className="font-heading text-xl tabular-nums text-primary">{formatValue(row.value)}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
