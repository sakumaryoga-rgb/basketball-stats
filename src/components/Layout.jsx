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

// フッターが「浮く」「沈む」不具合の原因調査用の一時的なデバッグ表示。
// position:fixedでアプリシェル(overflow:hidden)の外、実際のビューポート基準に
// 配置しているため、シェルの高さがずれていても実機の生の値がそのまま見える。
// 原因を特定でき次第この表示は削除する
function ViewportDebugBadge() {
  const [info, setInfo] = useState(() => readViewportInfo())

  useEffect(() => {
    function update() {
      setInfo(readViewportInfo())
    }
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    const id = setInterval(update, 1000)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      clearInterval(id)
    }
  }, [])

  return (
    <div className="fixed bottom-1 right-1 z-50 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-white pointer-events-none">
      inner:{info.inner} scr:{info.screen} sa:{info.standalone ? '1' : '0'} dvh:{info.dvhSupported ? '1' : '0'} shell:{info.shellHeight} navBottom:{info.navBottom}
    </div>
  )
}

function readViewportInfo() {
  if (typeof window === 'undefined') return {}
  const shellEl = document.querySelector('.app-shell')
  const navEl = document.querySelector('nav')
  return {
    inner: window.innerHeight,
    screen: window.screen?.height ?? '-',
    // trueならホーム画面に追加したアイコンから起動した状態(Safari自体のUIなし)。
    // falseの場合、下の余白の正体はSafari自体のツールバー(アプリのコードでは制御不可)である可能性が高い
    standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    dvhSupported: typeof CSS !== 'undefined' && CSS.supports?.('height', '100dvh'),
    // アプリシェル自体の実際の描画高さ。window.innerHeightと一致していれば
    // シェルはビューポートを正しく埋め切れている(=それでも余白が見えるなら
    // アプリの外側=OS/ブラウザ側の領域ということになる)
    shellHeight: shellEl ? Math.round(shellEl.getBoundingClientRect().height) : '-',
    // フッターnavの実際の下端位置。window.innerHeightと一致していれば
    // フッターは画面の描画可能範囲の一番下まで正しく届いている
    navBottom: navEl ? Math.round(navEl.getBoundingClientRect().bottom) : '-',
  }
}

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

      <nav className="border-t bg-background/80 backdrop-blur z-10 pb-[env(safe-area-inset-bottom)] shrink-0">
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
      <ViewportDebugBadge />
    </div>
  )
}
