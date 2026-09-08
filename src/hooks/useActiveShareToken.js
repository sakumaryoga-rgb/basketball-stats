import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getShareUrl } from '@/lib/shareUrlStore'

// Walica同様、共有URLのトークンをアドレスバーから消さずに常に維持する。
// LINE等のアプリ内ブラウザで開いた後、そのままネイティブの「他のブラウザで開く」メニューや
// 独自の案内バナーから再オープンしても、現在のURLに常に有効なトークンが乗っているため、
// 別ブラウザの真新しい匿名セッションでもそのままシームレスにアクセスできる。
// (以前は検証直後にトークンをアドレスバーから除去していたが、この一度きりの除去が
// 「LINEから開き直すとオンボーディング画面に戻ってしまう」問題の原因だったため撤回した)
export function useActiveShareToken(activeTeamId) {
  const location = useLocation()
  const navigate = useNavigate()

  const tokenFromUrl = useMemo(() => {
    const pathMatch = location.pathname.match(/^\/t\/([^/]+)/)
    if (pathMatch) return pathMatch[1]
    return new URLSearchParams(location.search).get('t')
  }, [location.pathname, location.search])

  const rememberedToken = useMemo(() => {
    if (!activeTeamId) return null
    const shareUrl = getShareUrl(activeTeamId)
    if (!shareUrl) return null
    const match = shareUrl.match(/\/t\/([^/?#]+)/)
    return match ? match[1] : null
  }, [activeTeamId])

  const token = tokenFromUrl || rememberedToken

  useEffect(() => {
    if (!token || !activeTeamId) return
    // /t/:token 自体は既に正規のURLなので触らない。/onboarding は専用の参加フローが処理する
    if (location.pathname.startsWith('/t/') || location.pathname === '/onboarding') return
    const params = new URLSearchParams(location.search)
    if (params.get('t') === token) return
    params.set('t', token)
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTeamId, location.pathname, location.search])

  return token
}
