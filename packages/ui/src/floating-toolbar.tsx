import React from 'react'
import { cn } from './cn'
import { Button, type ButtonProps } from './button'

/**
 * FloatingToolbar 现在是"Header 内联工具栏"的极薄包装 —— 保留 API 表面
 * (旧代码继续能用), 内部一律走通用 `Button` (`variant="ghost"`, 默认 `size="icon-sm"`).
 * 之前的黑底白字 pill 样式退役.
 */

interface FloatingToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom'
}

interface FloatingToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
}

interface FloatingToolbarSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
}

interface FloatingToolbarButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  active?: boolean
  /** 兼容旧 API: 'default' | 'outline' | 'ghost'; 内部映射到通用 Button variant. */
  variant?: 'default' | 'outline' | 'ghost'
  /** 兼容旧 API: 'sm' | 'md' | 'lg'; 内部映射到通用 Button size. */
  size?: 'sm' | 'md' | 'lg'
}

interface FloatingToolbarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean
}

const positionClasses = {
  'top-left': '',
  'top-right': '',
  'bottom-left': 'fixed bottom-4 left-4',
  'bottom-right': 'fixed bottom-4 right-4',
  custom: ''
} as const

const FloatingToolbar = React.forwardRef<HTMLDivElement, FloatingToolbarProps>(
  ({ position = 'top-left', children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-0.5 z-10',
        position !== 'custom' ? positionClasses[position] : '',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
FloatingToolbar.displayName = 'FloatingToolbar'

const FloatingToolbarGroup = React.forwardRef<HTMLDivElement, FloatingToolbarGroupProps>(
  ({ children, className, orientation = 'horizontal', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-0.5 text-foreground',
        orientation === 'vertical' && 'flex-col',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
FloatingToolbarGroup.displayName = 'FloatingToolbarGroup'

const FloatingToolbarSeparator = React.forwardRef<HTMLDivElement, FloatingToolbarSeparatorProps>(
  ({ orientation = 'vertical', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        orientation === 'vertical' ? 'w-px h-4 bg-border mx-1' : 'h-px w-4 bg-border my-1',
        className
      )}
      {...props}
    />
  )
)
FloatingToolbarSeparator.displayName = 'FloatingToolbarSeparator'

// 旧 sm/md/lg 语义 → 通用 Button 尺寸
const SIZE_MAP: Record<NonNullable<FloatingToolbarButtonProps['size']>, ButtonProps['size']> = {
  sm: 'icon-xs',
  md: 'icon-sm',
  lg: 'icon'
}

const FloatingToolbarButton = React.forwardRef<HTMLButtonElement, FloatingToolbarButtonProps>(
  ({ active = false, variant = 'default', size = 'md', className, ...props }, ref) => (
    <Button
      ref={ref}
      // 三种 variant 都用 ghost 底 + 状态高亮; outline 变体给一点 border.
      variant={variant === 'outline' ? 'outline' : 'ghost'}
      size={SIZE_MAP[size]}
      data-active={active || undefined}
      className={cn(
        active && 'bg-accent text-accent-foreground',
        className
      )}
      {...props}
    />
  )
)
FloatingToolbarButton.displayName = 'FloatingToolbarButton'

const FloatingToolbarContent = React.forwardRef<HTMLDivElement, FloatingToolbarContentProps>(
  ({ children, className, isActive = false, ...props }, ref) => {
    if (!isActive) return null
    return (
      <div
        ref={ref}
        className={cn(
          'bg-card text-card-foreground rounded-lg shadow-lg overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
FloatingToolbarContent.displayName = 'FloatingToolbarContent'

export {
  FloatingToolbar,
  FloatingToolbarGroup,
  FloatingToolbarSeparator,
  FloatingToolbarButton,
  FloatingToolbarContent
}
