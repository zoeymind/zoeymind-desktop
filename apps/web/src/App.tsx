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
 *   <Toaster>             → sonner 通知
 */
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { Loading, ThemeProvider, useTheme } from "@zoeymind/ui"
import { I18nProvider, useTranslation } from "@zoeymind/i18n"
import { router } from "@/routes"
import { appLocales } from "@/locales"
import { LoadingProvider, ThemePresetProvider, useLoading } from "@/shared/app-shared"
import { RecoveryDialog } from "@/pages/RecoveryDialog"
import { FileAssociationsListener } from "@/shared/native"
import logoLightUrl from "@/assets/logo.svg?url"
import logoDarkUrl from "@/assets/logo-dark.svg?url"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
    },
  },
})

function InnerApp() {
  const { loading, tip, progress } = useLoading()
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const loadingLogoUrl = resolvedTheme === "dark" ? logoDarkUrl : logoLightUrl
  return (
    <>
      <RouterProvider router={router} />
      <RecoveryDialog />
      <FileAssociationsListener />
      <Loading
        show={loading}
        tip={tip ?? t("common.loading", "加载中...")}
        progress={progress}
        logoSrc={loadingLogoUrl}
      />
      <Toaster position="top-right" richColors />
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
