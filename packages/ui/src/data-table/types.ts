import type { ColumnSort, Row, RowData } from '@tanstack/react-table'
import type { DataTableConfig } from './config'
import type { FilterItemSchema } from './parsers'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    queryKeys?: QueryKeys
  }

  interface ColumnMeta<TData extends RowData, TValue> {
    /** 用户可见的列名 (显示在表头 filter Popover 标题、视图切换等)。缺省 fallback 到 column.id。 */
    label?: string
    /** filter 输入占位符 (text / number variant)。 */
    placeholder?: string
    /**
     * 列过滤 UI 形态标签。与 diceui 语义一致：
     * - `text` — 单文本框；默认 filterFn 大小写不敏感 includes
     * - `number` — 单数字输入；默认等值匹配
     * - `range` — 双数字 / slider；落在区间内
     * - `date` — 单日期选择；同日命中
     * - `dateRange` — 双日期选择；含首末日的闭区间
     * - `select` — 单选；等值命中
     * - `multiSelect` — 多选；命中任一 (arrIncludesSome)
     *
     * 存在此字段的列会在表头自动挂载 filter 图标。列 `filterFn` 显式指定时覆盖默认语义。
     */
    variant?: FilterVariant
    /** `select` / `multiSelect` 的静态选项列表。value 必须 URL-safe (禁含逗号)。 */
    options?: Option[]
    /** `range` 的数值边界；用于 slider 默认范围。 */
    range?: [number, number]
    /** `number` / `range` 的单位后缀 (如 "ms" / "kg")。 */
    unit?: string
    /** 表头 filter 图标 (无 filterRender 时)。缺省 lucide `Filter`。 */
    icon?: React.ComponentType<React.ComponentProps<'svg'>>
    /**
     * 表头 filter Popover 内容的自定义渲染逃生舱。
     * 存在时**忽略 variant / options 内置渲染** —— 业务侧完全负责渲染 UI 并调用
     * `column.setFilterValue()` 写回过滤值。用于树形模块选择器等标准 variant 无法承载的场景。
     */
    filterRender?: (ctx: {
      column: import('@tanstack/react-table').Column<TData, TValue>
      close: () => void
    }) => React.ReactNode
    /** 单元格内容截断，默认 true。传 false 允许换行（如描述列）。 */
    truncate?: boolean
  }
}

export interface QueryKeys {
  page: string
  perPage: string
  sort: string
  filters: string
  joinOperator: string
}

export interface Option {
  label: string
  value: string
  count?: number
  /** 前置图标 (`svg` 组件类)。适合静态 lucide icon。 */
  icon?: React.ComponentType<React.ComponentProps<'svg'>>
  /**
   * 前置任意 React 节点 (如 `<UserAvatarWithCard>`)。用于每个选项渲染独立头像/图片时。
   * 与 `icon` 二选一; 同时给时 `prefix` 优先。
   */
  prefix?: React.ReactNode
}

export type FilterOperator = DataTableConfig['operators'][number]
export type FilterVariant = DataTableConfig['filterVariants'][number]
export type JoinOperator = DataTableConfig['joinOperators'][number]

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, 'id'> {
  id: Extract<keyof TData, string>
}

export interface ExtendedColumnFilter<TData> extends FilterItemSchema {
  id: Extract<keyof TData, string>
}

export interface DataTableRowAction<TData> {
  row: Row<TData>
  variant: 'update' | 'delete'
}
