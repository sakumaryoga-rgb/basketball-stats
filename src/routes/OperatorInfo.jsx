import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const CONTACT_EMAIL = 'sakumaryoga@gmail.com'

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b last:border-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function OperatorInfo() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        戻る
      </button>

      <h1 className="text-2xl font-heading tracking-wide">運用元情報</h1>

      <div className="rounded-lg border px-4">
        <Row label="サービス名">BASKETBALL STATS(バスケスタッツ)</Row>
        <Row label="運営者">個人開発</Row>
        <Row label="お問い合わせ">
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
        </Row>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        BASKETBALL STATSは、チームのバスケットボールスタッツを記録・集計するために個人で開発・運営しているサービスです。現時点で法人としての事業運営は行っておらず、有償でのサービス提供も行っていません。今後、広告掲載など事業内容に変更が生じる場合は、法令に基づき本ページの内容を更新します。
      </p>
    </div>
  )
}
