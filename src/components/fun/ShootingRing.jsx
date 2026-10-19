import { WinRing } from '@/components/fun/WinRing'
import { cn } from '@/lib/utils'

// シュート成功率のリング(TEAMタブ・シューティング画面で共通)。
// split: { label, made, att, pct(0〜100の百分率 or null), invalid }。リングには0〜1の割合で渡す。
// onDark: 紺の背景の上に置くとき(白系の配色にする)
export function ShootingRing({ split, onDark = false, size = 64 }) {
  const { label, made, att, pct: value, invalid } = split
  return (
    <div className="flex flex-col items-center gap-1">
      <WinRing
        value={invalid || value == null ? 0 : value / 100}
        size={size}
        stroke={6}
        color={onDark ? 'var(--chart-3)' : 'var(--primary)'}
        track={onDark ? 'white' : 'var(--foreground)'}
      >
        <span className="font-heading text-base tabular-nums">
          {invalid ? '!' : value == null ? '-' : value.toFixed(1)}
          {!invalid && value != null && <span className="text-[8px]">%</span>}
        </span>
      </WinRing>
      <span className="font-heading text-[11px] tracking-widest">{label}</span>
      <span
        className={cn(
          'text-[10px] tabular-nums',
          invalid ? 'font-bold text-destructive' : onDark ? 'text-white/60' : 'text-muted-foreground'
        )}
      >
        {invalid ? `要確認 ${made}/${att}` : `${made}/${att}`}
      </span>
    </div>
  )
}
