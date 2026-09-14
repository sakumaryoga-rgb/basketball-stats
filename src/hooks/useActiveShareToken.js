import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getShareUrl } from '@/lib/shareUrlStore'

// チーム未所属でも閲覧できる公開ページ(App.jsxの同名コメント参照)。
// チームコンテキストを必要とせず、SNS等でそのまま公開されうるページのため、
// 共有トークンをURLへ付与しない(既に付いていた場合は積極的に取り除く)。
const PUBLIC_PAGES = ['/contact', '/privacy-policy', '/terms', '/operator']

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
    // /t/:token 自体は既に正規のURLなので触らない。/onboarding は専用の参加フローが処理する
    if (location.pathname.startsWith('/t/') || location.pathname === '/onboarding') return

    if (PUBLIC_PAGES.includes(location.pathname)) {
      // 公開ページでは不要な共有トークン露出を避けるため、既に付いていれば取り除くだけで
      // 新たに付与はしない(チームの参加状態やactiveTeamIdは一切変更しない)
      const params = new URLSearchParams(location.search)
      if (!params.has('t')) return
      params.delete('t')
      const search = params.toString()
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
      return
    }

    if (!token || !activeTeamId) return
    const params = new URLSearchParams(location.search)
    if (params.get('t') === token) return
    params.set('t', token)
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTeamId, location.pathname, location.search])

  return token
}
