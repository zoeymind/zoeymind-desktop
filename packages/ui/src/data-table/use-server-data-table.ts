/**
 * caller helpers: server-driven URL-backed DataTable.
 *
 * 两个 hook 组合使用:
 *
 * 1. `useDataTableQueryParams({ columnIds, filterableIds, selectFilterIds, defaultPageSize })`
 *    只读 URL nuqs state, 返回 `queryParams`. 不建 table, 不依赖 data. caller 用它派生
 *    tRPC 入参.
 *
 * 2. `useServerDataTable({ data, rowCount, columns, getRowId, initialState })`
 *    真正建 table. 传 tRPC 拿到的 data / total. 首帧 caller 传 undefined, helper
 *    fallback 到 [] / 0. 内部 useReactTable 每次 data 引用变化 diff.
 *
 * ```tsx
 * const queryParams = useDataTableQueryParams({
 *   sortableIds: ['createdAt', 'name'],
 *   filterableIds: ['keyword', 'role', 'status'],
 *   selectFilterIds: ['role', 'status'],
 *   defaultPageSize: 20
 * })
 * const listQuery = trpc.foo.list.useQuery({
 *   page: queryParams.page,
 *   pageSize: queryParams.pageSize,
 *   sortBy: queryParams.sortBy,
 *   sortOrder: queryParams.sortOrder,
 *   keyword: (queryParams.filters.keyword as string) ?? '',
 *   role: firstOrUndef(queryParams.filters.role),
 *   status: firstOrUndef(queryParams.filters.status) ?? 'active'
 * })
 * const { table } = useServerDataTable<Row>({
 *   data: listQuery.data?.items,
 *   rowCount: listQuery.data?.total,
 *   columns, getRowId: r => r.id,
 *   initialState: { pagination: { pageIndex: 0, pageSize: 20 } }
 * })
 * ```
 *
 * 两 hook 内部走同一 nuqs URL 状态 (query key 相同), 是幂等的 —— 双读不冲突.
 */

import * as React from 'react'
import type { ColumnFiltersState, SortingState, Table } from '@tanstack/react-table'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  type SingleParser,
  type UseQueryStateOptions,
  useQueryState,
  useQueryStates
} from 'nuqs'
import { useDataTable, type UseDataTableProps } from './use-data-table'
import { getSortingStateParser } from './parsers'

export interface ServerQueryParams {
  /** 1-based page number. */
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  /** columnId -> filter value; select-类是 string[], text-类是 string. */
  filters: Record<string, string | string[]>
  /**
   * 直接改写 URL 的 `page` —— 给无限滚动用（滚到底续接下一页 / 点页码跳页）。
   *
   * 普通分页由 table 实例的 `setPageIndex` 驱动，不需要它；无限滚动不经过 table
   * 的分页状态（行是累积的），故需要一条直达 URL 的通路。
   */
  setPage: (page: number) => void
  /**
   * 直接改写 URL 的 `sort` —— 给外部 DSL 排序输入用（DSL 里 `sort:updatedAt-desc`
   * 需要写回 nuqs URL 状态；空数组清空排序）. 表头点排序不需要它.
   */
  setSort: (sort: { id: string; desc: boolean }[]) => void
}

export interface UseDataTableQueryParamsProps {
  /** 可排序的列 id (与 useServerDataTable 传入 columns 的 enableSorting=true 列一致). */
  sortableIds?: readonly string[]
  /** 可过滤的列 id (enableColumnFilter=true 列). */
  filterableIds?: readonly string[]
  /** 其中哪些是 select/multiSelect variant (URL 值存为逗号分隔数组). 其余按 text (标量) 读. */
  selectFilterIds?: readonly string[]
  /** 默认页尺寸. */
  defaultPageSize?: number
}

/**
 * 只读 URL nuqs state, 返回 tRPC 入参. 不建 table, 不需要 columns 引用.
 * caller 用返回值发 useQuery, 再把 data 传给 useServerDataTable.
 */
