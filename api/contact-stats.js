// 管理者向け: お問い合わせのAI分類件数・残り件数を確認するためのエンドポイント。
// Authorization: Bearer <ADMIN_STATS_SECRET> による認証が必須。

import {
  APP_DAILY_AI_LIMIT,
  APP_MONTHLY_AI_LIMIT,
  supabaseCount,
  jstDayStartUtcIso,
  jstMonthStartUtcIso,
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
    const [todayCount, monthCount] = await Promise.all([
      supabaseCount(`ai_classified=eq.true&created_at=gte.${jstDayStartUtcIso()}`),
      supabaseCount(`ai_classified=eq.true&created_at=gte.${jstMonthStartUtcIso()}`),
    ])

    res.status(200).json({
      today: {
        classified: todayCount,
        limit: APP_DAILY_AI_LIMIT,
        remaining: Math.max(0, APP_DAILY_AI_LIMIT - todayCount),
      },
      month: {
        classified: monthCount,
        limit: APP_MONTHLY_AI_LIMIT,
        remaining: Math.max(0, APP_MONTHLY_AI_LIMIT - monthCount),
      },
    })
  } catch (err) {
    console.error('お問い合わせ統計の取得に失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
