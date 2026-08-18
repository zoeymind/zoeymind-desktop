import type { Column } from '@tanstack/react-table'
import { dataTableConfig } from './config'
import type { ExtendedColumnFilter, FilterOperator, FilterVariant } from './types'

export function getColumnPinningStyle<TData>({
  column
}: {
  column: Column<TData>
}): React.CSSProperties {
  const isPinned = column.getIsPinned()

  return {
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? 'sticky' : 'relative',
    // 只有 sticky 列需要不透明背景遮挡横向滚动下的其它列；未 pinned 保持透明，
    // 让 TableHeader (bg-muted) / DataTable 外框 (bg-card) 的背景透上来。
    // 用 var(--card) 与外框同色，pinned 列滑动时视觉上与本体一致。
    background: isPinned ? 'var(--card)' : undefined,
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined
  }
}

export function getFilterOperators(filterVariant: FilterVariant) {
  const operatorMap: Record<FilterVariant, { label: string; value: FilterOperator }[]> = {
    text: dataTableConfig.textOperators,
    number: dataTableConfig.numericOperators,
    range: dataTableConfig.numericOperators,
    date: dataTableConfig.dateOperators,
    dateRange: dataTableConfig.dateOperators,
    boolean: dataTableConfig.booleanOperators,
    select: dataTableConfig.selectOperators,
    multiSelect: dataTableConfig.multiSelectOperators
  }

  return operatorMap[filterVariant] ?? dataTableConfig.textOperators
}

export function getDefaultFilterOperator(filterVariant: FilterVariant) {
  const operators = getFilterOperators(filterVariant)

  return operators[0]?.value ?? (filterVariant === 'text' ? 'iLike' : 'eq')
}

export function getValidFilters<TData>(
  filters: ExtendedColumnFilter<TData>[]
): ExtendedColumnFilter<TData>[] {
  return filters.filter(
    filter =>
      filter.operator === 'isEmpty' ||
      filter.operator === 'isNotEmpty' ||
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : filter.value !== '' && filter.value !== null && filter.value !== undefined)
  )
}
