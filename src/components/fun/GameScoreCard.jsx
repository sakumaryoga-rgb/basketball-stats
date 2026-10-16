import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { gameResult } from '@/lib/record'
import { ResultBadge } from '@/components/fun/ResultDots'

const STRIPE = {
  W: 'bg-lime-400',
  L: 'bg-red-500',
  T: 'bg-gray-300',
  live: 'bg-primary',
  scheduled: 'bg-border',
}

function StatusPill({ game, result }) {
  if (game.status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 font-heading text-[10px] tracking-wider leading-none text-primary-foreground">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
        </span>
        LIVE
      </span>
    )
  }
  if (game.status === 'scheduled') {
    return (
      <span className="rounded-full border px-1.5 py-0.5 font-heading text-[10px] tracking-wider leading-none text-muted-foreground">
        UPCOMING
      </span>
    )
  }
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 font-heading text-[10px] tracking-wider leading-none text-muted-foreground">
      FINAL{result === 'W' ? ' · WIN' : result === 'L' ? ' · LOSE' : result === 'T' ? ' · DRAW' : ''}
    </span>
  )
}

// 試合1件を電光掲示板風に見せるカード(GAMES大会内の試合・PRACTICEのスクリメージ共通)
export function GameScoreCard({ game, teamScore, to, title, showDate = true, index = 0 }) {
  const result = gameResult(game, teamScore)
  const stripe = result ? STRIPE[result] : game.status === 'in_progress' ? STRIPE.live : STRIPE.scheduled
  const hasScore = game.status !== 'scheduled'
  const ours = teamScore ?? 0
  const theirs = game.opponent_score ?? 0

  return (
    <Link
      to={to}
      className="press animate-rise-in relative flex overflow-hidden rounded-xl border bg-card shadow-xs hover:shadow-md"
      style={{ '--i': index }}
    >
      <span className={cn('w-1.5 shrink-0', stripe)} />
      <div className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <StatusPill game={game} result={result} />
          <p className="mt-1 font-medium truncate">{title}</p>
          {showDate && (
            <p className="text-xs text-muted-foreground truncate">
              {game.game_date}
              {game.location ? ` ・ ${game.location}` : ''}
            </p>
          )}
        </div>
        {hasScore ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-lg bg-secondary px-2.5 py-1.5 font-heading text-2xl leading-none tabular-nums text-secondary-foreground shadow-inner">
              <span className={cn(result === 'W' && 'text-lime-300', result === 'L' && 'opacity-70')}>{ours}</span>
              <span className="mx-1.5 text-base opacity-40">-</span>
              <span className={cn(result === 'L' && 'text-red-300', result === 'W' && 'opacity-70')}>{theirs}</span>
            </div>
            {result && <ResultBadge result={result} />}
          </div>
        ) : (
          <span className="shrink-0 rounded-lg border border-dashed px-2.5 py-1.5 font-heading text-lg leading-none text-muted-foreground">
            VS
          </span>
        )}
      </div>
    </Link>
  )
}
