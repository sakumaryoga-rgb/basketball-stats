import { useState } from 'react'
import { TriangleAlert, ExternalLink, Check, X } from 'lucide-react'
import { detectInAppBrowser, getExternalBrowserUrl } from '@/lib/inAppBrowser'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'inAppBrowserBannerDismissed'

// LINE等のアプリ内ブラウザ(WebView)は動作が不安定なことがあるため、
// システム標準のSafari/Chromeで開き直すよう案内する。
export function InAppBrowserBanner() {
  const [appName] = useState(() => detectInAppBrowser())
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'
  )
  const [copiedFallback, setCopiedFallback] = useState(false)

  if (!appName || dismissed) return null

  const externalUrl = getExternalBrowserUrl(appName)

  async function handleOpenInBrowser() {
    if (externalUrl) {
      // LINE/KakaoTalk等、専用の仕組みで外部ブラウザへ直接遷移できる場合
      window.location.href = externalUrl
      return
    }
    // Instagram/Facebook/X等、直接開く手段がない場合はタブで開くことを試みつつ、
    // 失敗した場合に備えてURLもコピーしておく(右上メニューからの手動操作を助けるため)
    window.open(window.location.href, '_blank', 'noopener,noreferrer')
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedFallback(true)
      setTimeout(() => setCopiedFallback(false), 3000)
    } catch {
      // クリップボードが使えない環境では何もしない(タブを開く試みのみ行う)
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3.5 pt-[calc(0.875rem+env(safe-area-inset-top))]">
      <div className="max-w-lg mx-auto flex items-start gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 shrink-0">
          <TriangleAlert className="size-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-amber-900">{appName}内のブラウザで開いています</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            アプリ内ブラウザは動作が不安定になることがあります。快適にご利用いただくため、標準のブラウザ(Safari / Chromeなど)で開くことをおすすめします。
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleOpenInBrowser}
            >
              {copiedFallback ? <Check className="size-3.5" /> : <ExternalLink className="size-3.5" />}
              {copiedFallback ? 'URLをコピーしました' : 'ブラウザで開く'}
            </Button>
            {!externalUrl && copiedFallback && (
              <span className="text-[11px] text-amber-700 leading-tight">
                開けない場合は右上のメニューから貼り付けてください
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="閉じる"
          className="shrink-0 text-amber-700/70 hover:text-amber-900 p-1 -m-1"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
