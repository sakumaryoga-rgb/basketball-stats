import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseLocalDate, toDateStr } from '@/lib/dates'

// 日本のカレンダーアプリと同じ日曜始まりにする(見慣れた並びと揃えるため)
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function sundayOf(d) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - s.getDay())
  return s
}

// 練習(スクリメージ+シューティング)を、実際の月間カレンダーに日付入りで並べるヒーローカード。
// 以前は「今日から遡る6週間」を日付なしで並べていたため、見出しの「今月」や
// 実際のカレンダーと対応が取れず分かりにくかった。体育館の床(ウッド)をイメージした背景
export function PracticeHeatmap({ sessions }) {
  // 表示中の月(0 = 今月、-1 = 先月 ...)。未来の月には進めない
  const [monthOffset, setMonthOffset] = useState(0)

  const { year, month, weeks, monthCount, weekStreak, total } = useMemo(() => {
    const now = new Date()
    const nowStr = toDateStr(now)
    const byDate = new Map()
    for (const s of sessions) {
      if (!s.game_date) continue
      const entry = byDate.get(s.game_date) ?? { shooting: 0, scrimmage: 0 }
      if (s.game_type === 'shooting') entry.shooting++
      else entry.scrimmage++
      byDate.set(s.game_date, entry)
    }

    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    const year = first.getFullYear()
    const month = first.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < first.getDay(); i++) cells.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const key = toDateStr(date)
      const entry = byDate.get(key)
      cells.push({
        key,
        day,
        weekday: date.getDay(),
        shooting: entry?.shooting ?? 0,
        scrimmage: entry?.scrimmage ?? 0,
        isToday: key === nowStr,
        isFuture: key > nowStr,
      })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    const weeks = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const monthCount = sessions.filter((s) => s.game_date?.startsWith(monthPrefix)).length

    // 今週から遡って、練習のある週(日〜土)が何週続いているか(今週がまだ0回なら先週から数える)
    const weekKeys = new Set(
      sessions.filter((s) => s.game_date).map((s) => toDateStr(sundayOf(parseLocalDate(s.game_date))))
    )
    const cursor = sundayOf(now)
    if (!weekKeys.has(toDateStr(cursor))) cursor.setDate(cursor.getDate() - 7)
    let weekStreak = 0
    while (weekKeys.has(toDateStr(cursor))) {
      weekStreak++
      cursor.setDate(cursor.getDate() - 7)
    }
    return { year, month, weeks, monthCount, weekStreak, total: sessions.length }
  }, [sessions, monthOffset])

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
          <p className="font-heading text-[10px] tracking-[0.2em] opacity-70">
            {monthOffset === 0 ? 'THIS MONTH' : `${year}.${month + 1}`}
          </p>
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

      <div className="mt-3 rounded-xl bg-white/55 p-2.5 backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label="前の月"
            className="flex size-7 items-center justify-center rounded-full hover:bg-white/60 active:scale-90"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-bold tabular-nums">
            {year}年{month + 1}月
          </p>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={monthOffset === 0}
            aria-label="次の月"
            className="flex size-7 items-center justify-center rounded-full hover:bg-white/60 active:scale-90 disabled:opacity-25"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
          {DAY_LABELS.map((l, i) => (
            <span key={l} className={cn(i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'opacity-60')}>
              {l}
            </span>
          ))}
        </div>
        <div key={`${year}-${month}`} className="flex flex-col gap-1 animate-in fade-in duration-200">
          {weeks.map((cells, w) => (
            <div key={w} className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`empty-${i}`} />
                const count = cell.shooting + cell.scrimmage
                return (
                  <div
                    key={cell.key}
                    title={`${cell.key} シューティング${cell.shooting}回・スクリメージ${cell.scrimmage}回`}
                    className={cn(
                      'relative flex h-9 flex-col items-center justify-center rounded-md text-xs font-bold tabular-nums leading-none',
                      count > 0
                        ? count >= 2
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/75 text-primary-foreground'
                        : cell.isFuture
                          ? 'opacity-35'
                          : 'bg-white/70',
                      count === 0 && cell.weekday === 0 && 'text-red-600',
                      count === 0 && cell.weekday === 6 && 'text-blue-600',
                      cell.isToday && 'ring-2 ring-secondary ring-offset-1 ring-offset-white/0'
                    )}
                  >
                    {cell.day}
                    {count > 0 && (
                      <span className="mt-1 flex gap-0.5">
                        {cell.shooting > 0 && <span className="size-1.5 rounded-full bg-chart-3" />}
                        {cell.scrimmage > 0 && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-3 text-[10px] opacity-75">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-chart-3 ring-1 ring-black/10" />
            シューティング
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-white ring-1 ring-black/20" />
            スクリメージ
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm ring-2 ring-secondary" />
            今日
          </span>
        </div>
      </div>
    </div>
  )
}
