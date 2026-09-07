import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ShieldAlert, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from '@/components/ui/alert-dialog'

const CONSENT_STORAGE_KEY = 'termsAndPrivacyConsent'

export function Account({ teams = [] }) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [blockedTeams, setBlockedTeams] = useState(null)

  const adminTeams = teams.filter((t) => t.myRole === 'admin')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    setBlockedTeams(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('セッションが確認できませんでした')

      const response = await fetch('/api/account-delete', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (result?.error === 'admin_teams_remaining') {
          setBlockedTeams(result.teams ?? [])
        }
        setError(result?.message || '削除に失敗しました。しばらくしてから再度お試しください。')
        setDeleting(false)
        setConfirmDelete(false)
        return
      }

      // 削除完了後、クライアント側のSupabaseセッションと関連localStorageをクリアする
      localStorage.removeItem(CONSENT_STORAGE_KEY)
      localStorage.removeItem('activeTeamId')
      localStorage.removeItem('pendingInviteCode')
      await supabase.auth.signOut()
      window.location.href = '/onboarding'
    } catch (err) {
      console.error('アカウント削除に失敗しました', err)
      setError('削除に失敗しました。しばらくしてから再度お試しください。')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        戻る
      </button>

      <h1 className="text-2xl font-heading tracking-wide">アカウントを削除</h1>
      <p className="text-sm text-muted-foreground leading-relaxed -mt-3">
        この端末のSupabase匿名アカウントを削除します。削除する前に、何が削除され、何が残るかをご確認ください。
      </p>

      <div className="rounded-lg border px-4 py-3 flex flex-col gap-1.5">
        <p className="text-sm font-medium">削除されるもの</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside leading-relaxed">
          <li>参加している各チームへの参加情報(役割・端末の用途区分・記録権限)</li>
          <li>お問い合わせ機能の送信履歴等、本人に紐づく技術的なログ</li>
          <li>この端末のSupabase匿名アカウント本体</li>
        </ul>
      </div>

      <div className="rounded-lg border px-4 py-3 flex flex-col gap-1.5">
        <p className="text-sm font-medium">削除されず残る共有データ</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside leading-relaxed">
          <li>チームの選手・試合・スタッツ等の記録(他のメンバーも利用するチーム共有データのため削除されません)</li>
          <li>
            利用規約・プライバシーポリシーへの同意記録(本人を特定できる情報を除いた、同意日時・バージョンのみの記録として法的な証跡目的で保持されます)
          </li>
        </ul>
      </div>

      {adminTeams.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex flex-col gap-2">
          <p className="text-sm font-medium flex items-center gap-1.5 text-destructive">
            <ShieldAlert className="size-4" />
            削除する前に必要な操作があります
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            以下のチームで管理者になっています。チームの管理者が0人にならないよう、各チームの設定から先に管理者移譲またはチーム削除を完了してください。
          </p>
          <ul className="text-sm text-muted-foreground">
            {adminTeams.map((t) => (
              <li key={t.id}>・{t.name}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="text-destructive text-sm">
          <p>{error}</p>
          {blockedTeams && blockedTeams.length > 0 && (
            <p className="mt-1">{blockedTeams.map((t) => t.teamName).filter(Boolean).join('、')}</p>
          )}
        </div>
      )}

      <Button variant="destructive" disabled={adminTeams.length > 0 || deleting} onClick={() => setConfirmDelete(true)}>
        <Trash2 className="size-4" />
        この端末のアカウントを削除する
      </Button>

      <p className="text-xs text-muted-foreground leading-relaxed">
        個人情報の削除に関するご相談は、運営者への「お問い合わせ」からもご連絡いただけます。
      </p>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。この端末のアカウントと、参加している各チームへの参加情報が削除されます。チームの選手・試合・スタッツ等の共有データは削除されません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  削除中...
                </>
              ) : (
                '削除する'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
