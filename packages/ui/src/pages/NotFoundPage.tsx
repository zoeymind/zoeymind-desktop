import { Button } from '../button'
import { useNavigate } from '@tanstack/react-router'
import { Home, ArrowLeft } from 'lucide-react'

interface NotFoundPageProps {
  title?: string
  description?: string
  showBackButton?: boolean
  showHomeButton?: boolean
  onBack?: () => void
  onHome?: () => void
}

/**
 * 404页面组件
 * 用于显示页面不存在的状态
 */
export function NotFoundPage({
  title = '页面不存在',
  description = '抱歉，您访问的页面不存在或已被移除',
  showBackButton = true,
  showHomeButton = true,
  onBack,
  onHome
}: NotFoundPageProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      window.history.back()
    }
  }

  const handleHome = () => {
    if (onHome) {
      onHome()
    } else {
      navigate({ to: '/' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {/* 404图标 */}
        <div className="mb-8">
          <div className="text-8xl font-bold text-muted-foreground/20 mb-2">404</div>
          <div className="w-24 h-1 bg-primary mx-auto rounded-full"></div>
        </div>

        {/* 标题和描述 */}
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">{description}</p>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
              <ArrowLeft className="size-4" />
              返回上页
            </Button>
          )}
          {showHomeButton && (
            <Button onClick={handleHome} className="flex items-center gap-2">
              <Home className="size-4" />
              回到首页
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
