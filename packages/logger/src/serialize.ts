// 生产 JSON 日志的值规范化：Error 展开 + 敏感字段脱敏。
// 独立成模块，前后端共用（无 node/browser 专属 API）。

const REDACTED = '[REDACTED]'

/**
 * 把 Error 规范化成可 JSON 序列化的普通对象。
 * Error 的 message/stack/name 是不可枚举属性，Object.assign / JSON.stringify 都拿不到，
 * 直接透传会静默丢失堆栈 —— 生产排障最需要的信息。
 */
export function normalizeError(err: Error): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: err.name,
    message: err.message
  }
  if (err.stack) out.stack = err.stack
  // 递归展开 cause（Error.cause，ES2022）
  if (err.cause !== undefined) {
    out.cause = err.cause instanceof Error ? normalizeError(err.cause) : err.cause
  }
  // Error 的自定义可枚举属性（如 code、statusCode）；结构无法静态表达，一次性具名断言。
  const ownProps = err as unknown as Record<string, unknown>
  for (const key of Object.keys(err)) {
    if (!(key in out)) out[key] = ownProps[key]
  }
  return out
}

/**
 * 深度脱敏：命中 redactKeys（大小写不敏感）的字段值替换为 [REDACTED]。
 * 处理循环引用；数组逐项递归。
 */
export function redact(
  value: unknown,
  redactKeys: Set<string>,
  seen = new WeakSet<object>()
): unknown {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map(item => redact(item, redactKeys, seen))
  }

  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source)) {
    if (redactKeys.has(key.toLowerCase())) {
      out[key] = REDACTED
    } else {
      out[key] = redact(source[key], redactKeys, seen)
    }
  }
  return out
}
