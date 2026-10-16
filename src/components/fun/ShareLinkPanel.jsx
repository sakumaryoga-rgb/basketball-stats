import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Link2, Send, Share2, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyText, shortenShareUrl } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'

const STEPS = [
  { icon: Send, text: 'LINEなどでリンクを送る' },
  { icon: UserPlus, text: '開くだけで自動でチームに参加' },
  { icon: Users, text: '同じ記録をみんなで見る・つける' },
]

// チームへの招待リンク(共有URL)カード。TEAM画面とチーム作成直後のオンボーディングで共通に使う。
// 長いURLが画面を押し広げないよう表示は短縮するが、コピー・共有される値は常に完全なURL
export function ShareLinkPanel({ url, teamName, footer, className }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const timer = useRef(null)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  useEffect(() => () => clearTimeout(timer.current), [])

  async function handleCopy() {
    const ok = await copyText(url)
    setCopyFailed(!ok)
    setCopied(ok)
    clearTimeout(timer.current)
    if (ok) timer.current = setTimeout(() => setCopied(false), 2500)
  }

  async function handleShare() {
    try {
      await navigator.share({ title: teamName, url })
    } catch {
      // ユーザーがシェアをキャンセルした場合等は何もしない
    }
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border bg-card shadow-xs', className)}>
      <div className="relative bg-secondary px-4 pb-4 pt-3.5 text-secondary-foreground">
        <div className="absolute -right-8 -top-10 size-28 rounded-full bg-primary/35 blur-2xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
            <Link2 className="size-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-heading text-[10px] tracking-[0.2em] opacity-70">INVITE LINK</p>
            <p className="text-sm font-bold truncate">メンバー招待リンク</p>
          </div>
        </div>
        <ol className="relative mt-3 grid grid-cols-3 gap-1.5">
          {STEPS.map(({ icon: Icon, text }, i) => (
            <li key={text} className="flex flex-col items-center gap-1 rounded-xl bg-white/8 px-1.5 py-2 text-center">
              <span className="relative flex size-7 items-center justify-center rounded-full bg-white/12">
                <Icon className="size-3.5" />
                <span className="absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-full bg-chart-3 font-heading text-[9px] text-[oklch(0.28_0.08_75)]">
                  {i + 1}
                </span>
              </span>
              <span className="text-[10px] leading-snug opacity-90">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {copyFailed ? (
          // 自動コピーできない環境では、完全なURLを選択可能な入力欄に出して手動でコピーしてもらう
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            aria-label="招待リンク"
            className="w-full min-w-0 rounded-xl border bg-muted/60 px-3 py-2.5 font-latin text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={handleCopy}
            className="press flex w-full min-w-0 items-center gap-2 rounded-xl border border-dashed bg-muted/60 px-3 py-2.5 text-left"
            aria-label="招待リンクをコピー"
          >
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-latin text-sm tabular-nums" title={url}>
              {shortenShareUrl(url)}
            </span>
            <span className="shrink-0 text-[10px] font-bold text-primary">TAP</span>
          </button>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            size="lg"
            onClick={handleCopy}
            className={cn(
              'h-11 flex-1 text-sm font-bold transition-colors',
              copied && 'bg-lime-500 text-lime-950 hover:bg-lime-500'
            )}
          >
            {copied ? <Check className="size-4 animate-check-pop" /> : <Copy className="size-4" />}
            {copied ? 'コピーしました!' : 'リンクをコピー'}
          </Button>
          {canShare && (
            <Button type="button" size="lg" variant="outline" className="h-11 w-11 px-0" aria-label="共有" onClick={handleShare}>
              <Share2 className="size-4" />
            </Button>
          )}
        </div>

        <p
          role="status"
          className={cn(
            'text-xs transition-all',
            copied ? 'text-lime-700 font-medium' : copyFailed ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {copied
            ? 'LINEやメールに貼り付けてメンバーへ送ってください'
            : copyFailed
              ? '自動でコピーできませんでした。上の欄のリンクを長押しでコピーしてください'
              : 'リンクは完全なURLでコピーされます'}
        </p>

        <div className="flex items-start gap-2 rounded-xl bg-primary/8 px-3 py-2 text-[11px] leading-relaxed text-foreground/80">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>このリンクを知っている人は誰でもチームに参加して記録・編集できます。メンバー以外には送らないでください。</span>
        </div>

        {footer}
      </div>
    </div>
  )
}
