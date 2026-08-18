import { Button } from '../button'
import { useNavigate } from '@tanstack/react-router'
import { Shield, ArrowLeft, LogIn } from 'lucide-react'

interface UnauthorizedPageProps {
  title?: string
  description?: string
  showBackButton?: boolean
  showLoginButton?: boolean
  backButtonText?: string
  loginButtonText?: string
  onBack?: () => void
  onLogin?: () => void
}

/**
 * 401 权限不足页面 — shadcn 风格, 主题色全跟随.
 */
export function UnauthorizedPage({
  title = '访问受限',
  description = '抱歉,您没有访问此页面的权限,请联系管理员获取访问权限',
  showBackButton = true,
  showLoginButton = true,
  backButtonText = '返回',
  loginButtonText = '重新登录',
  onBack,
  onLogin
}: UnauthorizedPageProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) onBack()
    else window.history.back()
  }

  const handleLogin = () => {
    if (onLogin) onLogin()
    else navigate({ to: '/login' })
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-8xl md:text-9xl font-bold text-muted-foreground/30 tracking-tighter select-none">
          401
        </div>

        <div className="space-y-2">
          <div className="flex justify-center mb-3">
            <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="size-6 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          {showBackButton && (
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="size-4" />
              {backButtonText}
            </Button>
          )}
          {showLoginButton && (
            <Button onClick={handleLogin} className="gap-2">
              <LogIn className="size-4" />
              {loginButtonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
