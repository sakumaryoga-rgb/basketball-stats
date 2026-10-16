import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { cleanExternalBrowserParam, detectInAppBrowser, getExternalBrowserUrl, tryAutoOpenExternalBrowser } from '@/lib/inAppBrowser'
import { Basketball } from '@/components/fun/Basketball'
import { Button } from '@/components/ui/button'

// LINE等のアプリ内ブラウザで開かれた場合、アプリ本体(匿名サインイン・共有URLでの自動参加)を
// マウントする前に標準ブラウザへ移動させる。アプリ内ブラウザ側で先にサインイン・参加してしまうと、
// 標準ブラウザとは別の匿名アカウントができてしまうため。移動できなかった場合だけ、
// もう一度試すか、このまま開くかを選べるようにする
export function ExternalBrowserGate({ children }) {
  const [state] = useState(() => {
    cleanExternalBrowserParam()
    const appName = detectInAppBrowser()
    return { appName, redirecting: appName ? tryAutoOpenExternalBrowser() : false }
  })
  const [proceed, setProceed] = useState(false)

  if (!state.appName || proceed) return children

  const externalUrl = getExternalBrowserUrl(state.appName)
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 bg-background px-6 text-center"
      style={{ minHeight: 'var(--app-height, 100svh)' }}
    >
      <div className="flex h-16 flex-col items-center justify-end">
        <Basketball className="size-10 animate-ball-bounce" />
        <div className="mt-1 h-1.5 w-9 rounded-full bg-foreground/30 blur-[1px] animate-ball-shadow" />
      </div>
      <div>
        <p className="text-base font-bold">ブラウザで開いています…</p>
        <p className="mt-1.5 max-w-72 text-xs leading-relaxed text-muted-foreground">
          {state.appName}内のブラウザでは記録が保存されないことがあるため、Safari / Chromeなどの標準ブラウザで開きます。
          自動で切り替わらない場合は下のボタンを押してください。
        </p>
      </div>
      {externalUrl && (
        <Button className="h-11 w-full max-w-72 font-bold" onClick={() => (window.location.href = externalUrl)}>
          <ExternalLink className="size-4" />
          ブラウザで開く
        </Button>
      )}
      <button type="button" onClick={() => setProceed(true)} className="min-h-10 text-xs text-muted-foreground underline">
        このまま{state.appName}内で開く
      </button>
    </div>
  )
}
