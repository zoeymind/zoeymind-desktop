/**
 * 主窗口关闭按钮的用户偏好.
 *
 *   ask   —— 每次弹出选择对话框 (默认)
 *   tray  —— 静默隐藏到系统托盘, 由 Rust 侧托盘图标恢复
 *   quit  —— 直接退出应用
 *
 * 持久化走全局 localStorage shim (shared/native/preferences.ts 安装),
 * 底层落盘到 SQLite app_kv 表. 写入用 localStorage.setItem(CLOSE_BEHAVIOR_KEY, value).
 */
export type CloseBehavior = "ask" | "tray" | "quit"

export const CLOSE_BEHAVIOR_KEY = "window-close-behavior"
export const DEFAULT_CLOSE_BEHAVIOR: CloseBehavior = "ask"

const VALUES: readonly CloseBehavior[] = ["ask", "tray", "quit"] as const

export function getCloseBehavior(): CloseBehavior {
  if (typeof window === "undefined") return DEFAULT_CLOSE_BEHAVIOR
  const raw = window.localStorage.getItem(CLOSE_BEHAVIOR_KEY)
  return raw !== null && (VALUES as readonly string[]).includes(raw)
    ? (raw as CloseBehavior)
    : DEFAULT_CLOSE_BEHAVIOR
}
