import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function TeamSettings({ team }) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/onboarding?code=${team.invite_code}`

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">チーム</h1>
      <Card>
        <CardHeader>
          <CardTitle>{team.name}</CardTitle>
          <CardDescription>このリンクを共有すると、コーチ・マネージャーがチームに参加できます</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="text-sm bg-muted rounded-md px-3 py-2 break-all">{inviteUrl}</div>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'コピーしました' : 'リンクをコピー'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
