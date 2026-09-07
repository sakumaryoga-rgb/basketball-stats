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

export function Terms() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        戻る
      </button>

      <div>
        <h1 className="text-2xl font-heading tracking-wide">利用規約</h1>
        <p className="text-xs text-muted-foreground mt-1">最終更新日: 2026年9月7日</p>
      </div>

      <Section title="第1条(適用)">
        <p>本規約は、BASKETBALL STATS(以下「本サービス」)の利用に関する条件を定めるものです。利用者は本規約に同意のうえ本サービスをご利用ください。</p>
      </Section>

      <Section title="第2条(利用登録)">
        <p>
          本サービスはチームの作成、または招待コードによるチームへの参加によって利用を開始します。利用者は端末ごとに自動発行される匿名アカウントにより本サービスを利用します。
        </p>
      </Section>

      <Section title="第3条(禁止事項)">
        <p>利用者は本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>法令または公序良俗に違反する行為</li>
          <li>他の利用者、第三者の権利を侵害する行為</li>
          <li>本サービスのサーバーやネットワークの機能を妨害する行為</li>
          <li>不正アクセスその他不正な手段で本サービスを利用する行為</li>
          <li>その他、運営者が不適切と判断する行為</li>
        </ul>
      </Section>

      <Section title="第4条(本サービスの提供の停止等)">
        <p>
          運営者は、システムの保守・点検、天災等の不可抗力、その他運営上・技術上の理由により、利用者への事前の通知なく本サービスの全部または一部の提供を停止・中断できるものとします。
        </p>
      </Section>

      <Section title="第5条(登録データの取り扱い)">
        <p>
          利用者が本サービスに入力したチーム名・選手情報・試合記録等のデータは、利用者が管理・入力した内容として扱われ、その正確性について運営者は保証しません。データはSupabase社のインフラ上に保存されますが、不可抗力によるデータの消失・破損について運営者は責任を負いません。重要なデータは利用者ご自身の判断で別途保管されることをお勧めします。
        </p>
      </Section>

      <Section title="第6条(免責事項)">
        <p>
          本サービスは現状有姿で提供され、その完全性・正確性・特定目的への適合性について明示または黙示を問わず保証しません。本サービスの利用により生じた損害について、運営者は故意または重過失がある場合を除き責任を負いません。
        </p>
      </Section>

      <Section title="第7条(知的財産権)">
        <p>
          利用者が入力したデータの権利は利用者に帰属します。本サービスのソフトウェア・デザイン・名称等に関する権利は運営者または正当な権利者に帰属し、無断での複製・転用を禁止します。
        </p>
      </Section>

      <Section title="第8条(利用規約の変更)">
        <p>運営者は必要と判断した場合、利用者への事前の通知なく本規約を変更できるものとします。変更後の規約は本ページに掲載した時点で効力を生じます。</p>
      </Section>

      <Section title="第9条(準拠法・裁判管轄)">
        <p>本規約の解釈にあたっては日本法を準拠法とします。本サービスに関して紛争が生じた場合には、運営者の所在地を管轄する裁判所を専属的合意管轄とします。</p>
      </Section>

      <Section title="第10条(お問い合わせ)">
        <p>本規約に関するお問い合わせは、メニューの「お問い合わせ」よりご連絡ください。</p>
      </Section>
    </div>
  )
}
