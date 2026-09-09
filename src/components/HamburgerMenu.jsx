import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Megaphone, HelpCircle, Mail, Shield, FileText, Info, Link2, ChevronRight, RefreshCw, BadgeCheck } from 'lucide-react'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_VERSION } from '@/lib/appVersion'
import { applyUpdate, getState, subscribe } from '@/lib/swUpdate'

function ComingSoonItem({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 text-sm text-left">{label}</span>
      <Badge variant="secondary" className="text-[10px] shrink-0">Coming soon</Badge>
    </div>
  )
}

function MenuLink({ icon: Icon, label, to, href }) {
  const content = (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 text-sm text-left">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </>
  )
  const className = 'flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-muted'

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    )
  }

  return (
    <SheetClose render={<Link to={to} className={className} />}>
      {content}
    </SheetClose>
  )
}

// バージョン番号は X.Y.Z 形式(例: 23.0.1)。真ん中(Y)がメジャーアップデート、
// 末尾(Z)がマイナーアップデートの通し番号で、更新のたびに末尾を+1する運用。
// needRefreshはSWが新しいバージョンを取得済みかどうかを表すため、これをそのまま
// 「お使いのバージョンが最新か」の判定に流用する
function VersionFooter() {
  const { needRefresh } = useSyncExternalStore(subscribe, getState)

  return (
    <div className="shrink-0 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            バージョン
          </span>
          <span className="text-sm font-medium tabular-nums">v{APP_VERSION}</span>
        </div>
        {needRefresh ? (
          <button
            type="button"
            onClick={applyUpdate}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <RefreshCw className="size-3.5" />
            更新する
          </button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <BadgeCheck className="size-3.5" />
            最新版です
          </span>
        )}
      </div>
    </div>
  )
}

export function HamburgerMenu() {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="メニュー" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0">
        <SheetHeader className="border-b pt-[calc(1rem+env(safe-area-inset-top))]">
          <SheetTitle>メニュー</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <ComingSoonItem icon={Megaphone} label="BASKETBALL STATSに広告を出す" />
          <ComingSoonItem icon={HelpCircle} label="よくある質問" />
          <MenuLink icon={Mail} label="お問い合わせ" to="/contact" />
          <MenuLink icon={Shield} label="プライバシーポリシー" to="/privacy-policy" />
          <MenuLink icon={FileText} label="利用規約" to="/terms" />
          <MenuLink icon={Info} label="運用元情報" to="/operator" />
          <ComingSoonItem icon={Link2} label="関連サイト" />
        </nav>
        <VersionFooter />
      </SheetContent>
    </Sheet>
  )
}
