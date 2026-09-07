import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="font-medium">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">{children}</div>
    </section>
  )
}

export function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        戻る
      </button>

      <div>
        <h1 className="text-2xl font-heading tracking-wide">プライバシーポリシー</h1>
        <p className="text-xs text-muted-foreground mt-1">最終更新日: 2026年9月7日</p>
      </div>

      <Section title="1. はじめに">
        <p>
          本ポリシーは、BASKETBALL STATS(以下「本サービス」)における利用者情報の取り扱いについて定めるものです。
        </p>
      </Section>

      <Section title="2. 収集する情報">
        <p>本サービスは、以下の情報を取得・保存します。</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>チーム名、招待コード、チームアイコン画像</li>
          <li>選手のプロフィール情報(氏名・背番号・ポジション・身長・体重・写真など、チーム管理者が任意で入力した内容)</li>
          <li>試合・スクリメージ・シューティング練習の記録およびスタッツ</li>
        </ul>
        <p>
          本サービスはメールアドレスやパスワードによる会員登録を行わず、端末ごとに自動発行される匿名の識別子でチームへの参加を管理します。氏名等の入力は任意であり、実名の入力を必須としていません。
        </p>
      </Section>

      <Section title="3. 情報の利用目的">
        <p>取得した情報は、チーム内でのスタッツ記録・集計・閲覧機能を提供する目的にのみ利用します。広告配信やプロファイリングを目的とした利用は行っていません。</p>
      </Section>

      <Section title="4. データの保存・委託先">
        <p>
          本サービスはデータベース・認証・画像ストレージにSupabase社のサービスを、アプリの配信にVercel社のホスティングサービスを利用しています。これらの委託先において、本ポリシーの範囲内でデータが処理されます。
        </p>
      </Section>

      <Section title="5. データの共有範囲">
        <p>
          チームに登録された情報は、招待コードで参加した同じチームのメンバー間でのみ共有されます。本サービスが第三者に対して情報を販売・提供することはありません。
        </p>
      </Section>

      <Section title="6. データの削除">
        <p>
          チーム設定画面から「このチームを退出する」ことで、その端末とチームの紐付けを解除できます。チームやチーム内のデータ全体の削除、その他お手元でできない削除のご希望は、下記お問い合わせ先までご連絡ください。
        </p>
      </Section>

      <Section title="7. Cookie等の利用">
        <p>
          本サービスはログイン状態や表示中のチームを維持するためブラウザのlocalStorageを利用しています。現時点で広告配信のための第三者トラッキングは行っていませんが、広告機能を開始する場合は本ポリシーを改定のうえ、あらためてお知らせします。
        </p>
      </Section>

      <Section title="8. 未成年の方のご利用について">
        <p>
          未成年の方が選手として登録される場合は、保護者・チーム管理者の責任のもとでご利用ください。
        </p>
      </Section>

      <Section title="9. 本ポリシーの変更">
        <p>本ポリシーの内容は、必要に応じて予告なく変更されることがあります。変更後の内容は本ページに掲載した時点で効力を生じるものとします。</p>
      </Section>

      <Section title="10. お問い合わせ">
        <p>
          本ポリシーに関するお問い合わせは、メニューの「お問い合わせ」よりご連絡ください。
        </p>
      </Section>
    </div>
  )
}
