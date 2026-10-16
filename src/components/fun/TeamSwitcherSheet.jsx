import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { TeamPickerList } from '@/components/fun/TeamPickerList'
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
        <TeamPickerList teams={teams} activeTeamId={activeTeamId} onSelect={onSwitch} className="max-h-[50svh] overflow-y-auto" />
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
