import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { PRIVACY_VERSION } from '@/lib/legal'

const CONTACT_EMAIL = 'sakumaryoga@gmail.com'

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

  // オンボーディングの同意ポップアップで「確認済み」と判定するための既読マーク
  useEffect(() => {
    sessionStorage.setItem('viewedPrivacyVersion', PRIVACY_VERSION)
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        戻る
      </button>

      <div>
        <h1 className="text-2xl font-heading tracking-wide">プライバシーポリシー</h1>
        <p className="text-xs text-muted-foreground mt-1">最終更新日: 2026年9月8日</p>
      </div>

      <Section title="1. はじめに">
        <p>
          本プライバシーポリシー(以下「本ポリシー」といいます)は、BASKETBALL STATS(以下「本サービス」といいます)における利用者情報および本サービスに登録される情報の取扱いについて定めるものです。
        </p>
      </Section>

      <Section title="2. 取得・保存する情報">
        <p>本サービスでは、サービスの提供に必要な範囲で、以下の情報を取得または保存します。</p>
        <p className="text-foreground font-medium">(1) チームに関する情報</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>チーム名</li>
          <li>
            共有URLのハッシュ値(チームへのアクセスに用いる共有URL自体は発行・再発行の直後にのみ表示され、その平文はデータベースに保存されません。第三者が推測・復元できない形式に変換したうえで、一致確認のためだけに保存します)
          </li>
          <li>チームアイコン画像</li>
          <li>その他、利用者が任意に登録するチーム情報</li>
        </ul>
        <p className="text-foreground font-medium">(2) 選手に関する情報</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>氏名または表示名</li>
          <li>背番号・ポジション</li>
          <li>写真</li>
          <li>その他、利用者が任意に入力するプロフィール情報</li>
        </ul>
        <p className="text-xs">
          ※身長・体重については、プライバシー保護の観点から2026年9月8日以降、本サービスでの取得・保存を廃止しました。
        </p>
        <p className="text-foreground font-medium">(3) バスケットボールの記録に関する情報</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>試合、スクリメージ、シューティング練習等の記録</li>
          <li>得点、シュート、リバウンド、アシストその他のスタッツ</li>
        </ul>
        <p className="text-foreground font-medium">(4) アカウント・端末識別に関する情報</p>
        <p>
          本サービスでは、メールアドレスおよびパスワードによる通常の会員登録を必須とせず、端末等に対して自動的に発行される匿名アカウント(Supabase
          Authによる匿名認証)により、チームへの参加や利用状態を管理します。
        </p>
        <p className="text-foreground font-medium">(5) 技術情報</p>
        <p>
          本サービスのホスティングを行うVercelおよびデータベース・認証基盤を提供するSupabaseにおいて、サービスの提供、セキュリティ確保、障害調査等のため、IPアドレス、端末・OS・ブラウザに関する情報、アクセス日時、エラー情報その他のアクセスログが、これらの提供事業者により自動的に取得される場合があります。
        </p>
        <p className="text-foreground font-medium">(6) お問い合わせ内容</p>
        <p>
          アプリ内の「お問い合わせ」フォームからご連絡いただいた場合、その本文および任意でご記入いただいた返信用メールアドレスを取得します。また、不正な大量送信を防止する目的で、送信元IPアドレスおよび問い合わせ本文を、他の情報と照合できない形式(ハッシュ化)に変換したうえで一時的に保存します。
        </p>
        <p>
          本サービスでは、選手の実名登録を必須としていません。利用者は、必要に応じてニックネーム、イニシャルその他本人を直接特定しにくい表示名を利用できます。
        </p>
      </Section>

      <Section title="3. 情報の利用目的">
        <p>取得した情報は、以下の目的で利用します。</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>チームの作成、参加および管理機能を提供するため</li>
          <li>選手情報、試合記録、練習記録およびスタッツの登録、集計、表示、共有機能を提供するため</li>
          <li>同一チームのメンバー間で必要な情報を共有するため</li>
          <li>本サービスの利用状態を維持するため</li>
          <li>不正利用の防止、セキュリティの確保および障害・不具合の調査、対応を行うため</li>
          <li>利用者からのお問い合わせに対応し、内容を分類して対応の優先順位を検討するため</li>
          <li>本サービスの機能改善および品質向上を行うため</li>
        </ul>
        <p>現時点では、取得した情報を第三者広告の配信や、広告目的のプロファイリングのために利用していません。</p>
      </Section>

      <Section title="4. データの保存・安全管理・外部サービス">
        <p>本サービスでは、サービス提供のため、主に以下の外部サービスを利用しています。</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Supabase(用途: 匿名認証、データベース、画像等のストレージその他バックエンド機能。サーバーはシンガポールに所在)</li>
          <li>Vercel(用途: 本サービスのホスティング、配信その他インフラ機能)</li>
          <li>Notion(用途: お問い合わせ内容の課題管理・保存)</li>
          <li>Anthropic API(用途: お問い合わせ内容の自動分類[種別・重要度・修正難易度の判定])</li>
        </ul>
        <p>
          これらのサービス提供者は、本サービスの提供に必要な範囲で情報を処理する場合があります。上記のとおり本サービスのデータベースは日本国外(シンガポール)で運用されており、本サービスをご利用いただくことにより、情報が日本国外で処理・保存されることに同意いただいたものとします。各サービス提供者による情報の取扱いについては、それぞれの利用規約、プライバシーポリシーその他の定めが適用されます。
        </p>
        <p>
          運営者は、取得・保存する情報について、不正アクセス、漏えい、滅失または毀損等の防止その他適切な管理に努めます。ただし、インターネット上の通信または電子的な保存方法について、完全な安全性を保証するものではありません。
        </p>
      </Section>

      <Section title="5. 情報の共有・第三者への提供">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>チームに登録された選手情報、写真、試合記録、スタッツその他のチームデータは、そのチームの共有URLを知っている全ての者の間で共有されます。共有URLを知る者は、原則としてチーム内のすべての登録データを閲覧・編集できます。</li>
          <li>運営者は、利用者情報を第三者へ販売しません。</li>
          <li>
            運営者は、次の場合を除き、取得した情報を本サービスの提供に必要な範囲を超えて第三者へ提供しません。
            <ul className="list-disc pl-5 flex flex-col gap-1 mt-1">
              <li>本サービスの運営に必要な業務を外部サービス提供者等へ委託する場合</li>
              <li>利用者本人の同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要であり、本人の同意を得ることが困難である場合</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="6. データ・チームの削除">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>
            利用者は、チーム設定画面の「このチームを退出する」機能により、当該端末の匿名アカウントとチームとの紐付けをいつでも解除できます。この操作はチームからの離脱を意味するのみであり、匿名アカウント自体やチームに残る他のデータは削除されません。
          </li>
          <li>
            チーム設定画面の「このチームを削除する」機能により、チームおよびそのチームに属する選手情報・試合記録・スタッツ等はデータベースから完全に削除されます。ただし、アップロードされた画像ファイル(選手の写真・チームアイコン)については、システムの都合上、削除後もストレージ上に残存する場合があります。画像の完全な削除をご希望の場合は、第10項のお問い合わせ先までご連絡ください。
          </li>
          <li>
            利用者は、アカウント設定画面の「この端末のアカウントを削除する」機能により、この端末の匿名アカウントをいつでも削除できます。この操作により、この端末が参加している全てのチームへの参加情報、お問い合わせ機能に関する技術的なログ等が削除されます。ただし、チームの選手・試合・スタッツ等の記録は、他のメンバーも利用する共有データであるため削除されません。
          </li>
          <li>削除のご依頼をいただいた場合、合理的な期間内(目安として30日以内)に対応いたします。法令上保持が必要な情報については、必要な期間保存する場合があります。</li>
        </ol>
      </Section>

      <Section title="7. localStorage、Cookieおよびトラッキング">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>
            本サービスでは、ログイン状態、表示中のチームその他利用状態を維持するため、ブラウザのlocalStorageその他端末内の保存機能を利用しています。この端末でチームを作成または共有URLで参加した際は、チーム設定画面で再確認できるよう、そのURLもあわせてこの端末内にのみ保存します(サーバーには保存されません)。
          </li>
          <li>現時点では、第三者広告の配信を目的としたトラッキングを行っていません。</li>
          <li>将来、広告機能、アクセス解析機能その他新たなデータ利用を開始する場合には、必要に応じて本ポリシーを改定し、法令上必要な場合には、適切な表示または同意取得を行います。</li>
        </ol>
      </Section>

      <Section title="8. 第三者・未成年者に関する情報">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>利用者が他の選手、チームメンバーその他第三者に関する氏名、写真、身体情報その他の情報を本サービスへ登録する場合、必要な権利、権限または同意を確認したうえで登録してください。</li>
          <li>未成年者に関する氏名、写真、身体情報その他の情報を登録する場合は、年齢、情報の内容および利用状況に応じて、本人または保護者等から必要な同意を得たうえで登録してください。</li>
          <li>本サービスへの第三者に関する情報の登録は、登録を行う利用者の責任において行うものとします。</li>
        </ol>
      </Section>

      <Section title="9. 本ポリシーの変更">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>運営者は、法令の変更、本サービスの機能変更、取得する情報または利用目的の変更その他必要に応じて、本ポリシーを変更することがあります。</li>
          <li>利用者への影響が大きい重要な変更を行う場合、本サービス内への表示その他適切な方法により、変更内容および効力発生日を事前にお知らせします。</li>
          <li>法令上利用者の同意が必要となる変更については、適切な方法により同意を取得します。</li>
        </ol>
      </Section>

      <Section title="10. お問い合わせ">
        <p>
          本ポリシー、利用者情報またはデータの削除等に関するお問い合わせは、メニューの「お問い合わせ」フォームまたは下記メールアドレスよりご連絡ください。
        </p>
        <p>
          メニューの「お問い合わせ」フォームからご連絡いただいた内容(本文および任意でご記入いただいた返信用メールアドレス)は、課題管理のためNotion上のデータベースに保存されるとともに、内容の分類(種別・重要度・修正難易度の判定)のためClaude(Anthropic
          API)による自動処理が行われます。これらの情報は、お問い合わせへの対応以外の目的には利用しません。返信用に任意でご記入いただいたメールアドレスは、対応完了から90日以内に自動的に削除されます。
        </p>
        <p>
          下記メールアドレスへ直接ご連絡いただいた場合は、通常の電子メールとして運営者に届きます。
        </p>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      <p className="text-xs text-muted-foreground pt-2 border-t">
        ※本ポリシーは一般的な公開用文案であり、個別の法的助言を目的とするものではありません。
      </p>
    </div>
  )
}
