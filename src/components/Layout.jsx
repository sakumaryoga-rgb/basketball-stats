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

  // inset-0/100dvh/window.innerHeight実測/height:100%連鎖と4通り試したが、いずれも
  // 「ホーム画面追加時にSafariの検索バー分だけ下部タブバーが浮く」問題が解消しなかった。
  // これらは結局すべて同じ「ブラウザが報告するビューポート高さ」を参照しており、その
  // 報告値自体が(検索バー表示時のSafariタブ用の値のまま)ズレている場合はどの書き方でも
  // 直らない。visualViewport APIはツールバーの表示/非表示に応じて実際に見えている領域を
  // 動的に報告するために作られたAPIで、window.innerHeightとは別の計測経路を持つため、
  // これを優先して使うことでズレを回避する
  useEffect(() => {
    function setAppHeight() {
      const vvHeight = window.visualViewport?.height ?? 0
      const height = Math.max(vvHeight, window.innerHeight)
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }
    setAppHeight()
    window.addEventListener('resize', setAppHeight)
    window.visualViewport?.addEventListener('resize', setAppHeight)
    window.visualViewport?.addEventListener('scroll', setAppHeight)
    return () => {
      window.removeEventListener('resize', setAppHeight)
      window.visualViewport?.removeEventListener('resize', setAppHeight)
      window.visualViewport?.removeEventListener('scroll', setAppHeight)
    }
  }, [])

  return (
    <div className="flex flex-col bg-background" style={{ height: 'var(--app-height, 100%)' }}>
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
