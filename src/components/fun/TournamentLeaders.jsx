import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { teamRoster } from '@/lib/roster'
import { positionColor } from '@/lib/positionStyle'
import { TOURNAMENT_LEADER_CATEGORIES, rankLeaders } from '@/lib/tournamentLeaders'
import { useTournamentPlayerTotals } from '@/hooks/useTournamentPlayerTotals'
import { PlayerIcon } from '@/components/fun/PlayerIcon'
import { formatAvg } from '@/lib/stats'
import { cn } from '@/lib/utils'

const RANK_STYLE = {
  1: 'bg-[oklch(0.8_0.16_85)] text-[oklch(0.28_0.08_75)]', // 金
  2: 'bg-[oklch(0.82_0.005_0)] text-[oklch(0.3_0_0)]', // 銀
  3: 'bg-[oklch(0.68_0.13_50)] text-[oklch(0.99_0_0)]', // 銅
}

// 大会(TOURNAMENTS)内の全試合の1試合平均で見る「本日のスタッツリーダー」。
// 得点・リバウンド・アシスト・スティール・ブロックを切り替えて1〜3位を表示する。
// ゲスト選手(その試合限定の助っ人)はLEADERSと同じく対象外
export function TournamentLeaders({ gameIds, players }) {
  const { totals, loading } = useTournamentPlayerTotals(gameIds)
  const [category, setCategory] = useState(TOURNAMENT_LEADER_CATEGORIES[0].key)
  const playersById = useMemo(() => new Map(teamRoster(players).map((p) => [p.id, p])), [players])
  const { rows, tiedOthers } = useMemo(() => rankLeaders(totals, category, playersById), [totals, category, playersById])
  const active = TOURNAMENT_LEADER_CATEGORIES.find((c) => c.key === category)

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-secondary p-3 text-secondary-foreground shadow-md animate-rise-in">
      <div className="px-1">
        <h2 className="whitespace-nowrap font-heading text-base tracking-[0.2em]">TODAY'S LEADERS</h2>
        <p className="text-[11px] text-white/60">本日のスタッツリーダー・大会の1試合平均</p>
      </div>

      <div role="tablist" aria-label="スタッツの種類" className="grid grid-cols-5 gap-1 rounded-xl bg-white/10 p-1">
        {TOURNAMENT_LEADER_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={category === c.key}
            aria-label={c.label}
            onClick={() => setCategory(c.key)}
            className={cn(
              'press min-h-9 rounded-lg font-heading text-xs tracking-wider transition-colors',
              category === c.key ? 'bg-primary text-primary-foreground shadow' : 'text-white/70 hover:bg-white/10'
            )}
          >
            {c.short}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="px-1 py-4 text-center text-xs text-white/60">
          {loading ? '読み込み中...' : `まだ${active.label}の記録がありません`}
        </p>
      ) : (
        <ol key={category} className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li key={row.player.id} className="animate-rise-in" style={{ '--i': i }}>
              <Link
                to={`/players/${row.player.id}`}
                className="press flex items-center gap-3 rounded-xl bg-white/5 px-2.5 py-2 hover:bg-white/10"
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full font-heading text-sm tabular-nums',
                    RANK_STYLE[row.rank]
                  )}
                >
                  {row.rank}
                </span>
                <PlayerIcon player={row.player} color={positionColor(row.player.position)} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-bold">
                    {row.rank === 1 && <Crown className="size-3.5 shrink-0 fill-chart-3 text-chart-3" />}
                    <span className="truncate">
                      {row.player.number != null ? `#${row.player.number} ` : ''}
                      {row.player.name}
                    </span>
                  </p>
                  <p className="text-[10px] text-white/60">{row.games_played}試合出場</p>
                </div>
                <p className={cn('font-heading tabular-nums leading-none', row.rank === 1 ? 'text-3xl text-chart-3' : 'text-2xl')}>
                  {formatAvg(row.value)}
                  <span className="ml-1 text-[10px] tracking-wider text-white/60">{active.short}</span>
                </p>
              </Link>
            </li>
          ))}
          {tiedOthers > 0 && (
            <li className="px-1 text-right text-[11px] text-white/60">
              ほか{tiedOthers}人が同じ{formatAvg(rows[rows.length - 1].value)}
              {active.short}
            </li>
          )}
        </ol>
      )}
    </section>
  )
}
