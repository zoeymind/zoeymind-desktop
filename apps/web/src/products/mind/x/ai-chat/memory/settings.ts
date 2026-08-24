/**
 * 长期记忆 (Semantic Recall) 偏好设置 — localStorage 持久化.
 *
 * 全部走 localStorage 是因为这是 per-browser 的偏好 (不跨设备同步),
 * 跟现有的 ai-case-review-enabled / ai-mindmap-context-enabled 一致.
 */

const KEY_ENABLED = "ai-memory-enabled"
const KEY_RECALL_K = "ai-memory-recall-k"
const KEY_RECENT_N = "ai-memory-recent-n"
// v3: desktop 没有 /api/hf-proxy；旧默认会返回 SPA index.html，必须让旧值失效。
const KEY_MIRROR_HOST = "ai-memory-mirror-host-v3"

export const MEMORY_MODEL_SOURCES = [
  { id: "mirror", host: "https://hf-mirror.com/" },
  { id: "official", host: "https://huggingface.co/" },
] as const

export const DEFAULT_MIRROR_HOST = MEMORY_MODEL_SOURCES[0].host
/** 默认召回 3 条相关历史 */
export const DEFAULT_RECALL_K = 3

/** 默认保留最近 8 条 (含当前轮 user 消息) */
export const DEFAULT_RECENT_N = 8

export function getMemoryEnabled(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(KEY_ENABLED) === "true"
}

export function setMemoryEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false")
}

export function getRecallK(): number {
  if (typeof window === "undefined") return DEFAULT_RECALL_K
  const raw = localStorage.getItem(KEY_RECALL_K)
  const n = raw ? parseInt(raw, 10) : DEFAULT_RECALL_K
  return Number.isFinite(n) && n >= 0 && n <= 20 ? n : DEFAULT_RECALL_K
}

export function setRecallK(k: number): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY_RECALL_K, String(k))
}

export function getRecentN(): number {
  if (typeof window === "undefined") return DEFAULT_RECENT_N
  const raw = localStorage.getItem(KEY_RECENT_N)
  const n = raw ? parseInt(raw, 10) : DEFAULT_RECENT_N
  return Number.isFinite(n) && n >= 2 && n <= 50 ? n : DEFAULT_RECENT_N
}

export function setRecentN(n: number): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY_RECENT_N, String(n))
}
export function getMirrorHost(): string {
  if (typeof window === "undefined") return DEFAULT_MIRROR_HOST
  const raw = localStorage.getItem(KEY_MIRROR_HOST)
  if (!raw) return DEFAULT_MIRROR_HOST
  // transformers.js 用 isValidUrl(url, ['http:', 'https:']) 校验, 必须 http(s):// 开头
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
  return DEFAULT_MIRROR_HOST
}

export function setMirrorHost(host: string): void {
  if (typeof window === "undefined") return
  const v = host.trim()
  if (!v) {
    localStorage.removeItem(KEY_MIRROR_HOST)
    return
  }
  if (v.startsWith("http://") || v.startsWith("https://")) {
    localStorage.setItem(KEY_MIRROR_HOST, v.endsWith("/") ? v : `${v}/`)
  } else {
    localStorage.removeItem(KEY_MIRROR_HOST)
  }
}
