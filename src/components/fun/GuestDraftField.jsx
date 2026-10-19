import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { Jersey } from '@/components/fun/Jersey'
import { GUEST_COLOR } from '@/components/fun/GuestTag'

// 試合/スクリメージの作成画面で、その試合だけ参加するゲストを追加する欄。
// 入力項目は試合画面の「ゲストを追加」と同じ(名前・背番号)。追加したゲストはRESERVEに入り、
// LineupEditorでSTARTING FIVEへ移せる。チームの選手としては登録されない
export function GuestDraftField({ guests, onAdd, onRemove }) {
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')

  function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, number: number === '' ? null : Number(number) })
    setName('')
    setNumber('')
  }

  // 外側のフォーム(試合の作成)が送信されないよう、Enterはゲストの追加として扱う
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-dashed bg-muted/40 p-3">
      <div className="flex items-start gap-2">
        <UserPlus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-bold text-foreground">ゲスト</span>
          はこの試合だけ参加する選手です。チームの選手(PLAYERS)やシーズン成績には登録されません
        </p>
      </div>
      <div className="flex min-w-0 gap-2">
        <label className="sr-only" htmlFor="draft-guest-name">ゲストの名前</label>
        <input
          id="draft-guest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ゲストの名前"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
        <label className="sr-only" htmlFor="draft-guest-number">背番号</label>
        <input
          id="draft-guest-number"
          type="number"
          inputMode="numeric"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="背番号"
          className="h-11 w-20 shrink-0 rounded-xl border bg-background px-2 text-center text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="press h-11 shrink-0 rounded-xl bg-secondary px-3 text-sm font-bold text-secondary-foreground disabled:opacity-40"
        >
          追加
        </button>
      </div>
      {guests.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="この試合のゲスト">
          {guests.map((g) => (
            <li key={g.id} className="flex min-w-0 max-w-full items-center gap-1 rounded-full border bg-background py-0.5 pr-0.5 pl-1">
              <Jersey number={g.number} color={GUEST_COLOR} className="size-6 shrink-0" />
              <span className="min-w-0 truncate text-xs font-bold">{g.name}</span>
              <button
                type="button"
                onClick={() => onRemove(g.id)}
                aria-label={`ゲスト ${g.name} を削除`}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
