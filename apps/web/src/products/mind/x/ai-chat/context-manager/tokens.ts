/**
 * estimateTokens — 粗略估算文本 token 数, 用于决定 diff 是否回退为 FULL.
 *
 * 系数沿用原 MindmapContextManager.estimateTokens (不要随意调整, 阈值是和它一起调过的):
 *   - CJK 字符 (U+4E00..U+9FFF): 1.5 token
 *   - ASCII 可打印字符 (0x20..0x7E): 0.25 token
 *   - 其它字符 (空格 / 换行 / 其它 Unicode): 0.5 token
 * 最后向上取整.
 */

export function estimateTokens(text: string): number {
  let tokenCount = 0
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i)
    if (charCode >= 0x4e00 && charCode <= 0x9fff) {
      tokenCount += 1.5
    } else if (charCode >= 0x0020 && charCode <= 0x007e) {
      tokenCount += 0.25
    } else {
      tokenCount += 0.5
    }
  }
  return Math.ceil(tokenCount)
}
