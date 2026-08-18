import type { FilterFn } from '@tanstack/react-table'
import type { FilterVariant } from './types'

/**
 * Variant → tanstack filterFn 映射 (M3)。
 *
 * 列 columnDef.filterFn 存在时**优先**，此表仅作为默认兜底。
 * 语义与 `FilterVariant` JSDoc 一致：
 * - text: 大小写不敏感 includes
 * - number: 等值
 * - range: 落在 [min, max] 闭区间
 * - date: 同日 (按年月日比较)
 * - dateRange: 落在 [from, to] 闭区间 (含首末日)
 * - select: 等值
 * - multiSelect: 命中任一 (arrIncludesSome)
 *
 * 所有 fn 都是**同步 pure**, 不依赖闭包外部状态 -- 便于将来做 SSR / 序列化。
 */

const textIncludes: FilterFn<unknown> = (row, columnId, value) => {
  if (value == null || value === '') return true
  const cell = row.getValue<unknown>(columnId)
  if (cell == null) return false
  return String(cell).toLowerCase().includes(String(value).toLowerCase())
}

const numberEquals: FilterFn<unknown> = (row, columnId, value) => {
  if (value == null || value === '') return true
  const cell = row.getValue<unknown>(columnId)
  if (cell == null) return false
  return Number(cell) === Number(value)
}

const numberInRange: FilterFn<unknown> = (row, columnId, value) => {
  if (!Array.isArray(value) || value.length !== 2) return true
  const [min, max] = value as [unknown, unknown]
  const cell = row.getValue<unknown>(columnId)
  if (cell == null) return false
  const n = Number(cell)
  if (Number.isNaN(n)) return false
  const lo = min == null || min === '' ? -Infinity : Number(min)
  const hi = max == null || max === '' ? Infinity : Number(max)
  return n >= lo && n <= hi
}

function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value as string | number)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 归零到当地 00:00:00, 用于按日比较。 */
function startOfDay(d: Date): number {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

const dateSameDay: FilterFn<unknown> = (row, columnId, value) => {
  const filterDate = toDate(value)
  if (!filterDate) return true
  const cellDate = toDate(row.getValue<unknown>(columnId))
  if (!cellDate) return false
  return startOfDay(cellDate) === startOfDay(filterDate)
}

const dateInRange: FilterFn<unknown> = (row, columnId, value) => {
  if (!Array.isArray(value) || value.length !== 2) return true
  const [from, to] = value as [unknown, unknown]
  const fromDate = toDate(from)
  const toDateVal = toDate(to)
  if (!fromDate && !toDateVal) return true
  const cellDate = toDate(row.getValue<unknown>(columnId))
  if (!cellDate) return false
  const cellDay = startOfDay(cellDate)
  const loDay = fromDate ? startOfDay(fromDate) : -Infinity
  // 闭区间：to 视为当日 23:59:59.999，用下一日 00:00:00 - 1 表示，等价于比较到日粒度 `cellDay <= startOfDay(to)`
  const hiDay = toDateVal ? startOfDay(toDateVal) : Infinity
  return cellDay >= loDay && cellDay <= hiDay
}

const selectEquals: FilterFn<unknown> = (row, columnId, value) => {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return true
  const cell = row.getValue<unknown>(columnId)
  if (cell == null) return false
  // 支持单值 or 单元素数组两种入参形态。
  const target = Array.isArray(value) ? value[0] : value
  return String(cell) === String(target)
}

const multiSelectIncludes: FilterFn<unknown> = (row, columnId, value) => {
  if (!Array.isArray(value) || value.length === 0) return true
  const cell = row.getValue<unknown>(columnId)
  if (cell == null) return false
  // 支持单值列 (cell 是 primitive) 与数组列 (cell 是 array) 两种存储形态。
  if (Array.isArray(cell)) {
    return cell.some(c => value.includes(String(c)))
  }
  return value.includes(String(cell))
}

/**
 * 供 `useClientDataTable` 装配时按 variant 挂载 (列 columnDef.filterFn 优先)。
 * 直接暴露 registry, 消费方 `FILTER_FN_BY_VARIANT[variant]` 索引即可。
 */
export const FILTER_FN_BY_VARIANT = {
  text: textIncludes,
  number: numberEquals,
  range: numberInRange,
  date: dateSameDay,
  dateRange: dateInRange,
  boolean: selectEquals,
  select: selectEquals,
  multiSelect: multiSelectIncludes
} as const satisfies Record<FilterVariant, FilterFn<unknown>>
