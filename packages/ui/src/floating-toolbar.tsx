import React from 'react'
import { cn } from './cn'

interface FloatingToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom'
  children: React.ReactNode
  className?: string
}

interface FloatingToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

interface FloatingToolbarSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

interface FloatingToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

interface FloatingToolbarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  isActive?: boolean
}

// 主工具栏容器
const FloatingToolbar = React.forwardRef<HTMLDivElement, FloatingToolbarProps>(
  ({ position = 'top-left', children, className, ...props }, ref) => {
    // 桌面端顶部改成整条 Header 行由父容器 flex 布局, top-left/top-right 不再自绝对定位.
    const positionClasses = {
      'top-left': '',
      'top-right': '',
      'bottom-left': 'fixed bottom-4 left-4',
      'bottom-right': 'fixed bottom-4 right-4',
      custom: ''
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-2 z-10',
          position !== 'custom' ? positionClasses[position] : '',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
FloatingToolbar.displayName = 'FloatingToolbar'

// 工具栏组
const FloatingToolbarGroup = React.forwardRef<HTMLDivElement, FloatingToolbarGroupProps>(
  ({ children, className, orientation = 'horizontal', ...props }, ref) => {
    return (
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
  }
)
FloatingToolbarGroup.displayName = 'FloatingToolbarGroup'

// 工具栏分隔符
const FloatingToolbarSeparator = React.forwardRef<HTMLDivElement, FloatingToolbarSeparatorProps>(
  ({ orientation = 'vertical', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          orientation === 'vertical' ? 'w-px h-6 bg-border' : 'h-px w-6 bg-border',
          className
        )}
        {...props}
      />
    )
  }
)
FloatingToolbarSeparator.displayName = 'FloatingToolbarSeparator'

// 工具栏按钮
const FloatingToolbarButton = React.forwardRef<HTMLButtonElement, FloatingToolbarButtonProps>(
  ({ active = false, variant = 'default', size = 'md', children, className, ...props }, ref) => {
    const variantClasses = {
      default: 'hover:bg-muted transition-colors',
      outline: 'border border-border hover:bg-muted transition-colors',
      ghost: 'hover:bg-muted transition-colors'
    }

    const sizeClasses = {
      sm: 'p-0.5',
      md: 'p-1',
      lg: 'p-1.5'
    }

    return (
      <button
        type="button"
        ref={ref}
        className={cn(
          'rounded-md',
          variantClasses[variant],
          sizeClasses[size],
          active ? 'bg-primary/10 text-primary' : 'text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
FloatingToolbarButton.displayName = 'FloatingToolbarButton'

// 弹出内容区域
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