export function useDataTableQueryParams(
  props: UseDataTableQueryParamsProps = {}
): ServerQueryParams {
  const { sortableIds = [], filterableIds = [], selectFilterIds = [], defaultPageSize = 10 } = props

  const queryStateOptions: Omit<UseQueryStateOptions<string>, 'parse'> = React.useMemo(
    () => ({ history: 'replace', scroll: false, shallow: true, clearOnDefault: false }),
    []
  )

  const [page, setPageState] = useQueryState(
    'page',
    parseAsInteger.withOptions(queryStateOptions).withDefault(1)
  )
  const [perPage] = useQueryState(
    'perPage',
    parseAsInteger.withOptions(queryStateOptions).withDefault(defaultPageSize)
  )
  const sortableSet = React.useMemo(() => new Set<string>(sortableIds), [sortableIds])
  const [sortState] = useQueryState(
    'sort',
    getSortingStateParser<Record<string, unknown>>(sortableSet)
      .withOptions(queryStateOptions)
      .withDefault([])
  )

  const filterParsers = React.useMemo(() => {
    const acc: Record<string, SingleParser<string> | SingleParser<string[]>> = {}
    for (const id of filterableIds) {
      if (selectFilterIds.includes(id)) {
        acc[id] = parseAsArrayOf(parseAsString, ',').withOptions(queryStateOptions)
      } else {
        acc[id] = parseAsString.withOptions(queryStateOptions)
      }
    }
    return acc
  }, [filterableIds, selectFilterIds, queryStateOptions])

  const [filterValues] = useQueryStates(filterParsers)

  const [, setSortState] = useQueryState(
    'sort',
    getSortingStateParser<Record<string, unknown>>(sortableSet)
      .withOptions(queryStateOptions)
      .withDefault([])
  )
  const setPage = React.useCallback((next: number) => void setPageState(next), [setPageState])
  const setSort = React.useCallback(
    (sort: { id: string; desc: boolean }[]) => void setSortState(sort),
    [setSortState]
  )

  return React.useMemo(() => {
    const filters: Record<string, string | string[]> = {}
    for (const [id, v] of Object.entries(filterValues)) {
      if (v === null || v === undefined) continue
      if (typeof v === 'string' || Array.isArray(v)) {
        filters[id] = v
      }
    }
    const first = sortState[0]
    return {
      page,
      pageSize: perPage,
      sortBy: first?.id,
      sortOrder: first ? (first.desc ? 'desc' : 'asc') : undefined,
      filters,
      setPage,
      setSort
    }
  }, [page, perPage, sortState, filterValues, setPage, setSort])
}

export interface UseServerDataTableProps<TData>
  extends Omit<UseDataTableProps<TData>, 'pageCount' | 'data'> {
  /** tRPC 当前页数据 (可能 undefined). helper 内部 fallback 到稳定 [] 引用. */
  data: TData[] | undefined
  /** 后端返回的总行数 (可能 undefined). helper 内部 fallback 到 0. */
  rowCount: number | undefined
}

export interface UseServerDataTableReturn<TData> {
  table: Table<TData>
  queryParams: ServerQueryParams
}

/** 稳定空数组引用: never[] 是任意 T[] 的子类型, 单点局部化. */
const EMPTY_LIST: never[] = []

export function useServerDataTable<TData>(
  props: UseServerDataTableProps<TData>
): UseServerDataTableReturn<TData> {
  const { data, rowCount, initialState, ...rest } = props
  const pageSizeInitial = initialState?.pagination?.pageSize ?? 10

  const rows: TData[] = data ?? EMPTY_LIST
  const total = rowCount ?? 0
  const pageCount = total > 0 ? Math.ceil(total / pageSizeInitial) : 0

  const { table } = useDataTable<TData>({
    ...rest,
    data: rows,
    initialState,
    pageCount
  })

  const state: {
    pagination: { pageIndex: number; pageSize: number }
    sorting: SortingState
    columnFilters: ColumnFiltersState
  } = table.getState()
  const queryParams = React.useMemo<ServerQueryParams>(() => {
    const first = state.sorting[0]
    const filters: Record<string, string | string[]> = {}
    for (const f of state.columnFilters) {
      const v = f.value
      if (typeof v === 'string' || Array.isArray(v)) {
        filters[f.id] = v as string | string[]
      }
    }
    return {
      page: state.pagination.pageIndex + 1,
      pageSize: state.pagination.pageSize,
      sortBy: first?.id,
      sortOrder: first ? (first.desc ? 'desc' : 'asc') : undefined,
      filters,
      // 这一份 queryParams 由 table 状态推导, 故翻页/排序都走 table 自身状态.
      setPage: (next: number) => table.setPageIndex(next - 1),
      setSort: sort => table.setSorting(sort)
    }
  }, [state.pagination, state.sorting, state.columnFilters, table])

  return { table, queryParams }
}

/** 取 filter value 的首个 (select-类是 string[], 后端多为标量). */
export function firstOrUndef(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined
  return Array.isArray(v) ? v[0] : v
}
