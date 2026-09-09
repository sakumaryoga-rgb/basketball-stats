import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, Users, Trophy, Settings, Dumbbell } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { PullToRefresh } from '@/components/PullToRefresh'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { checkForUpdate } from '@/lib/swUpdate'

const NAV_ITEMS = [
  { to: '/games', label: 'GAMES', icon: CalendarDays },
  { to: '/practice', label: 'PRACTICE', icon: Dumbbell },
  { to: '/players', label: 'PLAYERS', icon: Users },
  { to: '/leaders', label: 'LEADERS', icon: Trophy },
  { to: '/team', label: 'TEAM', icon: Settings },
]

export function Layout({ teamName, teamIconUrl }) {
  const location = useLocation()
  // pull-to-refreshで画面のデータを再取得するため、この値を変えて現在の画面を再マウントさせる
  // (各データフックはマウント時に自動でfetchするため、フルリロードなしでソフトに更新できる)。
  // あわせてPWAの更新チェックも行う(iOSのホーム画面追加時はブラウザ標準の
  // pull-to-refreshが使えないため、このスワイプが更新確認の唯一の能動的な手段になる)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const handleRefresh = useCallback(() => {
    setRefreshNonce((n) => n + 1)
    checkForUpdate()
  }, [])

  // 100dvhを指定してもiOSのホーム画面追加時に実際の画面高さより短く計算され、
  // 下部タブバーが画面下端まで届かない(浮いて見える)report があった。CSSの
  // ビューポート単位(dvh/svh/vh)に頼らず、window.innerHeightで実測した値を
  // CSS変数として直接反映することで、この手のiOS特有の計算ズレを避ける
  useEffect(() => {
    function setAppHeight() {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
    }
    setAppHeight()
    window.addEventListener('resize', setAppHeight)
    window.visualViewport?.addEventListener('resize', setAppHeight)
    return () => {
      window.removeEventListener('resize', setAppHeight)
      window.visualViewport?.removeEventListener('resize', setAppHeight)
    }
  }, [])

  return (
    // headerとnavをposition:fixedでビューポート上に重ねる従来の構成では、iOSのSafari/
    // WKWebViewでページ本体(html/body)がビューポートより短くスクロール不要な画面
    // (中身の少ないGAME/PRACTICE等)のときに、fixed要素がビューポート基準ではなく
    // ドキュメント基準の位置に描画され、画面中央寄りに「浮いて見える」既知の不具合が
    // あった。ページ全体をposition:fixedでビューポートに固定したシェルにし、header/navは
    // そのシェル内の通常のflex要素として配置、スクロールはmain内部(PullToRefreshが持つ
    // スクロールコンテナ)だけに限定することで、html/body自体は一切スクロールしなくなり、
    // fixed要素がビューポート基準からずれる原因そのものを取り除く
    // heightは上のeffectがwindow.innerHeightの実測値をCSS変数として設定する。
    // 初回描画時など変数未設定の間は100dvhをフォールバックにする
    <div className="fixed inset-0 flex flex-col bg-background" style={{ height: 'var(--app-height, 100dvh)' }}>
      <header className="border-b bg-background/80 backdrop-blur z-10 pt-[env(safe-area-inset-top)] shrink-0">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link to="/team" className="flex items-center gap-2 min-w-0">
            <Avatar className="size-7 shrink-0">
              <AvatarImage src={teamIconUrl} alt={teamName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {teamName?.[0] ?? 'B'}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm truncate">{teamName ?? 'バスケスタッツ'}</span>
          </Link>
          <HamburgerMenu />
        </div>
      </header>

      <main className="flex-1 min-h-0 max-w-lg w-full mx-auto px-4 flex flex-col">
        <PullToRefresh onRefresh={handleRefresh}>
          {/* pathnameとrefreshNonceをkeyにすることで、タブ切り替え時になめらかにフェードインし、
              pull-to-refresh時は画面を再マウントしてデータを再取得する */}
          <div key={`${location.pathname}-${refreshNonce}`} className="py-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <Outlet />
          </div>
        </PullToRefresh>
      </main>

      <nav className="border-t bg-background/80 backdrop-blur z-10 pb-[env(safe-area-inset-bottom)] shrink-0">
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs font-heading tracking-wide ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
