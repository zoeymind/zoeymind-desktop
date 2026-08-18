import * as React from 'react'
import { cn } from './cn'

const Item = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center', className)} {...props} />
  )
)
Item.displayName = 'Item'

const ItemMedia = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-shrink-0', className)} {...props} />
  )
)
ItemMedia.displayName = 'ItemMedia'

const ItemContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1 min-w-0', className)} {...props} />
  )
)
ItemContent.displayName = 'ItemContent'

const ItemTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('font-semibold text-sm leading-none', className)} {...props} />
  )
)
ItemTitle.displayName = 'ItemTitle'

const ItemDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
)
ItemDescription.displayName = 'ItemDescription'

const ItemActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-shrink-0', className)} {...props} />
  )
)
ItemActions.displayName = 'ItemActions'

export { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions }
