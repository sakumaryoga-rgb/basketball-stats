import { cn } from '@/lib/utils'

// ヒーローカードの背景に敷く、ハーフコートのライン(装飾用)
export function CourtLines({ className }) {
  return (
    <svg
      viewBox="0 0 300 160"
      preserveAspectRatio="xMidYMid slice"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="100" y="-2" width="100" height="72" />
        <circle cx="150" cy="70" r="26" />
        <path d="M30 -2v40a120 120 0 0 0 240 0v-40" />
        <circle cx="150" cy="168" r="26" />
        <path d="M-2 168h304" />
      </g>
    </svg>
  )
}
