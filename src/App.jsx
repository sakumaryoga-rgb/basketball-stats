import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useTeams } from '@/hooks/useTeams'
import { Onboarding } from '@/routes/Onboarding'
import { Games } from '@/routes/Games'
import { GameDetail } from '@/routes/GameDetail'
import { Practice } from '@/routes/Practice'
import { ShootingDetail } from '@/routes/ShootingDetail'
import { Players } from '@/routes/Players'
import { PlayerDetail } from '@/routes/PlayerDetail'
import { Leaders } from '@/routes/Leaders'
import { TeamSettings } from '@/routes/TeamSettings'
import { Account } from '@/routes/Account'
import { ContactForm } from '@/routes/ContactForm'
import { PrivacyPolicy } from '@/routes/PrivacyPolicy'
import { Terms } from '@/routes/Terms'
import { OperatorInfo } from '@/routes/OperatorInfo'
import { Layout } from '@/components/Layout'
import { InAppBrowserBanner } from '@/components/InAppBrowserBanner'

function FullScreenLoader() {
  return (
    <div className="min-h-svh flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  const { session, loading: sessionLoading } = useSession()
  const { teams, activeTeam, loading: teamsLoading, refresh: refreshTeams, switchTeam } = useTeams(session)

  async function handleTeamJoined(teamId) {
    await refreshTeams()
    switchTeam(teamId)
  }

  if (sessionLoading || !session || teamsLoading) {
    return (
      <>
        <InAppBrowserBanner />
        <FullScreenLoader />
      </>
    )
  }

  return (
    <>
      <InAppBrowserBanner />
      <Routes>
        <Route path="/onboarding" element={<Onboarding onTeamJoined={handleTeamJoined} hasTeam={!!activeTeam} />} />
        <Route path="/t/:token" element={<Onboarding onTeamJoined={handleTeamJoined} hasTeam={!!activeTeam} />} />
        <Route element={<Layout teamName={activeTeam?.name} teamIconUrl={activeTeam?.icon_url} />}>
          {/* チーム未所属でも(オンボーディング中の同意ポップアップから遷移できるよう)閲覧できる情報ページ */}
          <Route path="/contact" element={<ContactForm />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/operator" element={<OperatorInfo />} />
          <Route path="/account" element={<Account />} />

          {activeTeam && (
            <>
              <Route index element={<Navigate to="/games" replace />} />
              <Route path="/games" element={<Games teamId={activeTeam.id} />} />
              <Route path="/games/:id" element={<GameDetail teamId={activeTeam.id} />} />
              <Route path="/practice" element={<Practice teamId={activeTeam.id} />} />
              <Route path="/shooting/:id" element={<ShootingDetail teamId={activeTeam.id} />} />
              <Route path="/players" element={<Players teamId={activeTeam.id} teams={teams} />} />
              <Route path="/players/:id" element={<PlayerDetail teamId={activeTeam.id} />} />
              <Route path="/leaders" element={<Leaders teamId={activeTeam.id} />} />
              <Route path="/team" element={<TeamSettings team={activeTeam} onTeamUpdated={refreshTeams} />} />
            </>
          )}
          <Route path="*" element={<Navigate to={activeTeam ? '/games' : '/onboarding'} replace />} />
        </Route>
      </Routes>
    </>
  )
}
