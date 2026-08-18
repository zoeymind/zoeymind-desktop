/**
 * caller helper: client-side URL-backed DataTable.
 *
 * 数据全量在前端 (无服务端分页) 的表用它. 排序 / 过滤 / 分页全在客户端做,
 * 状态双向同步到 URL (深链 / 前进后退 / 分享).
 *
 * URL 编码 (ADR 0002):
 * - 数组型 filter (multiSelect / dateRange / range / date / boolean / select): `f_<columnId>=v1,v2`
 * - 单值文本 filter (text / number): `q_<columnId>=v`
 * - 值域必须 URL-safe (禁含逗号 -- 见 ADR 0002 W1)。
 *
 * 列过滤默认 filterFn 由 `meta.variant` 决定 (M3); 列 `columnDef.filterFn` 显式指定时覆盖。
 *
 * 客户端过滤 (Y1): `manualFiltering: false` 硬编码, 所有过滤在浏览器内评估。
 */

import * as React from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  type SingleParser,
  type UseQueryStateOptions,
  useQueryState,
  useQueryStates
} from 'nuqs'

import { FILTER_FN_BY_VARIANT } from './default-filter-fns'
import { getSortingStateParser } from './parsers'
import type { ExtendedColumnSort, FilterVariant, QueryKeys } from './types'
import { useDebouncedCallback } from './use-debounced-callback'

const PAGE_KEY = 'page'
const PER_PAGE_KEY = 'perPage'
const SORT_KEY = 'sort'
const FILTERS_KEY = 'filters'
const JOIN_OPERATOR_KEY = 'joinOperator'
const ARRAY_SEPARATOR = ','
const DEBOUNCE_MS = 300
const THROTTLE_MS = 50

/**
 * URL key 前缀映射: 数组型 filter (multiSelect / dateRange / range / date / boolean / select) 用 `f_`,
 * 单值文本 filter (text / number) 用 `q_`. `date` 单值也走 `q_` (存 ISO string)。
 * `select` / `multiSelect` / `boolean` 用 `f_` 因为值总是包装成数组。
 */
const IS_ARRAY_VARIANT: Record<FilterVariant, boolean> = {
  text: false,
  number: false,
  range: true,
  date: false,
  dateRange: true,
  boolean: true,
  select: true,
  multiSelect: true
}

interface UseClientDataTableProps<TData>
  extends Omit<
    TableOptions<TData>,
    | 'state'
    | 'pageCount'
    | 'getCoreRowModel'
    | 'manualFiltering'
    | 'manualPagination'
    | 'manualSorting'
  > {
  initialState?: Omit<Partial<TableState>, 'sorting'> & {
    sorting?: ExtendedColumnSort<TData>[]
  }
  queryKeys?: Partial<QueryKeys>
  history?: 'push' | 'replace'
  debounceMs?: number
  throttleMs?: number
  clearOnDefault?: boolean
  scroll?: boolean
  shallow?: boolean
  startTransition?: React.TransitionStartFunction
}

