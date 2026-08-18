import * as React from 'react'
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table'
import { Filter, X } from 'lucide-react'
import { useTranslation } from '@zoeymind/i18n'

import { Button } from '#components/button'
import { DataTablePagination } from './data-table-pagination'
import { ScrollArea, ScrollBar } from '#components/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '#components/tooltip'
import { getColumnPinningStyle } from './lib'
import { cn } from '#lib/utils'

/** 溢出时自动显示完整内容 tooltip，未溢出时无额外渲染。 */
function TruncatedCell({ children }: { children: React.ReactNode }) {
  const [truncated, setTruncated] = React.useState(false)
  const textRef = React.useRef('')
  const observerRef = React.useRef<ResizeObserver | null>(null)

  // callback ref: fires on mount/unmount/branch-switch, re-attaches ResizeObserver each time
  const setRef = React.useCallback((el: HTMLSpanElement | null) => {
    observerRef.current?.disconnect()
    if (!el) return

    const check = () => {
      const overflowing = el.scrollWidth > el.offsetWidth
      if (overflowing) textRef.current = el.textContent ?? ''
      setTruncated(prev => (prev !== overflowing ? overflowing : prev))
    }

    check()
    observerRef.current = new ResizeObserver(check)
    observerRef.current.observe(el)
  }, [])

  if (!truncated) {
    return (
      <span ref={setRef} className="block truncate">
        {children}
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span ref={setRef} className="block truncate cursor-default">
            {children}
          </span>
        }
      />
      <TooltipContent side="top" className="max-w-sm break-words">
        {textRef.current}
      </TooltipContent>
    </Tooltip>
  )
}

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>
  actionBar?: React.ReactNode
  /**
   * 铺满父容器高度: 表体成为内部滚动区, 分页 footer 固定在底部.
   * 需要父容器有确定高度 (如 flex-1 + min-h-0)。默认 false = 随内容自然增高。
   */
  fillHeight?: boolean
  /** 隐藏内置分页栏 (服务端分页场景由 caller 自管翻页, 内置 client 分页会误导). */
  hidePagination?: boolean
  /**
   * 空态文案 (无过滤 + 0 行时): caller 传 t() 翻译值; 默认 "No results." 兼容旧调用。
   * 有过滤命中 0 行时自动渲染统一的 "无匹配 + 重置筛选" 空态, 不走这个文案。
   */
  emptyText?: string
  /**
   * 无限滚动：滚到底续接下一页，底部页码跟随滚动位置联动。
   *
   * 由 `useInfinitePages` + `useVisiblePage` 提供，需配合 `fillHeight`（要有确定
   * 高度的滚动容器）。不传则保持原有的一页一换行为，现有表格不受影响。
   */
  infinite?: {
    /** 表体末尾哨兵，进入视口即加载下一页。 */
    sentinelRef: (el: HTMLElement | null) => void
    /** 是否还有未加载的页 —— 决定是否渲染哨兵与加载提示。 */
    hasMore: boolean
    /** 正在取下一页，用于底部提示文案。 */
    isFetching?: boolean
  }
  /** 给每个数据行加 `data-testid`，供 e2e 定位行。 */
  rowTestId?: string
}

/**
 * 通用 DataTable (ADR 0002)。列过滤入口在表头标题本身 (`DataTableColumnHeader`),
 * 全局清空按钮由 caller 挂在页面上方 toolbar 中 —— 组件不再内置"过滤汇总条",
 * 保持视觉简洁 (方案 Z)。
 *
 * 空态自适应:
 * - 有过滤命中 0 行: 展示"无匹配 + 重置筛选"空态 (数据完整性 signal)
 * - 无过滤 + 0 行: 展示 `emptyText`
 */
