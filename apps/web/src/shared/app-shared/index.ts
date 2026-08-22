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

import type { ReactNode } from "react"
import { v4 as uuidV4 } from "uuid"
import {
  dismissToast as dismissUiToast,
  toast as uiToast,
  toastLoading as uiToastLoading,
  type ToastOptions,
  type ToastVariant,
} from "@zoeymind/ui"

// ── 1. 纯前端实用工具 ─────────────────────────────
export { cn } from "@zoeymind/ui"
export const createUUID: () => string = uuidV4
export const generateUUID: () => string = uuidV4

/**
 * 兼容产品仓现有两种调用形式，同时统一发送到 @zoeymind/ui 的主题化 Toaster。
 */
type ToastInput = string | number | ToastOptions
type ToastMethod = (
  message: string | number,
  options?: Omit<ToastOptions, "description" | "variant">
) => string
type ToastApi = ((input: ToastInput) => string) & {
  success: ToastMethod
  error: ToastMethod
  warning: ToastMethod
  info: ToastMethod
  loading: (message: string | number, options?: { id?: string | number }) => string
  dismiss: (id?: string | number) => void
}

function normalizeToast(input: ToastInput): ToastOptions | string {
  return typeof input === "object" && input !== null ? input : String(input)
}

function createVariantToast(variant: ToastVariant): ToastMethod {
  return (message, options) => uiToast({ ...options, description: String(message), variant })
}

function toastFn(input: ToastInput): string {
  return uiToast(normalizeToast(input))
}

export const toast = Object.assign(toastFn, {
  success: createVariantToast("success"),
  error: createVariantToast("destructive"),
  warning: createVariantToast("warning"),
  info: createVariantToast("info"),
  loading: (message: string | number, options?: { id?: string | number }) =>
    uiToastLoading(String(message), String(options?.id ?? `loading-${Date.now()}`)),
  dismiss: dismissUiToast,
}) as ToastApi

export const toastLoading = (message: string, id = `loading-${Date.now()}`): string =>
  uiToastLoading(message, id)
export const dismissToast = dismissUiToast

export function useToast(): { toast: ToastApi } {
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
export { ThemePresetProvider, useThemePreset } from "./ThemePresetProvider"
export { ThemeMenu } from "./ThemeMenu"
export { LanguageSwitcher } from "./LanguageSwitcher"

// ── 3. Loading Provider ──────────────────────────
export { LoadingProvider, useLoading, useLoadingStore } from "./loading"
export { AppVersionStatus } from "./AppVersionStatus"
export { useAppVersion } from "./app-version-store"
export { useSettingsDialog, type SettingsSectionId } from "./settings-dialog-store"

// ── 4. 云端概念 stub —— 未接入真实实现，只为编译通过 ─
export { trpc, trpcClient } from "./trpc-stub"
export { useCurrentUser } from "./useCurrentUser"
export { useOrganization } from "./useOrganization"
export { useFeature, useFlags } from "./flags"
export { useAnalytics, ANALYTICS_EVENTS } from "./analytics"

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
export { CodeBlock } from "./code-block"
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
  type MentionProcessorOptions,
} from "./mentions"

export type AppSharedProviderProps = { children: ReactNode }
