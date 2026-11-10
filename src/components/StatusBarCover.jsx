import { cn } from '@/lib/utils'

// iOS 27(iOS 26.1以降も)のホーム画面アプリは、ステータスバーの下に半透明のぼかしを重ね、
// ぼかしがステータスバーより下まで広がってヘッダーの上半分が透けて見える。
// ページ側の設定(apple-mobile-web-app-status-bar-style・theme-color)ではもう消せない。
// 画面最上部(上から4px以内)に、幅80%以上・高さ6px以上の背景色付きのposition:fixedの要素があると、
// iOSはステータスバーをその色の不透明な帯として描き、ぼかしを出さない。そのための帯
export function StatusBarCover({ className }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-50', className)}
      style={{ height: 'max(6px, env(safe-area-inset-top))' }}
    />
  )
}
