import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useTeam } from '@/hooks/useTeam'
import { Login } from '@/routes/Login'
import { AuthCallback } from '@/routes/AuthCallback'
import { Onboarding } from '@/routes/Onboarding'
import { Games } from '@/routes/Games'
import { GameDetail } from '@/routes/GameDetail'
import { Players } from '@/routes/Players'
import { PlayerDetail } from '@/routes/PlayerDetail'
import { Leaders } from '@/routes/Leaders'
import { TeamSettings } from '@/routes/TeamSettings'
import { Layout } from '@/components/Layout'

function FullScreenLoader() {
  return (
    <div className="min-h-svh flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  const { session, loading: sessionLoading } = useSession()
  const { team, loading: teamLoading, refresh: refreshTeam } = useTeam(session)
  const location = useLocation()

  // 招待リンク (?code=XXXX) を踏んだ場合、未ログインでも後で使えるようコードを覚えておく
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code')
    if (code) {
      localStorage.setItem('pendingInviteCode', code)
    }
  }, [location.search])

  if (sessionLoading) return <FullScreenLoader />

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />

      {!session ? (
        <Route path="*" element={<Navigate to="/login" replace />} />
      ) : teamLoading ? (
        <Route path="*" element={<FullScreenLoader />} />
      ) : !team ? (
        <>
          <Route path="/onboarding" element={<Onboarding onTeamChanged={refreshTeam} />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </>
      ) : (
        <Route element={<Layout teamName={team.name} />}>
          <Route index element={<Navigate to="/games" replace />} />
          <Route path="/games" element={<Games teamId={team.id} />} />
          <Route path="/games/:id" element={<GameDetail teamId={team.id} />} />
          <Route path="/players" element={<Players teamId={team.id} />} />
          <Route path="/players/:id" element={<PlayerDetail teamId={team.id} />} />
          <Route path="/leaders" element={<Leaders teamId={team.id} />} />
          <Route path="/team" element={<TeamSettings team={team} />} />
          <Route path="*" element={<Navigate to="/games" replace />} />
        </Route>
      )}
    </Routes>
  )
}
