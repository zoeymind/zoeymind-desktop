import { createParser } from 'nuqs/server'
import { z } from 'zod'

import { dataTableConfig } from './config'

import type { ExtendedColumnFilter, ExtendedColumnSort } from './types'

/**
 * sort URL 编码: 逗号分隔的 `<colId>:asc|desc` 条目, 例如 `sort=updatedAt:desc,seq:asc`.
 *
 * 早期实现存 JSON (`sort=[{"id":"updatedAt","desc":true}]`) —— 在 tanstack-router 项目里
 * 与 router 默认 `parseSearch: JSON.parse` 冲突: router 会把 sort 值提前解析成数组对象,
 * nuqs adapter 拿到后 `String()` 强转为 `[object Object]`, 反解失败退回默认值 —— 表现为
 * "点表头排序闪一下没反应, 再点才生效, 一翻页又重置". 见 nuqs#1127 / #1128.
 *
 * 官方在 nuqs 文档 "parsers/making-your-own" 与 "beware-the-url-type-safety-iceberg"
 * 里推荐的 TanStack Table 排序 URL 格式就是 `sort=id:asc`, 完全绕开 JSON.parse 路径.
 * 多列排序用逗号分隔, 保留出现顺序 = tanstack-table sortingState 顺序.
 */
const SORT_ITEM_RE = /^([^:,]+):(asc|desc)$/

export const getSortingStateParser = <TData>(columnIds?: string[] | Set<string>) => {
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null

  return createParser({
    parse: value => {
      if (!value) return null
      const items: ExtendedColumnSort<TData>[] = []
      for (const raw of value.split(',')) {
        const m = SORT_ITEM_RE.exec(raw)
        if (!m) return null
        const [, id, dir] = m
        if (validKeys && !validKeys.has(id!)) return null
        items.push({ id: id!, desc: dir === 'desc' } as ExtendedColumnSort<TData>)
      }
      return items
    },
    serialize: value => value.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(','),
    eq: (a, b) =>
      a.length === b.length &&
      a.every((item, index) => item.id === b[index]?.id && item.desc === b[index]?.desc)
  })
}

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(dataTableConfig.filterVariants),
  operator: z.enum(dataTableConfig.operators),
  filterId: z.string()
})

export type FilterItemSchema = z.infer<typeof filterItemSchema>

export const getFiltersStateParser = <TData>(columnIds?: string[] | Set<string>) => {
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null

  return createParser({
    parse: value => {
      try {
        const parsed = JSON.parse(value)
        const result = z.array(filterItemSchema).safeParse(parsed)

        if (!result.success) return null

        if (validKeys && result.data.some(item => !validKeys.has(item.id))) {
          return null
        }

        return result.data as ExtendedColumnFilter<TData>[]
      } catch {
        return null
      }
    },
    serialize: value => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every(
        (filter, index) =>
          filter.id === b[index]?.id &&
          filter.value === b[index]?.value &&
          filter.variant === b[index]?.variant &&
          filter.operator === b[index]?.operator
      )
  })
}
