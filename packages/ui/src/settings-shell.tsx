import type { ComponentType, ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'
import { cn } from './cn'

export interface SettingsNavItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
}

export interface SettingsShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  items: SettingsNavItem[]
  activeId: string
  onActiveChange: (id: string) => void
  children: ReactNode
  /** 额外加在右侧内容区的 class */
  contentClassName?: string
}

/**
 * 统一的设置面板外壳: 左侧导航 + 右侧滚动内容.
 *
 * - 固定尺寸 (sm:max-w-3xl / h-[520px]), 让个人 / 组织 / 套餐 / AI Chat 设置面板尺寸一致.
 * - 侧边栏背景靠 flex stretch 撑满整个面板高度 (显式高度祖先 h-[520px] -> nav 子项拉伸),
 *   不要用 vertical Tabs 当侧栏: 最新 shadcn TabsList 对 vertical 设了 h-fit, 背景填不满.
 */
export function SettingsShell({
  open,
  onOpenChange,
  title,
  description,
  items,
  activeId,
  onActiveChange,
  children,
  contentClassName
}: SettingsShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-0 border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex h-[520px] overflow-hidden">
          <nav className="flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-r bg-muted/40 p-2">
            {items.map(item => {
              const Icon = item.icon
              const active = item.id === activeId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onActiveChange(item.id)}
                  data-testid={`settings-nav-${item.id}`}
                  data-active={active || undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                  )}
                >
                  {Icon && <Icon className="size-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className={cn('flex-1 overflow-y-auto px-6 py-5', contentClassName)}>{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
