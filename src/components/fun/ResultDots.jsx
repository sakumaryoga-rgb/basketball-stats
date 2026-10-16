import { cn } from '@/lib/utils'

const RESULT_STYLE = {
  W: 'bg-lime-400 text-lime-950',
  L: 'bg-red-500 text-white',
  T: 'bg-gray-300 text-gray-700',
}

export function ResultBadge({ result, className, style }) {
  return (
    <span
      style={style}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full font-heading text-xs leading-none',
        RESULT_STYLE[result],
        className
      )}
    >
      {result}
    </span>
  )
}

// 直近の勝敗の並び(フォーム)。左が古く右が新しい順で渡す
export function ResultDots({ results, size = 'sm', className }) {
  if (!results?.length) return null
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {results.map((r, i) => (
        <ResultBadge
          key={i}
          result={r}
          className={cn(size === 'xs' ? 'size-4 text-[9px]' : 'size-5 text-[10px]', 'animate-rise-in')}
          style={{ '--i': i }}
        />
      ))}
    </div>
  )
}
