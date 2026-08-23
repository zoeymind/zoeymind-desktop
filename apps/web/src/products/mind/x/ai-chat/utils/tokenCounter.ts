/**
 * tokenCounter — 给 UI 与压缩预算估 token 数.
 *
 * 实现: CJK 感知字符启发式 (中文 ≈0.75 token/字, 其余 ≈0.26 token/字符),
 * 对 o200k_base 实测平均误差 ~32%, 且系统性偏保守(只高估不低估):
 *   - 高估方向安全: ContextCompactor 触发压缩略早只是省上下文;
 *     低估才会让请求撞真实 API 上限.
 *
 * 为什么不用 tiktoken: o200k 词表静态打包占主 chunk ~29%(2.3MB), 首次构造
 * ~240ms, 每次 encode 随上下文线性增长(40K 字符 ≈22ms, 400K ≈210ms), 全在主线程.
 * 而这里的两个消费方都不需要逐字节精度:
 *   - ContextCompactor: occupancy = max(localEstimate, providerUsage), 每轮完成后
 *     provider 返回的精确 totalUsage 兜底, 启发式只作用于增量部分; 压缩触发本身
 *     还有 trigger 预算余量.
 *   - ToolCallCard "~N tokens": 纯展示.
 *
 * 历史注: 曾用 js-tiktoken/lite + o200k_base 静态词表, 因上述启动与主线程成本移除.
 * 若未来需要精确计数, 以动态 import 方式回归, 不要静态打包词表.
 */

/** CJK 统一表意/标点/全角/假名范围 (粗粒度即可, 只求分桶) */
function isCjkChar(code: number): boolean {
  return (
    (code >= 0x3000 && code <= 0x9fff) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x3040 && code <= 0x30ff)
  )
}

const CJK_TOKEN_WEIGHT = 0.75
const OTHER_CHARS_PER_TOKEN = 1 / 0.26

/**
 * 同步估算一段文本的 token 数. 非空文本至少返回 1.
 *
 * 注: 对 OpenAI 系是近似, 对 Anthropic / Google 同样是近似 (它们的 tokenizer 不公开);
 * 精确值以 provider 返回的 usage 为准.
 */
export function countTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  for (let i = 0; i < text.length; i++) {
    if (isCjkChar(text.charCodeAt(i))) cjk++
  }
  const other = text.length - cjk
  return Math.max(1, Math.ceil(cjk * CJK_TOKEN_WEIGHT + other * OTHER_CHARS_PER_TOKEN))
}

/**
 * 给任意 JSON-able 值估 token 数 (会先 JSON.stringify).
 * 给 ToolCallCard 显示 input + output 体积用.
 */
export function countTokensInValue(value: unknown): number {
  if (value == null) return 0
  if (typeof value === "string") return countTokens(value)
  try {
    const serialized = JSON.stringify(value)
    return countTokens(serialized)
  } catch {
    return 0
  }
}
