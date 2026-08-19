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
import { v4 as uuidV4 } from 'uuid'
import { toast as sonnerToast } from 'sonner'

// ── 1. 纯前端实用工具 ─────────────────────────────
export { cn } from '@zoeymind/ui'
export const createUUID: () => string = uuidV4
export const generateUUID: () => string = uuidV4

/**
 * toast 支持两种入参：
 *   toast('msg')                              — sonner 原生
 *   toast({ title, description, variant? })   — 老 shadcn/useToast 风格
 * 后者被产品仓大量 ProjectCard/编辑器路径使用，直接透传给 sonner 会
 * 把对象当成 React child 渲染, 报 “Objects are not valid as a React child”.
 */
type ShadcnToast = { title?: string; description?: string; variant?: 'default' | 'destructive' }
type ToastInput = string | number | ShadcnToast
function normalize(input: ToastInput): { message: string; opts?: { description?: string } } {
  if (typeof input === 'object' && input !== null && ('title' in input || 'description' in input)) {
    const { title, description } = input
    return { message: title ?? description ?? '', opts: description ? { description } : undefined }
  }
  return { message: String(input) }
}
function toastFn(input: ToastInput): string | number {
  const { message, opts } = normalize(input)
  if (typeof input === 'object' && input !== null && (input as ShadcnToast).variant === 'destructive') {
    return sonnerToast.error(message, opts)
  }
  return sonnerToast(message, opts)
}
// 挂上 sonner 的常用方法, 让 `toast.success(...)` 等仍可用
export const toast = Object.assign(toastFn, sonnerToast) as typeof toastFn & typeof sonnerToast
export const toastLoading = (message: string): string | number => sonnerToast.loading(message)
export const dismissToast = (id?: string | number): void => {
  sonnerToast.dismiss(id)
}
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): { toast: typeof toast } {
  return { toast }
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = s % 60
  return h > 0 ? `${h}h${m}m${rest}s` : m > 0 ? `${m}m${rest}s` : `${rest}s`
}

// ── 2. 主题预设 + 语言切换 ──────────────────────────
export { ThemePresetProvider, useThemePreset } from './ThemePresetProvider'
export { ThemeMenu } from './ThemeMenu'
export { LanguageSwitcher } from './LanguageSwitcher'

// ── 3. Loading Provider ──────────────────────────
export { LoadingProvider, useLoading, useLoadingStore } from './loading'

// ── 4. 云端概念 stub —— 未接入真实实现，只为编译通过 ─
export { trpc, trpcClient } from './trpc-stub'
export { useCurrentUser } from './useCurrentUser'
export { useOrganization } from './useOrganization'
export { useFeature, useFlags } from './flags'
export { useAnalytics, ANALYTICS_EVENTS } from './analytics'

// 桌面端零用户概念：以下组件都渲染 null，只是保住 barrel export 让 dormant
// 老文件（ProjectCard/ProjectsSidebar/SidebarAccountMenu 等）编译过关；
// 现役 UI 不应再使用它们。
const NULL_COMPONENT = (): null => null
export const AppLauncher = NULL_COMPONENT
export const UserAvatarWithCard = NULL_COMPONENT
export const NotificationBell = NULL_COMPONENT
export const PageHeader = NULL_COMPONENT

// CodeBlock / mentions / product 常量：mindmap features 少量 UI 用到，
// 都是本地纯 UI，不牵动网络。
export { CodeBlock } from './code-block'
export {
  processMentions,
  stripMentionsForCodeBlock,
  convertAtMentionToZTDL,
  buildMentionHtml,
  extractNodeIdFromClass,
  mentionClassName,
  getMentionMessageClassName,
  ZTDL_MENTION_REGEX,
  INLINE_CODE_ZTDL_REGEX,
  ESCAPED_ZTDL_REGEX,
  type MindMapNode,
  type MentionProcessorOptions
} from './mentions'

export type AppSharedProviderProps = { children: ReactNode }
