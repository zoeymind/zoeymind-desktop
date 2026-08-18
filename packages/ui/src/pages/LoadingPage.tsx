import { Loader2 } from 'lucide-react'

interface LoadingPageProps {
  title?: string
  description?: string
  showSpinner?: boolean
}

/**
 * 加载页面组件
 * 用于显示加载中状态
 */
export function LoadingPage({
  title = '加载中',
  description = '正在为您准备内容，请稍候...',
  showSpinner = true
}: LoadingPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {/* 加载动画 */}
        {showSpinner && (
          <div className="mb-8">
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="size-10 text-primary animate-spin" />
            </div>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full animate-pulse"></div>
          </div>
        )}

        {/* 标题和描述 */}
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
