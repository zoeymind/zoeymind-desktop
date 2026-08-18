'use client'

import type { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, X } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from '@zoeymind/i18n'

import { Badge } from '#components/badge'
import { Button } from '#components/button'
import { Popover, PopoverContent, PopoverTrigger } from '#components/popover'
import { Separator } from '#components/separator'
import { cn } from '#lib/utils'
import { DataTableColumnFilterContent, countActiveFilter } from './data-table-header-filter'

interface DataTableColumnHeaderProps<TData, TValue> extends React.ComponentProps<'div'> {
  column: Column<TData, TValue>
  /** 列名 (显示在表头 + Popover aria-label)。 */
  label: string
}

/**
 * 通用列表头 (ADR 0002)。点表头标题即弹出 Popover, 内含:
 * - 排序段: 升序 / 降序 / 重置排序 (若列 `getCanSort()`)
 * - 分隔线
 * - 过滤段: 按 `meta.variant` / `meta.filterRender` 分发的过滤 UI (若列可过滤)
 *
 * 若列既不可排序也不可过滤, 表头退化为纯文本 (无 Popover, 无 hover 反馈)。
 * 列隐藏 (`getCanHide`) 收敛到右上角"视图"按钮 (`DataTableViewOptions`), 不再进表头 Popover。
 *
 * 激活过滤时表头文字后挂 count badge; 激活排序时表头文字后挂 asc/desc 箭头。
 */
export function DataTableColumnHeader<TData, TValue>({
  column,
  label,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const meta = column.columnDef.meta
  const canSort = column.getCanSort()
  const canFilter = column.getCanFilter() && Boolean(meta?.variant || meta?.filterRender)
  const sortState = column.getIsSorted()
  const filterCount = React.useMemo(
    () => countActiveFilter(column.getFilterValue()),
    // 过滤值变化时重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [column.getFilterValue()]
  )

  // 完全无交互列: 直接输出 label。
  if (!canSort && !canFilter) {
    return (
      <div className={cn(className)} {...props}>
        {label}
      </div>
    )
  }

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton
          render={
            <button
              type="button"
              aria-label={
                canFilter ? t('common.table.filter.filterColumn', { column: label }) : label
              }
              aria-expanded={open}
              className={cn(
                '-ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 font-medium text-sm',
                'hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'data-[state=open]:bg-accent',
                (filterCount > 0 || sortState) && 'text-primary'
              )}
              data-state={open ? 'open' : 'closed'}
            >
              <span className="truncate">{label}</span>
              {sortState === 'asc' ? (
                <ArrowUp className="size-3.5 shrink-0" />
              ) : sortState === 'desc' ? (
                <ArrowDown className="size-3.5 shrink-0" />
              ) : canSort ? (
                <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground/50" />
              ) : null}
              {filterCount > 1 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground leading-none tabular-nums"
                >
                  {filterCount}
                </Badge>
              )}
              {filterCount === 1 && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
              {canFilter && filterCount === 0 && (
                <Filter className="size-3 shrink-0 text-muted-foreground/50" />
              )}
            </button>
          }
        />
        {canFilter && filterCount > 0 && (
          <button
            type="button"
            aria-label={t('common.dateSelector.clear')}
            onClick={event => {
              event.stopPropagation()
              column.setFilterValue(undefined)
            }}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="size-3" />
          </button>
        )}
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
            <span className="truncate">{label}</span>
            {canFilter && filterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
                onClick={() => column.setFilterValue(undefined)}
              >
                <X className="size-3" />
                {t('common.dateSelector.clear')}
              </Button>
            )}
          </div>
          {canSort && (
            <div className="flex flex-col p-1">
              <SortButton
                active={sortState === 'asc'}
                icon={ArrowUp}
                label={t('common.table.sortAsc')}
                onClick={() => column.toggleSorting(false)}
              />
              <SortButton
                active={sortState === 'desc'}
                icon={ArrowDown}
                label={t('common.table.sortDesc')}
                onClick={() => column.toggleSorting(true)}
              />
              {sortState && (
                <SortButton
                  active={false}
                  icon={X}
                  label={t('common.table.resetSort')}
                  onClick={() => column.clearSorting()}
                />
              )}
            </div>
          )}
          {canSort && canFilter && <Separator />}
          {canFilter && (
            <DataTableColumnFilterContent
              column={column}
              columnLabel={label}
              onClose={() => setOpen(false)}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SortButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean
  icon: React.ComponentType<React.ComponentProps<'svg'>>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left',
        'hover:bg-accent focus:outline-none focus-visible:bg-accent',
        active && 'font-medium text-primary'
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span>{label}</span>
    </button>
  )
}
