// お問い合わせフォームの受付エンドポイント。
//
// Anthropic APIの従量課金がスパムや大量送信で増大しないよう、以下の順でチェックする。
//   1. ユーザー単位のレート制限(1時間3件 / 1日10件)
//   2. bot(Cloudflare Turnstile・ハニーポット・送信間隔)・重複・文字数のチェック
//   3・4. アプリ全体の日次(100件/日)・月次(2,000件/月)AI利用枠(JST)を、
//         Anthropic APIを呼び出す直前にPostgres関数(contact_try_consume_ai_quota)で
//         アトミックに確認・消費する。同時リクエストがあっても行ロックにより上限を超えない。
// すべて満たした場合のみAnthropic APIを呼ぶ。1〜4のいずれかで超過していても、
// bot判定・重複でない限り問い合わせ自体は必ずNotionへ保存し、AI分類のみスキップする。
// 上限は「Anthropic APIへの呼び出し試行件数」を基準とし、成功・失敗・パース失敗を問わず
// 呼び出した時点で1件消費済みとして扱う(分類の成否は`ai_classified`で別途集計する)。
// AI分類は1リクエストにつき最大1回のみ試行し、自動リトライは行わない
// (失敗時は即座に「未分類(AI失敗)」としてNotionへ保存する。課金抑制を優先するため)。
//
// 秘密鍵(ANTHROPIC_API_KEY / NOTION_API_KEY / NOTION_DATABASE_ID / SUPABASE_SERVICE_ROLE_KEY /
// CONTACT_HASH_SALT / TURNSTILE_SECRET_KEY)はVercelの環境変数からのみ読み、クライアントには一切渡さない。

import { createHash } from 'node:crypto'
import {
  APP_DAILY_AI_LIMIT,
  APP_MONTHLY_AI_LIMIT,
  supabaseRequest,
  supabaseCount,
  supabaseRpc,
  jstDateKey,
  jstMonthKey,
} from './_lib/contact-shared.js'

const NOTION_VERSION = '2022-06-28'

const MIN_MESSAGE_LENGTH = 10
const MAX_MESSAGE_LENGTH = 2000
const USER_HOURLY_LIMIT = 3
const USER_DAILY_LIMIT = 10
const DEDUP_WINDOW_MINUTES = 5
const MIN_ELAPSED_MS = 800 // フォーム表示から送信までがこれより速い場合はbotとみなす
const CLASSIFY_INPUT_MAX_CHARS = 800 // Anthropicに渡す本文は先頭800文字までに抑える

const AI_STATUS = {
  CLASSIFIED: '分類済み',
  AI_FAILED: '未分類(AI失敗)',
  APP_CAP_REACHED: 'AI上限到達(未分類)',
  USER_LIMITED: '未分類(利用者上限)',
}

const CLASSIFY_TOOL = {
  name: 'classify_inquiry',
  description: 'バスケットボールスタッツ記録アプリへの問い合わせ内容を分類する',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '問い合わせ内容を要約した30文字以内の日本語タイトル' },
      type: { type: 'string', enum: ['バグ報告', '機能要望', '使い方の質問', 'その他'] },
      importance: { type: 'string', enum: ['高', '中', '低'] },
      difficulty: { type: 'string', enum: ['小', '中', '大', '該当なし'] },
    },
    required: ['title', 'type', 'importance', 'difficulty'],
  },
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hashIp(ip) {
  return sha256Hex(`${ip}:${process.env.CONTACT_HASH_SALT || ''}`)
}

function normalizeMessage(message) {
  return message.trim().toLowerCase().replace(/\s+/g, ' ')
}

function hashMessage(message) {
  return sha256Hex(`${normalizeMessage(message)}:${process.env.CONTACT_HASH_SALT || ''}`)
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

// 匿名認証(Supabase Auth)のアクセストークンをGoTrueで検証し、なりすましのuser_idを防ぐ
async function verifySupabaseUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) return null
  const data = await response.json()
  return data?.id || null
}

// Cloudflare Turnstileでスクリプトによる直接API呼び出し(Supabase匿名アカウントの大量作成等)を防ぐ。
// TURNSTILE_SECRET_KEY未設定の間は無効化し、既存のフォーム機能をブロックしない(段階的導入)。
async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET_KEY) return true
  if (!token) return false

  const params = new URLSearchParams()
  params.append('secret', process.env.TURNSTILE_SECRET_KEY)
  params.append('response', token)
  if (ip) params.append('remoteip', ip)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    if (!response.ok) return false
    const data = await response.json()
    return Boolean(data.success)
  } catch (err) {
    console.error('Turnstile検証に失敗しました', err)
    return false
  }
}

