import { Button } from '../button'
import { useNavigate } from '@tanstack/react-router'
import { LogIn, User } from 'lucide-react'

interface LoginRequiredPageProps {
  title?: string
  description?: string
  showLoginButton?: boolean
  onLogin?: () => void
}

/**
 * 需要登录页面 — shadcn 风格, 主题色全跟随.
 *
 * 默认作为 401 状态展示 (访问需登录的资源, 但用户未登录).
 */
export function LoginRequiredPage({
  title = '需要登录',
  description = '请先登录您的账户以访问此功能',
  showLoginButton = true,
  onLogin
}: LoginRequiredPageProps) {
  const navigate = useNavigate()

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
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <User className="size-6 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {showLoginButton && (
          <div className="flex justify-center pt-2">
            <Button onClick={handleLogin} className="gap-2 px-8">
              <LogIn className="size-4" />
              立即登录
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
