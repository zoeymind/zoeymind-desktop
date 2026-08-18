import { Button } from '../button'
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react'

interface ErrorPageProps {
  /** 大字号代码 (如 "404" / "500"); 不传则显示警告图标 */
  code?: string
  title?: string
  description?: string
  /** 开发模式下的技术错误详情 */
  error?: string
  /** 按钮文案; 不传用默认中文 */
  refreshButtonText?: string
  backButtonText?: string
  homeButtonText?: string
  showRefreshButton?: boolean
  showBackButton?: boolean
  showHomeButton?: boolean
  onRefresh?: () => void
  onBack?: () => void
  onHome?: () => void
}

/**
 * 通用错误/404 页面 — shadcn 风格, 主题色全跟随 CSS variables.
 *
 * 文案通过 props 传入 (caller 用 @zoeymind/i18n 翻译后传值); 此组件刻意不用 useTranslation,
 * 不传 prop 时 fallback 默认中文.
 *
 * 注意: 此组件可能在 Router 上下文外被渲染 (defaultErrorComponent / notFoundComponent),
 * 不用 useNavigate, 直接操作 window.location / window.history.
 */
export function ErrorPage({
  code,
  title = '出现错误',
  description = '抱歉,系统遇到了一些问题,请稍后重试',
  error,
  refreshButtonText = '重试',
  backButtonText = '返回',
  homeButtonText = '回到首页',
  showRefreshButton = true,
  showBackButton = true,
  showHomeButton = true,
  onRefresh,
  onBack,
  onHome
}: ErrorPageProps) {
  const handleRefresh = () => {
    if (onRefresh) onRefresh()
    else window.location.reload()
  }

  const handleBack = () => {
    if (onBack) onBack()
    else window.history.back()
  }

  const handleHome = () => {
    if (onHome) onHome()
    else window.location.href = '/'
  }

  return (
    <div className="h-full min-h-full flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* 大字号代码 OR 警告图标 */}
        {code ? (
          <div className="text-8xl md:text-9xl font-bold text-muted-foreground/30 tracking-tighter select-none">
            {code}
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <AlertTriangle className="size-8 text-muted-foreground" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {/* 错误详情 — 仅开发模式 */}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-left">
            <p className="text-xs font-mono text-destructive break-all whitespace-pre-wrap">
              {error}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          {showRefreshButton && (
            <Button onClick={handleRefresh} className="gap-2">
              <RefreshCw className="size-4" />
              {refreshButtonText}
            </Button>
          )}
          {showBackButton && (
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="size-4" />
              {backButtonText}
            </Button>
          )}
          {showHomeButton && (
            <Button variant="outline" onClick={handleHome} className="gap-2">
              <Home className="size-4" />
              {homeButtonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
