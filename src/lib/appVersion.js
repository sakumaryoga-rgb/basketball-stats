import { version as APP_VERSION } from '../../package.json'
import { setForceUpdateRequired } from '@/lib/swUpdate'

export { APP_VERSION }

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

// public/version.jsonはビルド後もService Workerのプリキャッシュ対象に含まれないため、
// 常にネットワークから最新の値を取得できる(cache:'no-store'+クエリでHTTPキャッシュも回避)。
// DBスキーマ変更等で旧クライアントとの互換性が失われる場合だけ、ここでminSupportedVersionを
// 引き上げてデプロイすることで、記録中の画面であっても強制的に更新を求められるようにする
export async function checkMinSupportedVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const { minSupportedVersion } = await res.json()
    if (minSupportedVersion && compareVersions(APP_VERSION, minSupportedVersion) < 0) {
      setForceUpdateRequired(true)
    }
  } catch {
    // オフライン等で確認できない場合は何もしない(通常のオンライン利用時に強制する設計のため)
  }
}
