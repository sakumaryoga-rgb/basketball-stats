import { cn } from '@/lib/utils'

// ゲスト(その試合限定の選手)のユニフォーム色。チームの選手のポジション色と被らない無彩色
export const GUEST_COLOR = 'oklch(0.55 0.02 255)'

// ゲストであることを示す小さなタグ
export function GuestTag({ className }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-dashed border-current px-1.5 font-heading text-[9px] leading-4 tracking-wider',
        className
      )}
    >
      GUEST
    </span>
  )
}
