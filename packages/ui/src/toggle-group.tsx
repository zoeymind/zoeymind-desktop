'use client'

import * as React from 'react'
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import { type VariantProps } from 'class-variance-authority'

import { cn } from '#lib/utils'
import { toggleVariants } from '#components/toggle'

/**
 * Base UI ToggleGroup 只支持数组模型 (multiple 布尔 + 数组 value); 我们保留 Radix
 * 的 `type="single"|"multiple"` + `value: string | string[]` 消费界面, 由这里
 * 转换成 base-ui 期望的形态, 消费方一处不改.
 */
type CompatValue<Type extends 'single' | 'multiple'> = Type extends 'multiple' ? string[] : string
type CompatChange<Type extends 'single' | 'multiple'> = (value: CompatValue<Type>) => void

type ToggleGroupCompatProps<Type extends 'single' | 'multiple'> = Omit<
  ToggleGroupPrimitive.Props,
  'value' | 'defaultValue' | 'onValueChange'
> & {
  type: Type
  value?: CompatValue<Type>
  defaultValue?: CompatValue<Type>
  onValueChange?: CompatChange<Type>
} & VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: 'horizontal' | 'vertical'
  }

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: 'horizontal' | 'vertical'
  }
>({
  size: 'default',
  variant: 'default',
  spacing: 2,
  orientation: 'horizontal'
})

function ToggleGroup<Type extends 'single' | 'multiple'>({
  className,
  variant,
  size,
  spacing = 2,
  orientation = 'horizontal',
  type,
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ToggleGroupCompatProps<Type>) {
  const asArray = (v: string | string[] | undefined): string[] | undefined => {
    if (v === undefined) return undefined
    return Array.isArray(v) ? v : v ? [v] : []
  }
  const compatValue = asArray(value as string | string[] | undefined)
  const compatDefault = asArray(defaultValue as string | string[] | undefined)

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      multiple={type === 'multiple'}
      value={compatValue}
      defaultValue={compatDefault}
      onValueChange={(next: string[]) => {
        if (!onValueChange) return
        if (type === 'single') {
          ;(onValueChange as CompatChange<'single'>)((next[0] ?? '') as string)
        } else {
          ;(onValueChange as CompatChange<'multiple'>)(next)
        }
      }}
      style={{ '--gap': spacing } as React.CSSProperties}
      className={cn(
        'group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch',
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing, orientation }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        'shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t',
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size
        }),
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
