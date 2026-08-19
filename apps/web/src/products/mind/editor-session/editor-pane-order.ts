export function reconcileEditorPaneOrder(
  currentOrder: readonly string[],
  openTabOrder: readonly string[]
): string[] {
  const openTabIds = new Set(openTabOrder)
  const retained = currentOrder.filter(id => openTabIds.has(id))
  const retainedIds = new Set(retained)
  const added = openTabOrder.filter(id => !retainedIds.has(id))
  if (added.length === 0 && retained.length === currentOrder.length) return currentOrder as string[]
  return [...retained, ...added]
}
