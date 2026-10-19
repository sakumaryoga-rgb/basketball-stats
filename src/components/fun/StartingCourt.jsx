import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { Jersey } from '@/components/fun/Jersey'
import { formatPositions } from '@/lib/stats'
import { COURT_SLOTS, assignStartersToSlots, positionColor } from '@/lib/positionStyle'

// STARTING FIVEをハーフコートの上に並べて、誰がどこを守るのかをひと目で分かるようにする。
// dndを渡すと、選手を長押しで運んでRESERVEと入れ替えられる(PLAYERSタブ)。
// dnd: { bind(id), drag, canDropOn(dropKey) } — useLongPressDragの戻り値+ドロップ可否
export function StartingCourt({ starters, onPickStarter, dnd }) {
  const slots = assignStartersToSlots(starters)
  const drag = dnd?.drag
  const isOver = (key) => drag?.over === key && dnd.canDropOn(key)
  // RESERVEの選手を運んでいる間はコート全体を光らせ、置けることを示す
  const acceptsDrop = drag && dnd.canDropOn('court')
  return (
    <div
      data-drop={dnd ? 'court' : undefined}
      className={cn(
        'relative aspect-[5/4] w-full overflow-hidden rounded-2xl shadow-md animate-rise-in transition-shadow',
        acceptsDrop && 'ring-4 ring-chart-3 ring-offset-2 ring-offset-background'
      )}
      style={{
        background:
          'repeating-linear-gradient(90deg, oklch(0.84 0.075 68) 0 34px, oklch(0.81 0.08 66) 34px 36px), oklch(0.84 0.075 68)',
      }}
    >
      <svg viewBox="0 0 500 400" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <g fill="none" stroke="white" strokeWidth="4" strokeOpacity="0.9">
          <rect x="4" y="4" width="492" height="392" />
          <rect x="175" y="230" width="150" height="166" fill="oklch(0.55 0.215 25 / 0.25)" />
          <circle cx="250" cy="230" r="60" />
          <path d="M40 396V320M460 396V320" />
          <path d="M40 320a215 215 0 0 1 420 0" />
          <path d="M150 4a100 100 0 0 0 200 0" />
          <circle cx="250" cy="368" r="12" stroke="oklch(0.55 0.215 25)" />
          <path d="M220 386h60" />
        </g>
      </svg>
      <span className="absolute left-3 top-2.5 font-heading text-[10px] tracking-[0.2em] text-[oklch(0.3_0.06_55)]/70">
        STARTING FIVE
      </span>
      {COURT_SLOTS.map((slot, i) => {
        const player = slots[slot.key]
        const style = { left: `${slot.x}%`, top: `${slot.y}%`, '--i': i + 1 }
        if (!player) {
          return (
            <button
              key={slot.key}
              type="button"
              onClick={onPickStarter}
              data-drop={dnd ? `slot:${slot.key}` : undefined}
              className="press animate-rise-in absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={style}
            >
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-full border-2 border-dashed border-white bg-white/25 text-white transition-transform',
                  acceptsDrop && 'animate-pulse',
                  isOver(`slot:${slot.key}`) && 'scale-125 border-chart-3 bg-chart-3/60'
                )}
              >
                <Plus className="size-5" />
              </span>
              <span className="rounded-full bg-black/40 px-2 py-0.5 font-heading text-[10px] tracking-wider text-white">
                {slot.key}
              </span>
            </button>
          )
        }
        return (
          <Link
            key={slot.key}
            to={`/players/${player.id}`}
            draggable={false}
            {...(dnd ? dnd.bind(player.id) : {})}
            data-drop={dnd ? `player:${player.id}` : undefined}
            className={cn(
              'press animate-rise-in absolute flex w-24 -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center transition-opacity [-webkit-touch-callout:none]',
              drag?.id === player.id && 'opacity-40'
            )}
            style={style}
          >
            <span
              className={cn(
                'relative rounded-full transition-transform',
                isOver(`player:${player.id}`) && 'scale-110 ring-4 ring-chart-3'
              )}
            >
              <Jersey number={player.number} color={positionColor(player.position)} className="size-14 drop-shadow-md" />
              {player.photo_url && (
                <img
                  src={player.photo_url}
                  alt=""
                  className="absolute -right-2 -top-1 size-6 rounded-full object-cover ring-2 ring-white"
                />
              )}
            </span>
            <span className="-mt-1 max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground shadow">
              {player.name}
            </span>
            <span className="mt-0.5 font-heading text-[9px] tracking-wider text-[oklch(0.3_0.06_55)]">
              {formatPositions(player.position, player.position2) || slot.key}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
