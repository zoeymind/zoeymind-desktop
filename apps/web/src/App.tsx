/**
 * 桌面端应用根 —— Provider 树。
 *
 * 层级（从外到内）：
 *   QueryClientProvider   → 本地 SQLite/文件系统查询走 react-query 缓存
 *   I18nProvider          → 中英双语
 *   ThemeProvider         → light/dark/system
 *   ThemePresetProvider   → 主题预设 (品牌配色)
 *   LoadingProvider       → 全局 loading 状态
 *   RouterProvider        → 列表 · 编辑器 · 设置
 *   <Loading>             → 全局 loading 遮罩 (读 LoadingProvider)
 *   <Toaster>             → 跟随应用主题预设的通知
 */
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Loading, ThemeProvider, Toaster, useTheme } from "@zoeymind/ui"
import { I18nProvider, useTranslation } from "@zoeymind/i18n"
import { router } from "@/routes"
import { appLocales } from "@/locales"
import {
  LoadingProvider,
  ThemePresetProvider,
  useAppVersion,
  useLoading,
} from "@/shared/app-shared"
import { RecoveryDialog } from "@/pages/RecoveryDialog"
import { WindowCloseDialog } from "@/pages/WindowCloseDialog"
import { FileAssociationsListener, setupAppMenu } from "@/shared/native"
import { useCallback, useEffect, useState } from "react"
import logoLightUrl from "@/assets/logo.svg?url"
import logoDarkUrl from "@/assets/logo-dark.svg?url"
import { invoke } from "@tauri-apps/api/core"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
    },
  },
})

function FrontendReady({ filesReady }: { filesReady: boolean }) {
  const { resolvedTheme } = useTheme()
  const [notified, setNotified] = useState(false)

  useEffect(() => {
    if (notified || !resolvedTheme || !filesReady) return
    let cancelled = false
    void document.fonts.ready.then(async () => {
      if (cancelled) return
      await invoke("frontend_ready")
      if (!cancelled) setNotified(true)
    })
    return () => {
      cancelled = true
    }
  }, [filesReady, notified, resolvedTheme])

  return null
}
function InnerApp() {
  const [initialFilesOpened, setInitialFilesOpened] = useState(false)
  const handleInitialFilesOpened = useCallback(() => setInitialFilesOpened(true), [])
  const { loading, tip, progress } = useLoading()
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const loadingLogoUrl = resolvedTheme === "dark" ? logoDarkUrl : logoLightUrl
  useEffect(() => {
    const teardown = setupAppMenu()
    return teardown
  }, [])
  useEffect(() => {
    void useAppVersion.getState().initialize()
  }, [])
  return (
    <>
      <RouterProvider router={router} />
      <RecoveryDialog />
      <WindowCloseDialog />
      <FileAssociationsListener onInitialFilesOpened={handleInitialFilesOpened} />
      <Loading
        show={loading}
        tip={tip ?? t("common.loading", "加载中...")}
        progress={progress}
        logoSrc={loadingLogoUrl}
      />
      <FrontendReady filesReady={initialFilesOpened} />
      <Toaster position="bottom-left" />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider resources={appLocales}>
        <ThemeProvider defaultTheme="system">
          <ThemePresetProvider>
            <LoadingProvider>
              <InnerApp />
            </LoadingProvider>
          </ThemePresetProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
