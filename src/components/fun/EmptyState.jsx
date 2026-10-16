import { Basketball } from '@/components/fun/Basketball'

// 記録がまだ無いときの空状態。ボールが弾むだけの小さな演出で、寂しさを和らげる
export function EmptyState({ title, description, children }) {
  return (
    <div className="flex flex-col items-center text-center py-8 gap-1">
      <div className="relative h-16 w-12 flex flex-col items-center justify-end mb-2">
        <Basketball className="size-10 animate-ball-bounce" />
        <div className="mt-1 h-1.5 w-9 rounded-full bg-foreground/30 blur-[1px] animate-ball-shadow" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-64">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
