import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Jersey } from '@/components/fun/Jersey'
import { formatPositions } from '@/lib/stats'
import { COURT_SLOTS, assignStartersToSlots, positionColor } from '@/lib/positionStyle'

// STARTING FIVEをハーフコートの上に並べて、誰がどこを守るのかをひと目で分かるようにする
export function StartingCourt({ starters, onPickStarter }) {
  const slots = assignStartersToSlots(starters)
  return (
    <div
      className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl shadow-md animate-rise-in"
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
              className="press animate-rise-in absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={style}
            >
              <span className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-white bg-white/25 text-white">
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
            className="press animate-rise-in absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={style}
          >
            <span className="relative">
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
