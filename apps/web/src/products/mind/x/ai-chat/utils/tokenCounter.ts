// @ts-nocheck — 桌面端不装 js-tiktoken; 用最简 chars/4 估算.
export function countTokens(text: string): number {
  return Math.ceil((text ?? '').length / 4)
}

export function countMessageTokens(message: { content?: string; parts?: Array<{ text?: string }> } | string): number {
  if (typeof message === 'string') return countTokens(message)
  const parts = message?.parts?.map(p => p?.text ?? '').join('') ?? ''
  return countTokens(message?.content ?? parts)
}

export function resetTokenizer(): void {
  // no-op
}

export function countTokensInValue(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'string') return countTokens(value)
  try {
    return countTokens(JSON.stringify(value))
  } catch {
    return 0
  }
}
