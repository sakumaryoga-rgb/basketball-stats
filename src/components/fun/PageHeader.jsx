// 各タブ共通の見出し。Antonの大きなタイトルに、赤いアクセントのライン(コートのライン風)を添える
export function PageHeader({ title, eyebrow, children }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-heading tracking-[0.2em] text-primary leading-none mb-1">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-heading tracking-wide leading-none truncate">{title}</h1>
        <div className="mt-2 flex items-center gap-1">
          <span className="h-1 w-8 rounded-full bg-primary" />
          <span className="h-1 w-2 rounded-full bg-secondary" />
          <span className="h-1 w-1 rounded-full bg-chart-3" />
        </div>
      </div>
      {children && <div className="flex items-center gap-1 shrink-0">{children}</div>}
    </div>
  )
}
