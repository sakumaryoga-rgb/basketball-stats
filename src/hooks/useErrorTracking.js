import { useEffect, useRef } from 'react'
import { supabase } from '@/supabaseClient'
import { sanitizeMessage, sanitizeStack } from '@/lib/sanitizeErrorText'

// window.onerror/onunhandledrejectionへの直接代入は既存のハンドラを上書きしてしまうため、
// addEventListener/removeEventListenerを使う。個人情報・秘密情報は保存しない
// (message/stack/pathのみ。sanitizeErrorTextで二重に除去・マスクする)。
export function useErrorTracking(userId) {
  const userIdRef = useRef(userId)

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  useEffect(() => {
    function report(message, stack) {
      const uid = userIdRef.current
      if (!uid) return
      supabase
        .from('client_errors')
        .insert({
          user_id: uid,
          path: window.location.pathname,
          message: sanitizeMessage(message),
          stack: sanitizeStack(stack),
        })
        .then(({ error }) => {
          if (error) console.error('エラーの記録に失敗しました', error)
        })
    }

    function handleError(event) {
      report(event.message || String(event.error), event.error?.stack)
    }

    function handleRejection(event) {
      const reason = event.reason
      report(reason?.message || String(reason), reason?.stack)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
}
