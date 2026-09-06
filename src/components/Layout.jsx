import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Users, Trophy, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/games', label: '試合', icon: CalendarDays },
  { to: '/players', label: '選手', icon: Users },
  { to: '/leaders', label: 'リーダー', icon: Trophy },
  { to: '/team', label: 'チーム', icon: Settings },
]

export function Layout({ teamName }) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <span className="font-medium text-sm truncate">{teamName ?? 'バスケスタッツ'}</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="border-t bg-background/80 backdrop-blur fixed bottom-0 inset-x-0 z-10">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
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
