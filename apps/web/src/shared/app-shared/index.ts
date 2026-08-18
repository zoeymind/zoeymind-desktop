/**
 * 桌面端极简 shim。产品仓 (`apps/zoeymind`) 的 `@/shared/app-shared`
 * 承载 tRPC / auth / org / 通知 / 分析 / OAuth 页面 / router guards
 * 一大堆云端概念；桌面端只留 products/mind 真正 import 的名字，其余
 * 一律不 re-export，源文件也从磁盘删掉。
 *
 * 分四组：
 *   1. 纯前端实用工具（真实实现）
 *   2. 主题预设（真实实现，从 @zoeymind/ui 借用）
 *   3. Loading Provider（真实实现）
 *   4. 云端概念的 no-op stub（tRPC / useCurrentUser / useOrganization / useFeature 等）
 */

import type { ReactNode } from 'react'

// ── 1. 纯前端实用工具 ─────────────────────────────
export { cn } from '@zoeymind/ui'
export { v4 as createUUID, v4 as generateUUID } from 'uuid'

/** sonner 直传，保持三行 API：toast() / toastLoading / dismissToast。 */
export const toast = sonnerToast
export const toastLoading = (message: string): string | number => sonnerToast.loading(message)
export const dismissToast = (id?: string | number): void => sonnerToast.dismiss(id)
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): { toast: typeof sonnerToast } {
  return { toast: sonnerToast }
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = s % 60
  return h > 0 ? `${h}h${m}m${rest}s` : m > 0 ? `${m}m${rest}s` : `${rest}s`
}

// ── 2. 主题预设 ──────────────────────────────────
export {
  ThemePresetProvider,
  useThemePreset,
  ThemeMenu
} from './theme-preset'

// ── 3. Loading Provider ──────────────────────────
export { LoadingProvider, useLoading } from './loading'

// ── 4. 云端概念 stub —— 未接入真实实现，只为编译通过 ─
export { trpc, trpcClient } from './trpc-stub'
export { useCurrentUser } from './useCurrentUser'
export { useOrganization } from './useOrganization'
export { useFeature, useFlags } from './flags'
export { useAnalytics, ANALYTICS_EVENTS } from './analytics'

// 桌面端零用户概念：不 export UserAvatarWithCard / AppLauncher / 个人中心相关组件。
// mind features 里对这些名字的引用需要在使用点直接删掉，而不是在 shim 里给假组件。

// CodeBlock / mentions / product 常量：mindmap features 少量 UI 用到，
// 都是本地纯 UI，不牵动网络。
export { CodeBlock } from './code-block'
export {
  processMentions,
  stripMentionsForCodeBlock,
  type MindMapNode,
  type MentionProcessorOptions
} from './mentions'

export type AppSharedProviderProps = { children: ReactNode }
