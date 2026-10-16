import { cn } from '@/lib/utils'

// 背番号入りのタンクトップ型ジャージ。写真がない選手の顔の代わりにもなる
export function Jersey({ number, color = 'var(--primary)', className }) {
  const label = number ?? '?'
  const long = String(label).length >= 3
  return (
    <svg viewBox="0 0 64 64" className={cn('size-12', className)} aria-hidden="true">
      <path
        d="M20 4h7c1 4 3 6 5 6s4-2 5-6h7l1 10c0 4 3 7 7 8v38H12V22c4-1 7-4 7-8z"
        fill={color}
        stroke="white"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M27 4c1 4 3 6 5 6s4-2 5-6" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="2" />
      <text
        x="32"
        y="47"
        textAnchor="middle"
        fontFamily="Anton, sans-serif"
        fontSize={long ? 18 : 24}
        fill="white"
      >
        {label}
      </text>
    </svg>
  )
}
