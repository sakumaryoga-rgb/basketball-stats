import { useState } from 'react'
import { TriangleAlert, Copy, Check, X } from 'lucide-react'
import { detectInAppBrowser } from '@/lib/inAppBrowser'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'inAppBrowserBannerDismissed'

// LINE等のアプリ内ブラウザで開かれた場合、この端末の情報がSafari/Chromeと共有されず
// 別端末として扱われてしまうため、正しいブラウザで開き直すよう案内する。
export function InAppBrowserBanner() {
  const [appName] = useState(() => detectInAppBrowser())
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'
  )
  const [copied, setCopied] = useState(false)

  if (!appName || dismissed) return null

  async function handleCopy() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="bg-muted border-b px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="max-w-lg mx-auto flex items-start gap-2.5">
        <TriangleAlert className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-xs leading-relaxed">
          <p className="font-medium">{appName}内のブラウザで開いています</p>
          <p className="mt-0.5 text-muted-foreground">
            このまま進めると、端末の情報がSafari/Chromeと共有されず、後で見つけにくくなる場合があります。右上のメニューなどから「他のブラウザで開く」を選ぶか、URLをコピーしてSafari/Chromeで開いてください。
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleCopy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'コピーしました' : 'URLをコピー'}
          </Button>
        </div>
        <button type="button" onClick={handleDismiss} aria-label="閉じる" className="shrink-0 text-muted-foreground p-1">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
