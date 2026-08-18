'use client'

import type { Column } from '@tanstack/react-table'
import { Check } from 'lucide-react'
import * as React from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from '@zoeymind/i18n'

import { Calendar } from '#components/calendar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '#components/command'
import { Input } from '#components/input'
import { cn } from '#lib/utils'
import type { Option } from './types'

interface DataTableColumnFilterContentProps<TData, TValue> {
  column: Column<TData, TValue>
  /** 用户可见列名。目前仅供 `filterRender` 逃生舱访问。 */
  columnLabel: string
  /** 关闭上层 Popover 的回调, 仅传递给 `filterRender` 逃生舱; 内置 variant 不主动关闭 Popover (由 Radix 点外部关闭)。 */
  onClose: () => void
}

/**
 * 表头列 Popover 中的**过滤 body**部分。上层 (`DataTableColumnHeader`) 负责触发 Popover
 * 与承载"排序段"; 这里只按 `meta.variant` 分发过滤 UI。
 *
 * - `filterRender` 存在时短路走逃生舱, 业务侧完全负责渲染 + `column.setFilterValue`。
 * - 所有 variant 都在自身 Popover 内实时写回 `columnFilters`。
 */
export function DataTableColumnFilterContent<TData, TValue>({
  column,
  columnLabel,
  onClose
}: DataTableColumnFilterContentProps<TData, TValue>) {
  const { t } = useTranslation()
  const meta = column.columnDef.meta

  if (meta?.filterRender) {
    return <>{meta.filterRender({ column, close: onClose })}</>
  }

  const variant = meta?.variant
  if (!variant) return null

  const filterValue = column.getFilterValue()

  switch (variant) {
    case 'text':
      return (
        <div className="p-2">
          <Input
            autoFocus
            placeholder={meta?.placeholder ?? t('common.table.filter.selectPlaceholder')}
            value={typeof filterValue === 'string' ? filterValue : ''}
            onChange={event => column.setFilterValue(event.target.value || undefined)}
            className="h-8"
          />
        </div>
      )

    case 'number':
      return (
        <div className="p-2">
          <Input
            autoFocus
            type="number"
            inputMode="numeric"
            placeholder={meta?.placeholder ?? t('common.table.filter.selectPlaceholder')}
            value={
              typeof filterValue === 'string' || typeof filterValue === 'number'
                ? String(filterValue)
                : ''
            }
            onChange={event => column.setFilterValue(event.target.value || undefined)}
            className="h-8"
          />
        </div>
      )

    case 'range':
      return <NumberRangeBody column={column} />

    case 'date':
      return <DateBody column={column} />

    case 'dateRange':
      return <DateRangeBody column={column} />

    case 'boolean':
    case 'select':
    case 'multiSelect':
      return (
        <SelectBody
          column={column}
          columnLabel={columnLabel}
          options={meta?.options ?? []}
          multiple={variant === 'multiSelect'}
        />
      )

    default:
      return null
  }
}

/** 判断某列过滤值的"激活数量" (用于表头 badge)。 */
export function countActiveFilter(value: unknown): number {
  if (value == null || value === '') return 0
  if (Array.isArray(value)) {
    // dateRange / range 是 [a, b], 视为一段 (count = 1)
    if (value.length === 2 && !value.every(v => typeof v === 'string')) {
      return value.some(v => v != null && v !== '') ? 1 : 0
    }
    return value.filter(v => v != null && v !== '').length
  }
  return 1
}

/* -------------------------------------------------------------------------- */
/* select / multiSelect                                                       */
/* -------------------------------------------------------------------------- */

interface SelectBodyProps<TData, TValue> {
  column: Column<TData, TValue>
  columnLabel: string
  options: Option[]
  multiple: boolean
}

