// 管理者向け: お問い合わせのAI試行件数・分類成功件数・残り件数を確認するためのエンドポイント。
// Authorization: Bearer <ADMIN_STATS_SECRET> による認証が必須。
//
// 「AI試行件数」(attempts)がAnthropic APIへの実際の呼び出し試行件数=課金上限の基準。
// 「AI分類成功件数」(classified)はそのうち分類まで成功した件数で、参考情報として別集計する。

import {
  APP_DAILY_AI_LIMIT,
  APP_MONTHLY_AI_LIMIT,
  supabaseCount,
  getAiUsageCount,
  jstDayStartUtcIso,
  jstMonthStartUtcIso,
  jstDateKey,
  jstMonthKey,
} from './_lib/contact-shared.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const authHeader = req.headers['authorization']
  if (!process.env.ADMIN_STATS_SECRET || authHeader !== `Bearer ${process.env.ADMIN_STATS_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  try {
    const [dailyAttempts, monthlyAttempts, dailyClassified, monthlyClassified] = await Promise.all([
      getAiUsageCount('daily', jstDateKey()),
      getAiUsageCount('monthly', jstMonthKey()),
      supabaseCount(`ai_classified=eq.true&created_at=gte.${jstDayStartUtcIso()}`),
      supabaseCount(`ai_classified=eq.true&created_at=gte.${jstMonthStartUtcIso()}`),
    ])

    res.status(200).json({
      today: {
        attempts: dailyAttempts,
        classified: dailyClassified,
        limit: APP_DAILY_AI_LIMIT,
        remaining: Math.max(0, APP_DAILY_AI_LIMIT - dailyAttempts),
      },
      month: {
        attempts: monthlyAttempts,
        classified: monthlyClassified,
        limit: APP_MONTHLY_AI_LIMIT,
        remaining: Math.max(0, APP_MONTHLY_AI_LIMIT - monthlyAttempts),
      },
    })
  } catch (err) {
    console.error('お問い合わせ統計の取得に失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