// AI分類は必須処理ではないため、失敗時は即「未分類(AI失敗)」としてNotionへ保存する方針とし、
// 自動リトライは行わない(課金抑制を優先し、日次・月次上限の集計もリクエストごとに1対1で単純化するため)。
async function classifyInquiry(message) {
  const truncated = message.slice(0, CLASSIFY_INPUT_MAX_CHARS)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: 'tool', name: 'classify_inquiry' },
      messages: [
        {
          role: 'user',
          content:
            '以下は「BASKETBALL STATS」というバスケットボールのチームスタッツ記録アプリへの問い合わせです。' +
            `内容を分類してください。\n\n---\n${truncated}\n---`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const toolUse = data.content?.find((block) => block.type === 'tool_use')
  if (!toolUse) throw new Error('分類結果が取得できませんでした')
  return toolUse.input
}

async function createNotionPage({ message, email, classification, aiStatus }) {
  const properties = {
    名前: { title: [{ text: { content: classification?.title || '問い合わせ' } }] },
    内容: { rich_text: [{ text: { content: message.slice(0, 2000) } }] },
    種別: { select: { name: classification?.type || 'その他' } },
    重要度: { select: { name: classification?.importance || '中' } },
    修正難易度: { select: { name: classification?.difficulty || '該当なし' } },
    ステータス: { select: { name: '未対応' } },
    受信日時: { date: { start: new Date().toISOString() } },
    AI分類状況: { select: { name: aiStatus } },
  }
  if (email) {
    properties.連絡先メール = { email }
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties,
    }),
  })

  if (!response.ok) {
    throw new Error(`Notion API error: ${response.status} ${await response.text()}`)
  }
  const page = await response.json()
  return page.id
}

async function logSubmission({ userId, ipHash, messageHash, aiClassified, notionPageId }) {
  await supabaseRequest('/rest/v1/contact_submissions', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: [
      {
        user_id: userId,
        ip_hash: ipHash,
        message_hash: messageHash,
        ai_classified: aiClassified,
        notion_page_id: notionPageId,
      },
    ],
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const { message, email, website, renderedAt, turnstileToken } = req.body ?? {}
  if (typeof message !== 'string') {
    res.status(400).json({ error: 'invalid message' })
    return
  }
  if (email != null && typeof email !== 'string') {
    res.status(400).json({ error: 'invalid email' })
    return
  }

  const userId = await verifySupabaseUser(req.headers['authorization'])
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const clientIp = getClientIp(req)

  try {
    // --- 1. ユーザー単位のレート制限 ---
    const [hourCount, dayCount] = await Promise.all([
      supabaseCount(`user_id=eq.${userId}&created_at=gte.${new Date(Date.now() - 60 * 60 * 1000).toISOString()}`),
      supabaseCount(`user_id=eq.${userId}&created_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`),
    ])
    const userLimited = hourCount >= USER_HOURLY_LIMIT || dayCount >= USER_DAILY_LIMIT

    // --- 2. bot・重複・文字数のチェック ---
    const elapsed = typeof renderedAt === 'number' ? Date.now() - renderedAt : Infinity
    const turnstileOk = await verifyTurnstile(turnstileToken, clientIp)
    const isBot = Boolean(website) || elapsed < MIN_ELAPSED_MS || !turnstileOk
    if (isBot) {
      // botには通常送信と同じ成功レスポンスを返し、検知していることを悟らせない。Notion保存・AI分類は行わない。
      res.status(200).json({ ok: true })
      return
    }

    const trimmed = message.trim()
    if (trimmed.length < MIN_MESSAGE_LENGTH || trimmed.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: 'invalid message length' })
      return
    }

    const messageHash = hashMessage(trimmed)
    const dedupCount = await supabaseCount(
      `user_id=eq.${userId}&message_hash=eq.${messageHash}&created_at=gte.${new Date(
        Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000
      ).toISOString()}`
    )
    if (dedupCount > 0) {
      res.status(429).json({ error: 'duplicate submission' })
      return
    }

    const ipHash = hashIp(clientIp)

    let classification = null
    let aiStatus
    let aiClassified = false

    if (userLimited) {
      aiStatus = AI_STATUS.USER_LIMITED
    } else {
      // --- 3・4. アプリ全体の日次・月次AI利用枠(JST暦日・暦月)をアトミックに確認+消費 ---
      // Anthropic APIを呼び出す「直前」に枠を1件消費する。成功・失敗を問わず、
      // 呼び出した時点でこの枠は戻さない(呼び出し試行件数そのものが課金上限の基準のため)。
      let quotaAvailable = false
      try {
        quotaAvailable = await supabaseRpc('contact_try_consume_ai_quota', {
          p_daily_key: jstDateKey(),
          p_daily_limit: APP_DAILY_AI_LIMIT,
          p_monthly_key: jstMonthKey(),
          p_monthly_limit: APP_MONTHLY_AI_LIMIT,
        })
      } catch (err) {
        console.error('AI利用枠の確保に失敗したため、AI分類をスキップします', err)
        quotaAvailable = false
      }

      if (!quotaAvailable) {
        aiStatus = AI_STATUS.APP_CAP_REACHED
      } else {
        try {
          classification = await classifyInquiry(trimmed)
          aiStatus = AI_STATUS.CLASSIFIED
          aiClassified = true
        } catch (err) {
          console.error('Anthropic分類に失敗しましたが、Notionへの保存は継続します', err)
          aiStatus = AI_STATUS.AI_FAILED
        }
      }
    }

    // 返信用メールアドレスはAnthropic APIへ送信せず、Notion保存のみに使う
    const notionPageId = await createNotionPage({
      message: trimmed,
      email: email?.trim() || null,
      classification,
      aiStatus,
    })

    await logSubmission({ userId, ipHash, messageHash, aiClassified, notionPageId })

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('お問い合わせの処理に失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
