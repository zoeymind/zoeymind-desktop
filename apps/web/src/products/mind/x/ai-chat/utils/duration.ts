export function formatElapsedMs(durationMs: unknown): string | null {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) return null
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`

  const seconds = durationMs / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`
}
