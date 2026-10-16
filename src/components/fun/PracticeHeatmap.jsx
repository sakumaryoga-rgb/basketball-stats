import { useMemo } from 'react'
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseLocalDate, toDateStr } from '@/lib/dates'

const WEEKS = 6
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

function mondayOf(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

// 練習(スクリメージ+シューティング)の日付から、直近6週間の練習カレンダーと
// 今月の回数・連続練習週数を出すヒーローカード。体育館の床(ウッド)をイメージした背景
export function PracticeHeatmap({ sessions }) {
  const { weeks, monthCount, weekStreak, total } = useMemo(() => {
    const now = new Date()
    const countByDate = new Map()
    for (const s of sessions) countByDate.set(s.game_date, (countByDate.get(s.game_date) ?? 0) + 1)

    const todayStr = toDateStr(now)
    const start = mondayOf(now)
    start.setDate(start.getDate() - 7 * (WEEKS - 1))
    const weeks = []
    for (let w = 0; w < WEEKS; w++) {
      const days = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setDate(start.getDate() + w * 7 + d)
        const key = toDateStr(date)
        days.push({ key, count: countByDate.get(key) ?? 0, isToday: key === todayStr, isFuture: key > todayStr })
      }
      weeks.push(days)
    }

    const monthPrefix = todayStr.slice(0, 7)
    const monthCount = sessions.filter((s) => s.game_date?.startsWith(monthPrefix)).length

    // 今週から遡って、練習のある週が何週続いているか(今週がまだ0回なら先週から数える)
    const weekKeys = new Set(sessions.map((s) => toDateStr(mondayOf(parseLocalDate(s.game_date)))))
    const cursor = mondayOf(now)
    if (!weekKeys.has(toDateStr(cursor))) cursor.setDate(cursor.getDate() - 7)
    let weekStreak = 0
    while (weekKeys.has(toDateStr(cursor))) {
      weekStreak++
      cursor.setDate(cursor.getDate() - 7)
    }
    return { weeks, monthCount, weekStreak, total: sessions.length }
  }, [sessions])

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 text-[oklch(0.3_0.06_55)] shadow-md animate-rise-in"
      style={{
        background:
          'repeating-linear-gradient(90deg, oklch(0.86 0.07 70) 0 38px, oklch(0.83 0.075 68) 38px 40px), oklch(0.86 0.07 70)',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-[10px] tracking-[0.2em] opacity-70">THIS MONTH</p>
          <p className="font-heading text-5xl leading-none tabular-nums">
            {monthCount}
            <span className="ml-1 text-base">SESSIONS</span>
          </p>
          <p className="mt-1 text-[11px] opacity-80">通算 {total} 回の練習を記録</p>
        </div>
        <div className="flex flex-col items-center rounded-xl bg-white/50 px-3 py-2 backdrop-blur-sm">
          <Flame className={cn('size-5', weekStreak > 0 ? 'text-primary' : 'opacity-30')} />
          <span className="font-heading text-2xl leading-none tabular-nums">{weekStreak}</span>
          <span className="font-heading text-[9px] tracking-widest opacity-70">WEEK STREAK</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white/45 p-2.5 backdrop-blur-sm">
        <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-medium opacity-60 mb-1">
          {DAY_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {weeks.map((days, w) => (
            <div key={w} className="grid grid-cols-7 gap-1">
              {days.map((day) => (
                <div
                  key={day.key}
                  title={`${day.key} ${day.count}回`}
                  className={cn(
                    'aspect-[5/2] rounded-[4px] flex items-center justify-center transition-colors',
                    day.isFuture
                      ? 'bg-transparent border border-dashed border-[oklch(0.3_0.06_55)]/15'
                      : day.count === 0
                        ? 'bg-white/70'
                        : day.count === 1
                          ? 'bg-primary/65'
                          : 'bg-primary',
                    day.isToday && 'ring-2 ring-secondary ring-offset-1 ring-offset-transparent'
                  )}
                >
                  {day.count > 0 && <span className="size-1 rounded-full bg-white/90" />}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[9px] opacity-60">
          <span>少</span>
          <span className="size-2.5 rounded-[3px] bg-white/70" />
          <span className="size-2.5 rounded-[3px] bg-primary/65" />
          <span className="size-2.5 rounded-[3px] bg-primary" />
          <span>多</span>
        </div>
      </div>
    </div>
  )
}
