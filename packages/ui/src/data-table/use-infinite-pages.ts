/**
 * 无限滚动分页 — 把「一页一换」的服务端表格变成「滚到底续接下一页」。
 *
 * 与普通分页的唯一差异：数据**累积**而非替换 —— 第 N 页到达后追加在已有行之后，
 * 已渲染的行原地不动，所以续接是顺滑的、不会整表重刷。
 *
 * 排序 / 过滤 / pageSize 变化会重置累积 —— 那时旧行不再属于同一结果集，继续追加
 * 会得到一份混合两种条件的脏列表。
 *
 * 翻页仍走 URL（`?page=`），故刷新、分享、后退与底部通用 footer 全部保持原语义；
 * 本 hook 只负责累积已到达的页。
 *
 * 用法（配合 `useServerDataTable` / `useDataTableQueryParams`）：
 *   const pages = useInfinitePages({
 *     page: queryParams.page,
 *     pageSize: queryParams.pageSize,
 *     rowCount: listQuery.data?.total,
 *     pageRows: listQuery.data?.items,
 *     isFetching: listQuery.isFetching,
 *     onRequestPage: queryParams.setPage,
 *     resetKey: [queryParams.sortBy, queryParams.sortOrder, queryParams.filters]
 *   })
 */
import * as React from 'react'

export interface UseInfinitePagesProps<TData> {
  /** 当前请求的页码（1-based），来自 URL。 */
  page: number
  pageSize: number
  /** 后端总行数；undefined 视为未知（此时不判定是否已到末页）。 */
  rowCount: number | undefined
  /** 当前页返回的行；undefined = 尚未到达。 */
  pageRows: TData[] | undefined
  /** 请求进行中 —— 用于避免重复触发下一页。 */
  isFetching: boolean
  /** 请求加载某一页 —— 调用方把它写进 URL（`?page=`），由此驱动下一次查询。 */
  onRequestPage: (page: number) => void
  /**
   * 变化即重置累积的依赖项（排序、过滤、pageSize…）。
   * 用 JSON 序列化比较，故只放可序列化的值。
   */
  resetKey?: unknown
}

export interface UseInfinitePagesReturn<TData> {
  /** 累积后的全部行，按页顺序拼接。 */
  rows: TData[]
  /** 是否还有未加载的页 —— 决定是否渲染底部哨兵。 */
  hasMore: boolean
  /** 滚动到底部时调用 —— 内部自行判重与判末页。 */
  loadMore: () => void
}

/** 空数组常量 —— 避免每次渲染产出新引用触发下游 memo 失效。 */
const EMPTY: never[] = []

export function useInfinitePages<TData>({
  page,
  pageSize,
  rowCount,
  pageRows,
  isFetching,
  onRequestPage,
  resetKey
}: UseInfinitePagesProps<TData>): UseInfinitePagesReturn<TData> {
  // 累积容器：页码 → 该页的行。用 Map 而非数组拼接，天然去重且乱序到达也不会错位。
  const [pages, setPages] = React.useState<Map<number, TData[]>>(() => new Map())
  const serializedResetKey = JSON.stringify(resetKey ?? null)
  const lastResetKey = React.useRef(serializedResetKey)

  // 条件变了：清空累积。放在渲染期而非 effect —— effect 会先用旧行渲染一帧脏数据。
  if (lastResetKey.current !== serializedResetKey) {
    lastResetKey.current = serializedResetKey
    if (pages.size > 0) setPages(new Map())
  }

  React.useEffect(() => {
    if (!pageRows) return
    // 请求在途时不落账：上游用 placeholderData 保住上一页(避免闪), 此刻 page 已
    // 是新页而 pageRows 还是旧页内容 —— 写进去等于把上一页的行按新页号再存一份,
    // 累积结果会出现重复行、行数冲过总数。
    if (isFetching) return
    setPages(prev => {
      // 同一页重复到达且内容未变（tRPC 缓存命中）时不产生新 Map，避免无谓重渲染。
      if (prev.get(page) === pageRows) return prev
      const next = new Map(prev)
      next.set(page, pageRows)
      return next
    })
  }, [page, pageRows, isFetching])

  const { rows, loadedThrough } = React.useMemo(() => {
    const sorted = [...pages.keys()].sort((a, b) => a - b)
    const acc: TData[] = []
    for (const p of sorted) {
      const chunk = pages.get(p)
      if (chunk) acc.push(...chunk)
    }
    return {
      rows: acc.length > 0 ? acc : (EMPTY as TData[]),
      loadedThrough: sorted.length > 0 ? sorted[sorted.length - 1] : 0
    }
  }, [pages])

  const totalPages =
    rowCount === undefined ? undefined : Math.max(1, Math.ceil(rowCount / pageSize))
  const hasMore = totalPages === undefined ? false : loadedThrough > 0 && loadedThrough < totalPages

  const loadMore = React.useCallback(() => {
    if (isFetching || !hasMore) return
    onRequestPage(loadedThrough + 1)
  }, [isFetching, hasMore, loadedThrough, onRequestPage])

  return { rows, hasMore, loadMore }
}
