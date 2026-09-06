import { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// チーム内利用のみのアプリなのでメール認証は行わず、匿名セッションを自動発行する
export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session)
        setLoading(false)
        return
      }
      const { data: anonData, error } = await supabase.auth.signInAnonymously()
      if (error) console.error('匿名サインインに失敗しました', error)
      setSession(anonData?.session ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
