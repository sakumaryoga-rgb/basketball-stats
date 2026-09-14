// client_errorsへ送る前にmessage/stackから秘密情報らしき文字列を除去する保険的な処理。
// アプリ側で意図的にトークン等を渡すことは無いが、fetchのエラーメッセージ等に
// URLがそのまま含まれるケースがあるため、二重防御としてマスクしておく。

const MAX_MESSAGE_LENGTH = 500
const MAX_STACK_LENGTH = 2000

function maskSecrets(text) {
  return text
    .replace(/\?[^\s"')]+/g, '') // URLのクエリ文字列
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [redacted]') // Authorizationヘッダらしき文字列
    .replace(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[redacted-jwt]') // JWT形式
    .replace(/\/t\/[A-Za-z0-9]{20,}/g, '/t/[redacted]') // 共有招待URLのトークン部分
}

export function sanitizeMessage(message) {
  if (!message) return ''
  return maskSecrets(String(message)).slice(0, MAX_MESSAGE_LENGTH)
}

export function sanitizeStack(stack) {
  if (!stack) return null
  return maskSecrets(String(stack)).slice(0, MAX_STACK_LENGTH)
}
