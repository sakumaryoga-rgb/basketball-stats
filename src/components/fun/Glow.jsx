import { cn } from '@/lib/utils'

// ヒーローカード等の背景に置く、赤いぼんやりした光。以前はrounded-full + blur(CSS filter)で
// 描いていたが、iOS Safariでは角丸+overflow:hiddenの親の中にあるblur要素が四角い色の板として
// 透けて見えることがあったため、filterを使わない放射グラデーションで描く
export function Glow({ className, opacity = 0.35 }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute rounded-full', className)}
      style={{ background: `radial-gradient(closest-side, oklch(0.55 0.215 25 / ${opacity}), transparent)` }}
    />
  )
}
