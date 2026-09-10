import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, Users, Trophy, Settings, Dumbbell } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { PullToRefresh } from '@/components/PullToRefresh'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { checkForUpdate } from '@/lib/swUpdate'
import { measureAppHeight } from '@/lib/appHeight'

const NAV_ITEMS = [
  { to: '/games', label: 'GAMES', icon: CalendarDays },
  { to: '/practice', label: 'PRACTICE', icon: Dumbbell },
  { to: '/players', label: 'PLAYERS', icon: Users },
  { to: '/leaders', label: 'LEADERS', icon: Trophy },
  { to: '/team', label: 'TEAM', icon: Settings },
]

// 試合の記録画面(/games/:id、公式戦・スクリメージ共通)では、下スワイプによる
// pull-to-refreshがタイマーの再設定など誤操作の原因になるため無効化する。
// 大会の試合一覧(/games)・大会詳細(/games/t/:tournamentId)は対象外
const GAME_RECORDING_PATH = /^\/games\/(?!t\/)[^/]+$/

export function Layout({ teamName, teamIconUrl }) {
  const location = useLocation()
  const pullToRefreshDisabled = GAME_RECORDING_PATH.test(location.pathname)
  // pull-to-refreshで画面のデータを再取得するため、この値を変えて現在の画面を再マウントさせる
  // (各データフックはマウント時に自動でfetchするため、フルリロードなしでソフトに更新できる)。
  // あわせてPWAの更新チェックも行う(iOSのホーム画面追加時はブラウザ標準の
  // pull-to-refreshが使えないため、このスワイプが更新確認の唯一の能動的な手段になる)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const handleRefresh = useCallback(() => {
    setRefreshNonce((n) => n + 1)
    checkForUpdate()
  }, [])

  // --app-heightの初期計測・監視はmain.jsx側でアプリ起動時に行っているが、Layoutは
  // Onboardingでチームに参加した直後など、起動からしばらく経ってから(main.jsx側の
  // 再計測タイマーが終わった後で)初めてマウントされることがある。その場合、起動直後の
  // 一時的にズレた値がここでも使われ続けてしまうため、Layoutが実際にマウントされる
  // タイミングでも念のため再計測する
  useEffect(() => {
    measureAppHeight()
  }, [])

  return (
    // --app-heightはmain.jsx側でReactのマウント前からアプリ全体向けに管理している
    // (Onboarding等Layoutを使わない画面でも同じ値を使う必要があるため)。
    // overflow:hiddenはbody全体ではなくこの要素自身に付与する。Onboarding等
    // Layoutを使わない画面は通常のドキュメントスクロールに依存しているため、
    // bodyにoverflow:hiddenをかけるとそちらが下側にスクロールできなくなり
    // 切れて見える回帰バグを起こす(index.css参照)
    //
    // .app-shellの直後に高さ1pxの要素を置き、body全体を意図的にごくわずかに
    // 縦スクロール可能な状態にする。iOS standaloneでは、ページがスクロール
    // 不要(ちょうど収まるサイズ)だと判定されると、本来表示されないはずの
    // Safariツールバー分の領域を空けたまま埋めてくれない既知の挙動があり、
    // この1pxがそれを回避して正しい高さを学習する足がかりになる
    // (appHeight.js参照)。学習完了後はCSS側(index.css)で弾み(rubber-band)
    // 自体をロックして止めるため、通常操作中に誤って画面が持ち上がる
    // ことはない
    <>
      <div className="app-shell flex flex-col overflow-hidden bg-background" style={{ height: 'var(--app-height, 100%)' }}>
      <header className="border-b bg-background/80 backdrop-blur z-10 pt-[env(safe-area-inset-top)] shrink-0">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link to="/team" className="flex items-center gap-2 min-w-0">
            <Avatar className="size-7 shrink-0">
              <AvatarImage src={teamIconUrl} alt={teamName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {teamName?.[0] ?? 'B'}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm truncate">{teamName ?? 'BASKETBALL STATS'}</span>
          </Link>
          <HamburgerMenu />
        </div>
      </header>

      <main className="flex-1 min-h-0 max-w-lg w-full mx-auto px-4 flex flex-col">
        <PullToRefresh onRefresh={handleRefresh} disabled={pullToRefreshDisabled}>
          {/* pathnameとrefreshNonceをkeyにすることで、タブ切り替え時になめらかにフェードインし、
              pull-to-refresh時は画面を再マウントしてデータを再取得する */}
          <div key={`${location.pathname}-${refreshNonce}`} className="py-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <Outlet />
          </div>
        </PullToRefresh>
      </main>

      <nav className="border-t bg-background/80 backdrop-blur z-10 pb-[calc(env(safe-area-inset-bottom)+22px)] shrink-0">
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs font-heading leading-none tracking-wide ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="size-5" />
              <span className="leading-none">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      </div>
      <div aria-hidden="true" style={{ height: 1 }} />
    </>
  )
}
