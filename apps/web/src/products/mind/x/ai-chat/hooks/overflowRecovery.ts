import type { ChatErrorCode } from "../utils/errorHandler"

const attempted = new Set<string>()
const recovering = new Set<string>()
const surfaced = new Set<string>()

export function markOverflowError(code: ChatErrorCode, attemptKey: string | null): void {
  if (code === "CONTEXT_OVERFLOW" && attemptKey && attempted.has(attemptKey)) {
    surfaced.add(attemptKey)
  }
}

export function scheduleOverflowRecovery(input: {
  code: ChatErrorCode | null
  attemptKey: string | null
  isError: boolean
  hasToolPart: boolean
  regenerate: (attemptKey: string) => void
}): boolean {
  if (
    !input.isError ||
    input.code !== "CONTEXT_OVERFLOW" ||
    !input.attemptKey ||
    input.hasToolPart ||
    attempted.has(input.attemptKey)
  ) {
    return false
  }
  const attemptKey = input.attemptKey
  attempted.add(attemptKey)
  recovering.add(attemptKey)
  setTimeout(() => input.regenerate(attemptKey), 0)
  return true
}

export function shouldSuppressOverflowError(
  code: ChatErrorCode,
  attemptKey: string | null
): boolean {
  return Boolean(
    code === "CONTEXT_OVERFLOW" &&
    attemptKey &&
    recovering.has(attemptKey) &&
    !surfaced.has(attemptKey)
  )
}

export function clearOverflowRecovery(attemptKey: string): void {
  attempted.delete(attemptKey)
  recovering.delete(attemptKey)
  surfaced.delete(attemptKey)
}

export function resetOverflowRecovery(): void {
  attempted.clear()
  recovering.clear()
  surfaced.clear()
}
