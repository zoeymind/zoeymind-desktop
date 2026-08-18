/**
 * 桌面端应用根 —— Provider 树。
 *
 * 层级（从外到内）：
 *   QueryClientProvider   → 本地 SQLite/文件系统查询走 react-query 缓存
 *   I18nProvider          → 中英双语，appLocales 只含 mind 域 + 共享
 *   ThemeProvider         → light/dark/system，@zoeymind/ui 提供
 *   ThemePresetProvider   → 主题预设（品牌配色），本地 localStorage 存偏好
 *   LoadingProvider       → 全局 loading 提示
 *   RouterProvider        → react-router-dom / 列表 · 编辑器 · 设置
 *   <Toaster>             → sonner 顶部通知
 */
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@zoeymind/ui'
import { I18nProvider } from '@zoeymind/i18n'
import { router } from '@/routes'
import { appLocales } from '@/locales'
import { LoadingProvider } from '@/shared/app-shared/loading'
import { ThemePresetProvider } from '@/shared/app-shared/theme-preset'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false // 桌面端无网络重试语义
    }
  }
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider resources={appLocales}>
        <ThemeProvider defaultTheme="system">
          <ThemePresetProvider>
            <LoadingProvider>
              <RouterProvider router={router} />
              <Toaster position="top-right" richColors />
            </LoadingProvider>
          </ThemePresetProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
