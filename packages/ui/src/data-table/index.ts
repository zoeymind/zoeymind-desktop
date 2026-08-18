// Re-export core tanstack-table types apps need for column definitions.
// Keeps @zoeymind/ui the single import surface for data-table work.
export type { ColumnDef, Row, Column } from '@tanstack/react-table'
export type { Table as DataTableInstance } from '@tanstack/react-table'

export { DataTable } from './data-table'
export { DataTableColumnHeader } from './data-table-column-header'
export { DataTablePagination } from './data-table-pagination'
export { DataTableSkeleton } from './data-table-skeleton'
export { DataTableToolbar } from './data-table-toolbar'
export { DataTableViewOptions } from './data-table-view-options'

export { useDataTable } from './use-data-table'
export {
  useServerDataTable,
  useDataTableQueryParams,
  firstOrUndef,
  type ServerQueryParams,
  type UseServerDataTableProps,
  type UseServerDataTableReturn,
  type UseDataTableQueryParamsProps
} from './use-server-data-table'
export { useClientDataTable } from './use-client-data-table'
export {
  useInfinitePages,
  type UseInfinitePagesProps,
  type UseInfinitePagesReturn
} from './use-infinite-pages'
export {
  useInfiniteScrollSentinel,
  type UseInfiniteScrollSentinelProps,
  type UseInfiniteScrollSentinelReturn
} from './use-infinite-scroll-sentinel'
export { dataTableConfig, type DataTableConfig } from './config'
export type {
  ExtendedColumnFilter,
  ExtendedColumnSort,
  FilterOperator,
  FilterVariant,
  JoinOperator,
  Option,
  QueryKeys,
  DataTableRowAction
} from './types'
export { getColumnPinningStyle } from './lib'
