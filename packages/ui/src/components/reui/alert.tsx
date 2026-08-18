/**
 * Alert — 来自 ReUI (`pnpm dlx shadcn@latest add @reui/alert`),
 * variants 改用项目既有 semantic tokens:
 *   - success  → --color-success / hsl(var(--success))
 *   - warning  → --color-warning / hsl(var(--warning))
 *   - info     → hsl(var(--info)) (无 --color-info Tailwind class, 显式 hsl)
 *   - destructive → --color-destructive
 *   - invert   → 用 foreground/background 反色 (无 --color-invert)
 *
 * 不新增 CSS token; 每 app index.css 已含 --success/--warning/--info/--destructive
 * HSL 分量, globals.css 已把 --color-success/--color-warning 挂到 @theme.
 */
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '#lib/utils'

const alertVariants = cva(
  [
    'relative w-full text-sm border has-[>svg]:grid-cols-[calc(var(--spacing)*3)_1fr] grid-cols-[0_1fr] grid gap-y-0.5 items-center [&>svg:not([class*=size-])]:size-4',
    'has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_[data-slot=alert-action]]:sm:row-end-3',
    'has-[>[data-slot=alert-title]+[data-slot=alert-description]]:items-start',
    'has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_svg]:translate-y-0.5',
    'rounded-lg',
    'px-3',
    'py-2.5',
    'has-[>svg]:gap-x-2.5'
  ],
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'border-destructive/30 bg-destructive/5 [&>svg]:text-destructive',
        success: 'border-success/30 bg-success/10 [&>svg]:text-success',
        warning: 'border-warning/30 bg-warning/10 [&>svg]:text-warning',
        info: 'border-[hsl(var(--info))]/30 bg-[hsl(var(--info))]/10 [&>svg]:text-[hsl(var(--info))]',
        invert: 'border-foreground bg-foreground text-background [&>svg]:text-background'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        'flex gap-1.5 max-sm:col-start-2 max-sm:mt-2 max-sm:justify-start sm:col-start-3 sm:row-start-1 sm:justify-end sm:self-center',
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
