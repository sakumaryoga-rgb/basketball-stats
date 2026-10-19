import { Check as CheckIcon, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CourtLines } from '@/components/fun/CourtLines'
import { Glow } from '@/components/fun/Glow'
import { cn } from '@/lib/utils'

// 大会/試合/スクリメージの作成フォーム共通のボトムシート。
// 紺のヘッダー(GAMES/TEAMのヒーローと同じ表現)+スクロールする本文+下部固定の作成ボタン。
// 選手が多くても作成ボタンに常に届くよう、本文だけをスクロールさせる
export function GameSetupSheet({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  onSubmit,
  submitLabel,
  savingLabel,
  saving,
  error,
  bodyRef,
  submitDisabled = false,
  children,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        data-no-pull-refresh
        className="mx-auto flex max-h-[min(92svh,calc(100svh-env(safe-area-inset-top)-0.5rem))] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-3xl border-0 p-0"
      >
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="relative shrink-0 overflow-hidden bg-secondary px-5 pt-2 pb-5 text-secondary-foreground">
            <CourtLines className="text-white/10" />
            <Glow className="-right-16 -top-20 size-52" opacity={0.45} />
            <div className="relative mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/25" aria-hidden />
            <SheetClose
              render={
                <button
                  type="button"
                  className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/10 text-white/80 outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70"
                />
              }
            >
              <X className="size-4" />
              <span className="sr-only">閉じる</span>
            </SheetClose>
            <div className="relative pr-10">
              <p className="font-heading text-[10px] tracking-[0.25em] text-chart-3">{eyebrow}</p>
              <SheetTitle className="mt-0.5 font-heading text-3xl leading-none tracking-wide text-secondary-foreground">{title}</SheetTitle>
              {description && <SheetDescription className="mt-1.5 text-xs text-white/70">{description}</SheetDescription>}
            </div>
          </div>

          <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-6">
            {children}
          </div>

          {/* submitLabelを渡さない場合は作成ボタンを出さない(既存の選手から選ぶ画面など) */}
          {(submitLabel || error) && (
            <div className="shrink-0 border-t bg-popover/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
              {error && <p className={cn('text-sm text-destructive', submitLabel && 'mb-2')}>{error}</p>}
              {submitLabel && (
                <Button type="submit" disabled={saving || submitDisabled} className="h-12 w-full rounded-xl font-heading text-base tracking-wider">
                  {saving ? savingLabel : submitLabel}
                </Button>
              )}
            </div>
          )}
          {!submitLabel && !error && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />}
        </form>
      </SheetContent>
    </Sheet>
  )
}

// シート内のセクション見出し(PRACTICEのSectionHeaderと同じ見た目)
export function SetupSection({ icon: Icon, title, sub, children, className }) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 leading-none">
          <h3 className="font-heading text-lg leading-none tracking-wide">{title}</h3>
          {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

// 「VS 対戦相手」入力。スコアボード風に大きく見せる
export function OpponentField({ id, value, onChange, required, placeholder, label }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 pl-3 shadow-xs focus-within:ring-2 focus-within:ring-primary/50">
        <span className="font-heading text-xl leading-none text-primary">VS</span>
        <input
          id={id}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-base font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}

// 日付・会場などの通常入力(ラベル付き)
export function SetupField({ id, label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

// 2Q制/4Q制の選択。大きめのカード2枚で、選択中は紺に反転する
export function PeriodSystemPicker({ value, onChange }) {
  const options = [
    { key: '2q', title: '2Q', label: '2Q制', sub: '前半・後半' },
    { key: '4q', title: '4Q', label: '4Q制', sub: '1〜4Q' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="クォーター制">
      {options.map((o) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={cn(
              'press flex min-h-16 items-center gap-3 rounded-2xl border px-3 text-left transition-colors',
              active ? 'border-secondary bg-secondary text-secondary-foreground shadow-md' : 'bg-card hover:bg-muted/60'
            )}
          >
            <span className={cn('font-heading text-3xl leading-none', active ? 'text-chart-3' : 'text-muted-foreground')}>{o.title}</span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">{o.label}</span>
              <span className={cn('block text-[11px]', active ? 'text-white/70' : 'text-muted-foreground')}>{o.sub}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// 選手の複数選択リスト(シューティングの参加メンバー選択などで使う)
export function PlayerToggleList({ players, selectedIds, onToggle, renderJersey }) {
  return (
    <ul className="grid grid-cols-2 gap-1.5">
      {players.map((p) => {
        const checked = selectedIds.includes(p.id)
        return (
          <li key={p.id} className="min-w-0">
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => onToggle(p.id)}
              className={cn(
                'press flex min-h-12 w-full min-w-0 items-center gap-2 rounded-xl border px-2 text-left transition-colors',
                checked ? 'border-secondary bg-secondary text-secondary-foreground shadow-sm' : 'bg-background hover:bg-muted'
              )}
            >
              {renderJersey(p)}
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{p.name}</span>
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  checked ? 'border-chart-3 bg-chart-3 text-secondary' : 'border-border'
                )}
                aria-hidden
              >
                {checked && <CheckIcon className="size-3" strokeWidth={3} />}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
