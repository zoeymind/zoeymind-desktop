/**
 * ActionNotificationItem — 通用「行动项通知」单元, 用于任何需要用户在通知/收件箱
 * 里立即操作的场景 (邀请接受, 审批, 访问申请等).
 *
 * 纯 UI, 不认业务. 通过 icon / title / description / actions props 定制,
 * 业务方 (NotificationBell / ApprovalPanel 等) 拼装数据.
 *
 * 视觉:
 *   ┌────────────────────────────────────────┐
 *   │ [icon]  Alice 邀请你加入 Acme         │
 *   │         所有者角色 · 7 天内有效        │
 *   │         [接受]  [拒绝]  [忽略]         │
 *   └────────────────────────────────────────┘
 */
import type { ComponentType, ReactNode } from 'react'
import { Button } from './button'
import { cn } from './cn'

export type ActionNotificationVariant = 'default' | 'destructive' | 'outline' | 'ghost'

export interface ActionNotificationAction {
  label: string
  onClick: () => void
  variant?: ActionNotificationVariant
  loading?: boolean
  disabled?: boolean
}

export interface ActionNotificationItemProps {
  /** 左侧图标 (lucide-react 组件). 与 avatar 二选一. */
  icon?: ComponentType<{ className?: string }>
  /** 左侧头像 slot (业务方注入 UserAvatarWithCard / OrgAvatar 等). 与 icon 二选一. */
  avatar?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions: ActionNotificationAction[]
  className?: string
}

export function ActionNotificationItem({
  icon: Icon,
  avatar,
  title,
  description,
  actions,
  className
}: ActionNotificationItemProps) {
  return (
    <div className={cn('flex items-start gap-3 px-3 py-2.5', className)}>
      {avatar ? (
        <div className="mt-0.5 shrink-0">{avatar}</div>
      ) : Icon ? (
        <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="text-sm leading-snug">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground leading-snug">{description}</div>
        )}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 pt-0.5">
            {actions.map((action, i) => (
              <Button
                key={i}
                size="sm"
                variant={action.variant ?? (i === 0 ? 'default' : 'outline')}
                className={cn('h-7', action.variant === 'ghost' && 'text-muted-foreground')}
                disabled={action.disabled || action.loading}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
