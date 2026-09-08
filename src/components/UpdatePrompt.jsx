import { useSyncExternalStore } from 'react'
import { RefreshCw } from 'lucide-react'
import { applyUpdate, getNeedRefresh, subscribeNeedRefresh } from '@/lib/swUpdate'
import { Button } from '@/components/ui/button'

// 新しいバージョンが公開されたら、それ以降の操作をブロックして更新を強制する。
// 古いバンドルのまま使い続けると、サーバー側のスキーマ変更などと噛み合わなくなる
// おそれがあるため、確認なしの自動リロードではなく明示的な操作を求める形にしている
export function UpdatePrompt() {
  const needRefresh = useSyncExternalStore(subscribeNeedRefresh, getNeedRefresh)

  if (!needRefresh) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl bg-popover p-6 text-center text-popover-foreground ring-1 ring-foreground/10">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <RefreshCw className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">最新のアップデートがあります</p>
          <p className="text-sm text-muted-foreground">更新してください</p>
        </div>
        <Button className="w-full" onClick={applyUpdate}>
          更新する
        </Button>
      </div>
    </div>
  )
}
