import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/dates'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// チケットの半券のような日付タイル(月・日・曜日)
export function DateTile({ date, className, tone = 'default' }) {
  const d = parseLocalDate(date)
  if (!d) return null
  return (
    <div
      className={cn(
        'flex w-12 shrink-0 flex-col items-center justify-center rounded-md py-1.5 leading-none',
        tone === 'default' ? 'bg-muted' : 'bg-white/10',
        className
      )}
    >
      <span className="font-heading text-[10px] tracking-wider text-primary">{MONTHS[d.getMonth()]}</span>
      <span className="font-heading text-2xl tabular-nums">{d.getDate()}</span>
      <span className="text-[9px] font-medium text-muted-foreground tracking-wider">{WEEKDAYS[d.getDay()]}</span>
    </div>
  )
}
