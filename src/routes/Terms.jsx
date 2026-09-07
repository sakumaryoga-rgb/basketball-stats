import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { TERMS_VERSION } from '@/lib/legal'

const CONTACT_EMAIL = 'sakumaryoga@gmail.com'

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

  // オンボーディングの同意ポップアップで「確認済み」と判定するための既読マーク
  useEffect(() => {
    sessionStorage.setItem('viewedTermsVersion', TERMS_VERSION)
  }, [])

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

      <p className="text-sm text-muted-foreground leading-relaxed">
        本利用規約(以下「本規約」といいます)は、BASKETBALL STATS(以下「本サービス」といいます)の利用条件を定めるものです。本サービスを利用する方(以下「利用者」といいます)は、本規約に同意したうえで本サービスをご利用ください。
      </p>

      <Section title="第1条(適用)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>本規約は、利用者と本サービスの運営者(以下「運営者」といいます)との間の、本サービスの利用に関する一切の関係に適用されます。</li>
          <li>本サービス上で個別のルール、注意事項その他の定めを表示した場合、それらは本規約の一部を構成するものとします。</li>
          <li>本規約と個別の定めの内容が異なる場合は、当該個別の定めに特段の記載がない限り、個別の定めが優先するものとします。</li>
        </ol>
      </Section>

      <Section title="第2条(利用開始・匿名アカウント等)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>本サービスは、チームの作成または招待コードによる既存チームへの参加により利用を開始します。</li>
          <li>本サービスでは、メールアドレスおよびパスワードによる通常の会員登録を行わず、端末等に対して自動的に発行される匿名アカウント(Supabase Authによる匿名認証)を利用して利用者を識別します。</li>
          <li>利用者は、招待コードその他チームへのアクセスに必要な情報を自己の責任で適切に管理し、意図しない第三者に開示しないものとします。</li>
          <li>
            端末の変更、アプリの削除、ブラウザデータの消去その他の事情により、匿名アカウントとの紐付けが失われた場合、当該端末固有の利用状態を復元することはできません。ただし、招待コードを保管している場合は、再度そのチームに参加することで、チーム内の選手情報・試合記録等のデータを引き続き閲覧・編集いただけます。
          </li>
        </ol>
      </Section>

      <Section title="第3条(禁止事項)">
        <p>利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>法令または公序良俗に違反する行為</li>
          <li>他の利用者または第三者の権利、利益、プライバシー、肖像権その他の権利を侵害する行為</li>
          <li>本人または正当な権限を有する者の承諾なく、第三者の情報、写真その他のデータを不適切に登録または利用する行為</li>
          <li>虚偽、不正確または第三者に不利益を与える情報を故意に登録する行為</li>
          <li>本サービスのサーバー、ネットワークまたはシステムに過度な負荷を与え、またはその正常な動作を妨害する行為</li>
          <li>不正アクセス、他人の匿名識別子・招待コード等の不正利用その他不正な手段により本サービスを利用する行為</li>
          <li>本サービスの不具合を意図的に利用する行為</li>
          <li>本サービスまたはその構成要素について、法令上認められる場合を除き、無断で複製、改変、解析、リバースエンジニアリング等を行う行為</li>
          <li>その他、運営者が本サービスの運営上不適切と合理的に判断する行為</li>
        </ol>
      </Section>

      <Section title="第4条(本サービスの変更・停止等)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>運営者は、システムの保守・点検、障害対応、セキュリティ上の必要、天災その他の不可抗力、外部サービスの停止・障害、その他運営上または技術上の理由により、本サービスの全部または一部を変更、停止または中断することがあります。</li>
          <li>緊急の場合を除き、利用者への影響が大きい変更、停止または中断については、本サービス内への表示その他合理的な方法により可能な範囲で事前にお知らせします。</li>
        </ol>
      </Section>

      <Section title="第5条(登録データの取扱い)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>利用者が本サービスに入力、登録またはアップロードしたチーム名、選手情報、写真、試合記録、スタッツその他のデータ(以下「登録データ」といいます)について、その内容および正確性は利用者が責任を負うものとします。</li>
          <li>利用者は、第三者に関する氏名、写真、身体情報その他の情報を登録する場合、当該情報の登録および利用に必要な権利、権限または同意を有していることを確認するものとします。</li>
          <li>登録データは、招待コード等により同一チームへ参加したメンバー間で共有され、原則としてチームに参加した全てのメンバーが閲覧および編集できます。</li>
          <li>運営者は、本サービスの提供、維持、障害対応、セキュリティ確保その他本サービスの運営に必要な範囲で登録データを取り扱うことができます。</li>
          <li>システム障害、通信障害、外部サービスの障害、端末の故障、不可抗力その他の事由によりデータの消失、破損または利用不能が生じる可能性があります。重要なデータについては、利用者自身の判断で別途保存してください。</li>
          <li>登録データおよび利用者情報の詳細な取扱いについては、別途定めるプライバシーポリシーによるものとします。</li>
        </ol>
      </Section>

      <Section title="第6条(保証の否認および責任の制限)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>本サービスは現状有姿で提供されます。運営者は、本サービスについて、完全性、正確性、最新性、継続性、特定目的への適合性、特定の結果の実現、不具合が発生しないことその他一切の事項を保証するものではありません。</li>
          <li>運営者は、運営者の責めに帰すことのできない事由によって利用者に生じた損害について責任を負いません。</li>
          <li>運営者の軽過失により利用者に損害が生じた場合、法令上許される範囲で、運営者が負う責任は通常かつ直接の損害に限るものとし、特別損害、間接損害、逸失利益その他の派生的損害について責任を負わないものとします。</li>
          <li>前項の責任制限は、運営者の故意または重大な過失により損害が生じた場合には適用しません。</li>
          <li>本条は、消費者契約法その他の適用法令により制限または無効とされる範囲を超えて、運営者の責任を免除または制限するものではありません。</li>
        </ol>
      </Section>

      <Section title="第7条(知的財産権等)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>利用者が本サービスに登録した情報に関する著作権その他の権利は、当該利用者または正当な権利者に留保されます。</li>
          <li>利用者は、運営者に対し、本サービスの提供、保存、表示、バックアップ、保守、障害対応その他本サービスの運営に必要な範囲で、登録データを利用することを許諾するものとします。</li>
          <li>本サービスを構成するソフトウェア、デザイン、文章、画像、名称その他のコンテンツに関する知的財産権は、運営者または正当な権利者に帰属します。</li>
          <li>利用者は、法令上認められる場合を除き、これらを権利者の許諾なく複製、転載、配布、改変その他の方法で利用してはなりません。</li>
        </ol>
      </Section>

      <Section title="第8条(本規約の変更)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>運営者は、法令の変更、本サービスの内容・機能の変更、運営上の必要その他合理的な理由がある場合、本規約を変更することがあります。</li>
          <li>重要な変更を行う場合、運営者は、変更内容および効力発生日を、本サービス内への表示その他適切な方法により事前に周知します。</li>
          <li>変更後の本規約は、周知した効力発生日から適用されます。ただし、法令上利用者の同意が必要となる変更については、適切な方法により利用者の同意を取得します。</li>
        </ol>
      </Section>

      <Section title="第9条(準拠法・裁判管轄)">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>本規約の成立、効力、解釈および履行には日本法を適用します。</li>
          <li>本サービスまたは本規約に関して紛争が生じた場合、法令に別段の定めがある場合を除き、運営者の所在地を管轄する日本の裁判所を第一審の専属的合意管轄裁判所とします。</li>
        </ol>
      </Section>

      <Section title="第10条(お問い合わせ)">
        <p>本規約に関するお問い合わせは、メニューの「お問い合わせ」または下記メールアドレスよりご連絡ください。</p>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      <p className="text-xs text-muted-foreground pt-2 border-t">
        ※本規約は一般的な公開用文案であり、個別の法的助言を目的とするものではありません。
      </p>
    </div>
  )
}