function SelectBody<TData, TValue>({
  column,
  columnLabel,
  options,
  multiple
}: SelectBodyProps<TData, TValue>) {
  const { t } = useTranslation()
  const [search, setSearch] = React.useState('')
  const filterValue = column.getFilterValue()
  const selectedValues = React.useMemo(
    () => new Set(Array.isArray(filterValue) ? filterValue.map(String) : []),
    [filterValue]
  )

  // Z3: Popover 打开时按 (selected -> unselected) 分段一次; 打开期间勾选不重排。
  // 搜索模式下 (search != '') 分段失效, 走原序匹配。
  const { selectedOptions, unselectedOptions } = React.useMemo(() => {
    if (search) {
      return { selectedOptions: [] as Option[], unselectedOptions: options }
    }
    const sel: Option[] = []
    const unsel: Option[] = []
    for (const option of options) {
      if (selectedValues.has(option.value)) sel.push(option)
      else unsel.push(option)
    }
    return { selectedOptions: sel, unselectedOptions: unsel }
    // 选中集合快照到 Popover 打开那一刻; selectedValues 变化不重算 (Z3 要求)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, search])

  return (
    <div>
      <Command>
        <CommandInput
          placeholder={t('common.table.filter.searchOptions')}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[280px]">
          <CommandEmpty>{t('common.table.noResults')}</CommandEmpty>
          {selectedOptions.length > 0 && (
            <>
              <CommandGroup heading={t('common.table.filter.selectedSection')}>
                {selectedOptions.map(option => (
                  <SelectItem
                    key={option.value}
                    option={option}
                    checked
                    onToggle={() => {
                      if (multiple) {
                        const next = new Set(selectedValues)
                        next.delete(option.value)
                        const arr = Array.from(next)
                        column.setFilterValue(arr.length > 0 ? arr : undefined)
                      } else {
                        column.setFilterValue(undefined)
                      }
                    }}
                  />
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup
            heading={
              selectedOptions.length > 0 ? t('common.table.filter.unselectedSection') : undefined
            }
          >
            {unselectedOptions.map(option => {
              const isSelected = selectedValues.has(option.value)
              return (
                <SelectItem
                  key={option.value}
                  option={option}
                  checked={isSelected}
                  onToggle={() => {
                    if (multiple) {
                      const next = new Set(selectedValues)
                      if (isSelected) next.delete(option.value)
                      else next.add(option.value)
                      const arr = Array.from(next)
                      column.setFilterValue(arr.length > 0 ? arr : undefined)
                    } else {
                      column.setFilterValue(isSelected ? undefined : [option.value])
                    }
                  }}
                />
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
      {multiple && selectedValues.size > 0 && (
        <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          {t('common.table.filter.selectedCount', { count: selectedValues.size })}
        </div>
      )}
      <span className="sr-only">{columnLabel}</span>
    </div>
  )
}

function SelectItem({
  option,
  checked,
  onToggle
}: {
  option: Option
  checked: boolean
  onToggle: () => void
}) {
  return (
    <CommandItem
      value={option.value}
      keywords={[option.label]}
      onSelect={onToggle}
      className="[&>svg:last-child]:hidden"
    >
      <div
        className={cn(
          'flex size-4 items-center justify-center rounded-sm border border-primary',
          checked ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'
        )}
      >
        <Check className="size-3" />
      </div>
      {option.prefix ? (
        <span className="flex shrink-0 items-center">{option.prefix}</span>
      ) : option.icon ? (
        <option.icon className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
      <span className="truncate">{option.label}</span>
      {option.count != null && (
        <span className="ml-auto font-mono text-xs text-muted-foreground">{option.count}</span>
      )}
    </CommandItem>
  )
}

/* -------------------------------------------------------------------------- */
/* range (number)                                                             */
/* -------------------------------------------------------------------------- */

function NumberRangeBody<TData, TValue>({ column }: { column: Column<TData, TValue> }) {
  const { t } = useTranslation()
  const filterValue = column.getFilterValue()
  const [minValue, maxValue] = Array.isArray(filterValue) ? filterValue : [undefined, undefined]

  const emit = (next: [unknown, unknown]) => {
    const hasAny = next.some(v => v != null && v !== '')
    column.setFilterValue(hasAny ? next : undefined)
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('common.table.filter.from')}
        <Input
          type="number"
          inputMode="numeric"
          value={minValue == null ? '' : String(minValue)}
          onChange={event => emit([event.target.value || undefined, maxValue])}
          className="h-8"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('common.table.filter.to')}
        <Input
          type="number"
          inputMode="numeric"
          value={maxValue == null ? '' : String(maxValue)}
          onChange={event => emit([minValue, event.target.value || undefined])}
          className="h-8"
        />
      </label>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* date / dateRange                                                           */
/* -------------------------------------------------------------------------- */

function toISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseISODate(value: unknown): Date | undefined {
  if (!value || typeof value !== 'string') return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function DateBody<TData, TValue>({ column }: { column: Column<TData, TValue> }) {
  const filterValue = column.getFilterValue()
  const selected = parseISODate(filterValue)
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={date => column.setFilterValue(date ? toISODate(date) : undefined)}
      captionLayout="dropdown"
    />
  )
}

function DateRangeBody<TData, TValue>({ column }: { column: Column<TData, TValue> }) {
  const filterValue = column.getFilterValue()
  const range: DateRange | undefined = Array.isArray(filterValue)
    ? {
        from: parseISODate(filterValue[0]),
        to: parseISODate(filterValue[1])
      }
    : undefined

  return (
    <Calendar
      mode="range"
      selected={range}
      onSelect={next => {
        if (!next || (!next.from && !next.to)) {
          column.setFilterValue(undefined)
          return
        }
        column.setFilterValue([
          next.from ? toISODate(next.from) : null,
          next.to ? toISODate(next.to) : null
        ])
      }}
      captionLayout="dropdown"
    />
  )
}
