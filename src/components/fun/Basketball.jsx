import { cn } from '@/lib/utils'

// 空状態・見出しの飾りに使う、シンプルなバスケットボールのアイコン
export function Basketball({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-8', className)} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="oklch(0.7 0.17 50)" />
      <g fill="none" stroke="oklch(0.3 0.06 45)" strokeWidth="2" strokeLinecap="round">
        <circle cx="24" cy="24" r="22" />
        <path d="M24 2v44M2 24h44" />
        <path d="M9 8.5c5 4 8 9.5 8 15.5s-3 11.5-8 15.5" />
        <path d="M39 8.5c-5 4-8 9.5-8 15.5s3 11.5 8 15.5" />
      </g>
      <ellipse cx="16" cy="13" rx="5" ry="2.5" fill="white" opacity="0.25" transform="rotate(-35 16 13)" />
    </svg>
  )
}
