import { Link } from 'react-router-dom'
import { Menu, Megaphone, HelpCircle, Mail, Shield, FileText, Info, Link2, ChevronRight } from 'lucide-react'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_VERSION } from '@/lib/appVersion'

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
        <p className="shrink-0 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
          v{APP_VERSION}
        </p>
      </SheetContent>
    </Sheet>
  )
}