export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  fillHeight = false,
  emptyText = 'No results.',
  hidePagination = false,
  infinite,
  rowTestId,
  ...props
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  const hasFilter = table.getState().columnFilters.length > 0
  const rows = table.getRowModel().rows

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2.5',
        fillHeight ? 'h-full min-h-0' : 'overflow-auto',
        className
      )}
      {...props}
    >
      {children}
      {/*
       * fillHeight: 用 ScrollArea 做统一滚动容器（对齐 shadcn scroll-area-04 模式）
       *   - ScrollArea h-full 铺满父，Viewport 是 sticky 参照系
       *   - 内层 w-max min-w-full 触发横滚
       *   - sticky 到 <th>（<thead> 是 table-header-group 浏览器 sticky 无效）
       *   - 显式 <ScrollBar orientation="horizontal"> 挂横滚条
       * 非 fillHeight: 单 table 自然增高 + 内层 overflow-x-auto（Table 原语默认）
       */}
      <div
        className={cn(
          'rounded-md border bg-card',
          fillHeight ? 'min-h-0 flex-1 overflow-hidden' : 'overflow-hidden'
        )}
      >
        {fillHeight ? (
          <ScrollArea className="h-full">
            <div className="w-max min-w-full">
              <Table containerClassName="">
                <TableHeader>
                  {table.getHeaderGroups().map(headerGroup => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map(header => {
                        const isPinned = !!header.column.getIsPinned()
                        return (
                          <TableHead
                            key={header.id}
                            colSpan={header.colSpan}
                            style={{
                              ...getColumnPinningStyle({ column: header.column }),
                              position: 'sticky',
                              top: 0,
                              zIndex: isPinned ? 3 : 2,
                              background: 'var(--muted)',
                              opacity: 1
                            }}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {rows.length ? (
                    rows.map(row => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        data-testid={rowTestId}
                      >
                        {row.getVisibleCells().map(cell => {
                          const shouldTruncate = cell.column.columnDef.meta?.truncate !== false
                          const content = flexRender(cell.column.columnDef.cell, cell.getContext())
                          return (
                            <TableCell
                              key={cell.id}
                              className={shouldTruncate ? undefined : 'whitespace-normal'}
                              style={{
                                ...getColumnPinningStyle({ column: cell.column }),
                                width: cell.column.getSize()
                              }}
                            >
                              {shouldTruncate ? <TruncatedCell>{content}</TruncatedCell> : content}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  ) : hasFilter ? (
                    <TableRow>
                      <TableCell
                        colSpan={table.getAllColumns().length}
                        className="h-32 text-center align-middle"
                      >
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-4">
                          <Filter className="size-6 text-muted-foreground/50" />
                          <div className="font-medium text-sm">
                            {t('common.table.filter.emptyNoMatch')}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {t('common.table.filter.emptyNoMatchDesc')}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 gap-1"
                            onClick={() => table.resetColumnFilters()}
                          >
                            <X className="size-3.5" />
                            {t('common.table.filter.clearAll')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={table.getAllColumns().length}
                        className="h-24 text-center"
                      >
                        {emptyText}
                      </TableCell>
                    </TableRow>
                  )}
                  {/* 底部哨兵 — 进入视口即请求下一页。只在还有剩余页时渲染,
                      否则观察者会在末页反复触发。 */}
                  {infinite?.hasMore && rows.length > 0 && (
                    <TableRow ref={infinite.sentinelRef} aria-hidden>
                      <TableCell
                        colSpan={table.getAllColumns().length}
                        className="h-10 text-center text-xs text-muted-foreground"
                      >
                        {infinite.isFetching ? t('common.loading') : ''}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        ...getColumnPinningStyle({ column: header.column })
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map(row => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    data-testid={rowTestId}
                  >
                    {row.getVisibleCells().map(cell => {
                      const shouldTruncate = cell.column.columnDef.meta?.truncate !== false
                      const content = flexRender(cell.column.columnDef.cell, cell.getContext())
                      return (
                        <TableCell
                          key={cell.id}
                          className={shouldTruncate ? undefined : 'whitespace-normal'}
                          style={{
                            ...getColumnPinningStyle({ column: cell.column }),
                            width: cell.column.getSize()
                          }}
                        >
                          {shouldTruncate ? <TruncatedCell>{content}</TruncatedCell> : content}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              ) : hasFilter ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="h-32 text-center align-middle"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-4">
                      <Filter className="size-6 text-muted-foreground/50" />
                      <div className="font-medium text-sm">
                        {t('common.table.filter.emptyNoMatch')}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t('common.table.filter.emptyNoMatchDesc')}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1 gap-1"
                        onClick={() => table.resetColumnFilters()}
                      >
                        <X className="size-3.5" />
                        {t('common.table.filter.clearAll')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                    {emptyText}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
      <div className={cn('flex flex-col gap-2.5', fillHeight && 'shrink-0')}>
        {!hidePagination && <DataTablePagination table={table} />}
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  )
}
