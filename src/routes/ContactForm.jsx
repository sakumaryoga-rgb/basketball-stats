import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, MessageCircleQuestion, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { supabase } from '@/supabaseClient'

const MESSAGE_MIN_LENGTH = 10
const MESSAGE_MAX_LENGTH = 2000
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

export function ContactForm() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // ハニーポット。人間の利用者には見えないため、値が入っていればbotとみなす
  const [status, setStatus] = useState('idle') // idle | sending | sent | error | duplicate
  // フォーム表示からの経過時間が短すぎる送信をbotとみなすチェックのアンカー。
  // 送信のたびにDate.now()へ更新することで、エラー/重複で同じ画面に留まったまま
  // 連打・自動リトライされた場合も、直前の送信からの経過時間で毎回判定し直せるようにする
  // (更新しないと最初の1回しかこのチェックが機能しなかった)
  const renderedAtRef = useRef(0)
  useEffect(() => {
    renderedAtRef.current = Date.now()
  }, [])
  const [cooldown, setCooldown] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileContainerRef = useRef(null)
  const turnstileWidgetIdRef = useRef(null)

  // Cloudflare Turnstileでスクリプトによる直接API呼び出し(bot)を防ぐ。サイトキー未設定の間は表示しない。
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    function renderWidget() {
      if (!turnstileContainerRef.current || turnstileWidgetIdRef.current || !window.turnstile) return
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      })
    }

    if (window.turnstile) {
      renderWidget()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = renderWidget
    document.head.appendChild(script)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (cooldown) return
    const elapsedAnchor = renderedAtRef.current
    // 次回の送信はここからの経過時間で判定させる(連打・自動リトライ対策)
    renderedAtRef.current = Date.now()
    setStatus('sending')
    // 人間が連打してもbotの連続送信と同じ挙動になってしまわないよう、送信ボタン自体も
    // 短時間ロックする(サーバー側のMIN_ELAPSED_MSチェックとは独立した、UI側の連打対策)
    setCooldown(true)
    setTimeout(() => setCooldown(false), 3000)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message,
          email: email || undefined,
          website,
          renderedAt: elapsedAnchor,
          turnstileToken,
        }),
      })
      if (res.status === 429) {
        setStatus('duplicate')
        return
      }
      if (!res.ok) throw new Error('failed')
      setStatus('sent')
      setMessage('')
      setEmail('')
    } catch (err) {
      console.error('お問い合わせの送信に失敗しました', err)
      setStatus('error')
    } finally {
      // Turnstileトークンは1回限りなので、成否にかかわらずリセットして次回送信に備える
      if (window.turnstile && turnstileWidgetIdRef.current != null) {
        window.turnstile.reset(turnstileWidgetIdRef.current)
      }
      setTurnstileToken('')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col gap-5">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="size-4" />
          戻る
        </button>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-6" />
            </div>
            <div>
              <p className="font-medium">送信しました</p>
              <p className="text-sm text-muted-foreground mt-1">お問い合わせありがとうございます。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const messageLength = message.length

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        戻る
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircleQuestion className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-heading tracking-wide">お問い合わせ</h1>
          <p className="text-sm text-muted-foreground">不具合報告やご要望など、お気軽にご連絡ください</p>
        </div>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] size-px opacity-0"
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="contact-message">お問い合わせ内容</Label>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    messageLength > 0 && messageLength < MESSAGE_MIN_LENGTH
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {messageLength}/{MESSAGE_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="contact-message"
                required
                rows={6}
                minLength={MESSAGE_MIN_LENGTH}
                maxLength={MESSAGE_MAX_LENGTH}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="機能追加のご要望や、不具合の内容・再現手順などをご記入ください。(10〜2,000文字)"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-email">返信用メールアドレス (任意)</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="返信をご希望の場合はご記入ください"
              />
            </div>
            {(status === 'error' || status === 'duplicate') && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p>
                  {status === 'error'
                    ? '送信に失敗しました。時間を置いて再度お試しください。'
                    : '同じ内容の問い合わせが直前に送信されています。しばらく時間を置いてから再度お試しください。'}
                </p>
              </div>
            )}
            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <div ref={turnstileContainerRef} />
              </div>
            )}
            <Button
              type="submit"
              disabled={status === 'sending' || cooldown || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
            >
              {status === 'sending' ? '送信中...' : '送信する'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
