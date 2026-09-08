import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { applyUpdate, getState, subscribe } from '@/lib/swUpdate'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 試合(/games/:id)・シューティング(/shooting/:id)の記録画面では、通常の新バージョン検知
// (needRefresh)があっても全画面ブロックにせず、記録の妨げにならないバナー表示に留める。
// 記録完了で一覧へ戻る/画面を離れると、この判定が変わって自動的にブロッキング表示になる。
// ただしDBスキーマ変更等で互換性がなくなる場合(forceUpdateRequired)は、記録中でも
// 常にブロッキング表示にする
function isRecordingRoute(pathname) {
  return /^\/(games|shooting)\/[^/]+/.test(pathname)
}

export function UpdatePrompt() {
  const { needRefresh, forceUpdateRequired } = useSyncExternalStore(subscribe, getState)
  const { pathname } = useLocation()

  if (!needRefresh && !forceUpdateRequired) return null

  const blocking = forceUpdateRequired || !isRecordingRoute(pathname)

  if (!blocking) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4">
        <div className="flex items-center gap-2 rounded-full bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <RefreshCw className="size-4 shrink-0 text-primary" />
          新しいバージョンがあります。記録終了後に更新されます
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl bg-popover p-6 text-center text-popover-foreground ring-1 ring-foreground/10">
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-full',
            forceUpdateRequired ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
          )}
        >
          {forceUpdateRequired ? <TriangleAlert className="size-6" /> : <RefreshCw className="size-6" />}
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">{forceUpdateRequired ? '重要な更新が必要です' : '最新のアップデートがあります'}</p>
          <p className="text-sm text-muted-foreground">
            {forceUpdateRequired ? 'このバージョンは利用できません。今すぐ更新してください' : '更新してください'}
          </p>
        </div>
        <Button className="w-full" onClick={applyUpdate}>
          更新する
        </Button>
      </div>
    </div>
  )
}
