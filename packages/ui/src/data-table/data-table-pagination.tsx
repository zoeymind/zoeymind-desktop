import * as React from 'react'
import type { Table } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslation } from '@zoeymind/i18n'

import { Button } from '#components/button'
import { Input } from '#components/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '#components/select'
import { cn } from '#lib/utils'

interface DataTablePaginationProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
        className
      )}
      {...props}
    >
      <div className="flex-1 whitespace-nowrap text-muted-foreground text-sm">
        {t('common.table.rowsSelected', {
          selected: table.getFilteredSelectedRowModel().rows.length,
          total: table.getFilteredRowModel().rows.length
        })}
      </div>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="whitespace-nowrap font-medium text-sm">{t('common.table.rowsPerPage')}</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={value => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-18 data-size:h-8">
              <SelectValue>
                {value => String(value ?? table.getState().pagination.pageSize)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {pageSizeOptions.map(pageSize => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center font-medium text-sm">
          {t('common.table.pageOf', {
            page: table.getState().pagination.pageIndex + 1,
            total: table.getPageCount()
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            aria-label={t('common.table.firstPage')}
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft />
          </Button>
          <Button
            aria-label={t('common.table.prevPage')}
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label={t('common.table.nextPage')}
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
          <Button
            aria-label={t('common.table.lastPage')}
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight />
          </Button>
        </div>
        <JumpToPage table={table} />
      </div>
    </div>
  )
}

/**
 * 跳转到第 N 页 —— 页数多时逐页点击太慢。
 *
 * 提交前不阻断输入（可以先删空再重打），提交时才夹取到合法范围；越界不报错，
 * 直接落到最近的合法页，符合"接受自由输入、事后校验"的表单约定。
 */
function JumpToPage<TData>({ table }: { table: Table<TData> }) {
  const { t } = useTranslation()
  const [draft, setDraft] = React.useState('')
  const pageCount = table.getPageCount()

  if (pageCount <= 1) return null

  const commit = () => {
    const parsed = Number.parseInt(draft, 10)
    if (Number.isNaN(parsed)) return
    const clamped = Math.min(Math.max(parsed, 1), pageCount)
    table.setPageIndex(clamped - 1)
    setDraft('')
  }

  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-muted-foreground text-sm">
        {t('common.table.jumpTo')}
      </span>
      <Input
        type="text"
        inputMode="numeric"
        aria-label={t('common.table.jumpTo')}
        className="h-8 w-14 text-center tabular-nums"
        value={draft}
        onChange={e => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
        }}
        onBlur={commit}
      />
    </div>
  )
}
