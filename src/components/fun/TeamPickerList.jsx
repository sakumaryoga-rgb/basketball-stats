import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// 所属チームの一覧(TEAM画面の切り替えシートと、オンボーディングのJOIN TEAMで共通)。
// teamsは必ずuseTeams(=ログイン中の匿名ユーザーのteam_members)から渡すこと。
// localStorageの履歴は退出済みのチームを含みうるため、この一覧の根拠にしない。
// タップは「表示するチームを切り替える」だけで、参加処理(team_membersへのINSERT等)は行わない
export function TeamPickerList({ teams, activeTeamId, onSelect, className }) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {teams.map((t, i) => {
        const active = t.id === activeTeamId
        return (
          <li key={t.id} className="animate-rise-in" style={{ '--i': i }}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
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
  )
}
