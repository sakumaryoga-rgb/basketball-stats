import { useMemo } from 'react'
import { aggregateHotZones } from '@/lib/hotZones'
import { HotZoneChart } from '@/components/HotZoneChart'

// シュートチャートのショット一覧からNBA公式ゾーン定義のホットゾーンを表示する。
// 選手個人ページ・チームページの両方から共通で使う。
export function HotZoneSection({ shots }) {
  const hotZones = useMemo(() => aggregateHotZones(shots), [shots])
  const totalAttempts = shots.length

  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground mb-3">ホットゾーン(フィールドゴール)</p>
      {totalAttempts === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">まだシュート位置の記録がありません</p>
      ) : (
        <HotZoneChart hotZones={hotZones} />
      )}
    </div>
  )
}
