import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useTeams } from '@/hooks/useTeams'
import { useActiveShareToken } from '@/hooks/useActiveShareToken'
import { usePageViewTracking } from '@/hooks/usePageViewTracking'
import { useErrorTracking } from '@/hooks/useErrorTracking'
import { Onboarding } from '@/routes/Onboarding'
import { Tournaments } from '@/routes/Tournaments'
import { TournamentGames } from '@/routes/TournamentGames'
import { GameDetail } from '@/routes/GameDetail'
import { Practice } from '@/routes/Practice'
import { ShootingDetail } from '@/routes/ShootingDetail'
import { Players } from '@/routes/Players'
import { PlayerDetail } from '@/routes/PlayerDetail'
import { Leaders } from '@/routes/Leaders'
import { TeamSettings } from '@/routes/TeamSettings'
import { ContactForm } from '@/routes/ContactForm'
import { PrivacyPolicy } from '@/routes/PrivacyPolicy'
import { Terms } from '@/routes/Terms'
import { OperatorInfo } from '@/routes/OperatorInfo'
import { Layout } from '@/components/Layout'
import { InAppBrowserBanner } from '@/components/InAppBrowserBanner'
import { UpdatePrompt } from '@/components/UpdatePrompt'

function FullScreenLoader() {
  return (
    <div className="min-h-svh flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

// AdminDashboardはRecharts等、一般ユーザー向け画面では使わない依存を含むため、
// 通常のバンドルには含めずlazyで分割する(/adminを開いた時だけ読み込む)。
const AdminDashboard = lazy(() => import('@/routes/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))

// ScoreSheetは印刷専用CSS(@media print)を含み、現状は一部チームのみの検証機能
// (scoreSheetConfig.js参照)のため、通常バンドルには含めずlazyで分割する。
const ScoreSheet = lazy(() => import('@/routes/ScoreSheet').then((m) => ({ default: m.ScoreSheet })))

// 運営者専用の/adminは、匿名認証・チームセッション(useSession/useTeams)を一切使わない
// 完全に独立した画面のため、それらのフックを呼び出すMainAppとはRoutesの段階で分離する
// (Reactのフック呼び出し順を一定に保つため、コンポーネント内で条件分岐はしない)。
export default function App() {
  return (
    <Routes>
      <Route
        path="/admin"
        element={
          <Suspense fallback={<FullScreenLoader />}>
            <AdminDashboard />
          </Suspense>
        }
      />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  )
}

function MainApp() {
  const location = useLocation()
  const { session, loading: sessionLoading } = useSession()
  const { teams, activeTeam, loading: teamsLoading, refresh: refreshTeams, switchTeam } = useTeams(session)
  useActiveShareToken(activeTeam?.id)
  usePageViewTracking(session?.user?.id, activeTeam?.id)
  useErrorTracking(session?.user?.id)

  async function handleTeamJoined(teamId) {
    await refreshTeams()
    switchTeam(teamId)
  }

  if (sessionLoading || !session || teamsLoading) {
    return (
      <>
        <UpdatePrompt />
        <InAppBrowserBanner />
        <FullScreenLoader />
      </>
    )
  }

  return (
    <>
      <UpdatePrompt />
      <InAppBrowserBanner />
      <Routes>
        <Route path="/onboarding" element={<Onboarding onTeamJoined={handleTeamJoined} hasTeam={!!activeTeam} />} />
        <Route path="/t/:token" element={<Onboarding onTeamJoined={handleTeamJoined} hasTeam={!!activeTeam} />} />
        {/* 印刷用A4レイアウト(@media print)を持つ専用ページのため、Layoutの
            固定高さ・overflow:hiddenのapp-shellの外側に置く(印刷時に内容が
            クリップされるのを避けるため) */}
        <Route
          path="/scoresheet/:gameId"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <ScoreSheet />
            </Suspense>
          }
        />
        <Route element={<Layout teamName={activeTeam?.name} teamIconUrl={activeTeam?.icon_url} />}>
          {/* チーム未所属でも(オンボーディング中の同意ポップアップから遷移できるよう)閲覧できる情報ページ */}
          <Route path="/contact" element={<ContactForm />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/operator" element={<OperatorInfo />} />

          {activeTeam && (
            <>
              <Route index element={<Navigate to="/games" replace />} />
              <Route path="/games" element={<Tournaments teamId={activeTeam.id} />} />
              <Route path="/games/t/:tournamentId" element={<TournamentGames teamId={activeTeam.id} />} />
              <Route path="/games/:id" element={<GameDetail teamId={activeTeam.id} />} />
              <Route path="/practice" element={<Practice teamId={activeTeam.id} />} />
              <Route path="/shooting/:id" element={<ShootingDetail teamId={activeTeam.id} />} />
              <Route path="/players" element={<Players teamId={activeTeam.id} teams={teams} />} />
              <Route path="/players/:id" element={<PlayerDetail teamId={activeTeam.id} />} />
              <Route path="/leaders" element={<Leaders teamId={activeTeam.id} />} />
              <Route path="/team" element={<TeamSettings team={activeTeam} onTeamUpdated={refreshTeams} />} />
            </>
          )}
          <Route
            path="*"
            element={
              <Navigate
                to={{ pathname: activeTeam ? '/games' : '/onboarding', search: location.search }}
                replace
              />
            }
          />
        </Route>
      </Routes>
    </>
  )
}
