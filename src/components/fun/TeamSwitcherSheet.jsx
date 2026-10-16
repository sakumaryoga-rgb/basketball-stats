import { Link } from 'react-router-dom'
import { Check, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet'

// 所属チームの切り替え用ボトムシート。切り替えは「表示するチームを変える」だけで、
// team_members(所属情報)には一切触れない(退出はTEAM画面下部の別操作)
export function TeamSwitcherSheet({ open, onOpenChange, teams, activeTeamId, onSwitch }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-3xl px-4 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mt-1 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
        <SheetHeader className="px-0 pb-0">
          <p className="font-heading text-[10px] tracking-[0.2em] text-primary">MY TEAMS</p>
          <SheetTitle className="font-heading text-2xl tracking-wide">チームを切り替える</SheetTitle>
          <SheetDescription>表示するチームを選びます。切り替えても他のチームから退出することはありません。</SheetDescription>
        </SheetHeader>
        <ul className="flex max-h-[50svh] flex-col gap-2 overflow-y-auto">
          {teams.map((t, i) => {
            const active = t.id === activeTeamId
            return (
              <li key={t.id} className="animate-rise-in" style={{ '--i': i }}>
                <button
                  type="button"
                  onClick={() => onSwitch(t.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'press flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left',
                    active ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'bg-card hover:bg-muted/50'
                  )}
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={t.icon_url} alt={t.name} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">{t.name?.[0] ?? 'B'}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{t.name}</span>
                    <span className={cn('block text-[11px]', active ? 'text-primary font-medium' : 'text-muted-foreground')}>
                      {active ? '表示中のチーム' : 'タップで切り替え'}
                    </span>
                  </span>
                  {active ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-4" />
                    </span>
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <SheetClose
          render={
            <Link
              to="/onboarding?add=1"
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm font-medium text-muted-foreground hover:bg-muted/50"
            />
          }
        >
          <Plus className="size-4" />
          別のチームを作成・参加する
        </SheetClose>
      </SheetContent>
    </Sheet>
  )
}