export function useClientDataTable<TData>(props: UseClientDataTableProps<TData>) {
  const {
    columns,
    initialState,
    queryKeys,
    history = 'replace',
    debounceMs = DEBOUNCE_MS,
    throttleMs = THROTTLE_MS,
    clearOnDefault = false,
    scroll = false,
    shallow = true,
    startTransition,
    ...tableProps
  } = props

  const pageKey = queryKeys?.page ?? PAGE_KEY
  const perPageKey = queryKeys?.perPage ?? PER_PAGE_KEY
  const sortKey = queryKeys?.sort ?? SORT_KEY
  const filtersKey = queryKeys?.filters ?? FILTERS_KEY
  const joinOperatorKey = queryKeys?.joinOperator ?? JOIN_OPERATOR_KEY

  const queryStateOptions = React.useMemo<Omit<UseQueryStateOptions<string>, 'parse'>>(
    () => ({ history, scroll, shallow, throttleMs, debounceMs, clearOnDefault, startTransition }),
    [history, scroll, shallow, throttleMs, debounceMs, clearOnDefault, startTransition]
  )

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  )
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialState?.columnVisibility ?? {}
  )

  const [page, setPage] = useQueryState(
    pageKey,
    parseAsInteger.withOptions(queryStateOptions).withDefault(1)
  )
  const [perPage, setPerPage] = useQueryState(
    perPageKey,
    parseAsInteger
      .withOptions(queryStateOptions)
      .withDefault(initialState?.pagination?.pageSize ?? 10)
  )

  const pagination: PaginationState = React.useMemo(
    () => ({ pageIndex: page - 1, pageSize: perPage }),
    [page, perPage]
  )

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === 'function') {
        const next = updaterOrValue(pagination)
        void setPage(next.pageIndex + 1)
        void setPerPage(next.pageSize)
      } else {
        void setPage(updaterOrValue.pageIndex + 1)
        void setPerPage(updaterOrValue.pageSize)
      }
    },
    [pagination, setPage, setPerPage]
  )

  const columnIds = React.useMemo(
    () => new Set(columns.map(c => c.id).filter(Boolean) as string[]),
    [columns]
  )

  const [sorting, setSorting] = useQueryState(
    sortKey,
    getSortingStateParser<TData>(columnIds)
      .withOptions(queryStateOptions)
      .withDefault(initialState?.sorting ?? [])
  )

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      if (typeof updaterOrValue === 'function') {
        setSorting(updaterOrValue(sorting) as ExtendedColumnSort<TData>[])
      } else {
        setSorting(updaterOrValue as ExtendedColumnSort<TData>[])
      }
    },
    [sorting, setSorting]
  )

  // filterable 列 + URL key + 是否数组型 (决定 encode 分支)。
  const filterableColumns = React.useMemo(() => {
    const list: { id: string; urlKey: string; isArray: boolean }[] = []
    for (const column of columns) {
      if (!column.enableColumnFilter) continue
      const columnId = column.id
      if (!columnId) continue
      const variant = column.meta?.variant
      const isArray = variant != null && IS_ARRAY_VARIANT[variant]
      list.push({ id: columnId, isArray, urlKey: `${isArray ? 'f_' : 'q_'}${columnId}` })
    }
    return list
  }, [columns])

  const filterParsers = React.useMemo(() => {
    const parsers: Record<string, SingleParser<string> | SingleParser<string[]>> = {}
    for (const { urlKey, isArray } of filterableColumns) {
      parsers[urlKey] = isArray
        ? parseAsArrayOf(parseAsString, ARRAY_SEPARATOR).withOptions(queryStateOptions)
        : parseAsString.withOptions(queryStateOptions)
    }
    return parsers
  }, [filterableColumns, queryStateOptions])

  const [filterValues, setFilterValues] = useQueryStates(filterParsers)

  const debouncedSetFilterValues = useDebouncedCallback((values: typeof filterValues) => {
    void setPage(1)
    void setFilterValues(values)
  }, debounceMs)

  // URL → columnFilters state。URL 里 urlKey (`f_xxx`/`q_xxx`) 反查为 columnId。
  const initialColumnFilters: ColumnFiltersState = React.useMemo(() => {
    const byUrlKey: Record<string, string> = {}
    for (const c of filterableColumns) byUrlKey[c.urlKey] = c.id

    const filters: ColumnFiltersState = []
    for (const [urlKey, raw] of Object.entries(filterValues)) {
      if (raw == null) continue
      const columnId = byUrlKey[urlKey]
      if (!columnId) continue
      filters.push({ id: columnId, value: raw })
    }
    return filters
  }, [filterValues, filterableColumns])

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(initialColumnFilters)

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      setColumnFilters(prev => {
        const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
        const byColumnId: Record<string, { urlKey: string; isArray: boolean }> = {}
        for (const c of filterableColumns)
          byColumnId[c.id] = { urlKey: c.urlKey, isArray: c.isArray }

        const updates: Record<string, string | string[] | null> = {}
        for (const filter of next) {
          const entry = byColumnId[filter.id]
          if (!entry) continue
          const value = filter.value
          if (value == null || (Array.isArray(value) && value.length === 0)) {
            updates[entry.urlKey] = null
            continue
          }
          if (entry.isArray) {
            updates[entry.urlKey] = Array.isArray(value) ? value.map(String) : [String(value)]
          } else {
            updates[entry.urlKey] = Array.isArray(value) ? String(value[0] ?? '') : String(value)
          }
        }
        for (const prevFilter of prev) {
          if (!next.some(f => f.id === prevFilter.id)) {
            const entry = byColumnId[prevFilter.id]
            if (entry) updates[entry.urlKey] = null
          }
        }
        debouncedSetFilterValues(updates)
        return next
      })
    },
    [debouncedSetFilterValues, filterableColumns]
  )

  // 装配列: 若列没显式 filterFn 且 meta.variant 存在, 挂 registry 默认 (M3)。
  // 也顺带把 meta.variant 存在的列的 enableColumnFilter 默认置 true, 减少业务侧重复接线。
  const wiredColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    return columns.map(column => {
      const variant = column.meta?.variant
      if (!variant && !column.meta?.filterRender) return column as ColumnDef<TData, unknown>
      const patched: ColumnDef<TData, unknown> = { ...(column as ColumnDef<TData, unknown>) }
      if (patched.enableColumnFilter == null) patched.enableColumnFilter = true
      if (patched.filterFn == null && variant) {
        patched.filterFn = FILTER_FN_BY_VARIANT[variant] as FilterFn<TData>
      }
      return patched
    })
  }, [columns])

  const table = useReactTable({
    ...tableProps,
    columns: wiredColumns as typeof columns,
    initialState,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters
    },
    defaultColumn: {
      ...tableProps.defaultColumn,
      enableColumnFilter: false
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    // 客户端切片: 所有过滤 / 排序 / 分页在浏览器内评估 (Y1)。
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
    meta: {
      ...tableProps.meta,
      queryKeys: {
        page: pageKey,
        perPage: perPageKey,
        sort: sortKey,
        filters: filtersKey,
        joinOperator: joinOperatorKey
      }
    }
  })

  return React.useMemo(
    () => ({ table, shallow, debounceMs, throttleMs }),
    [table, shallow, debounceMs, throttleMs]
  )
}
