// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * waitForMindMapInstance — 在 store 还没装载 mindMap 时, 等一段时间再 resolve.
 * 提取自原 useAIChat.ts.
 */

import type { MindMap } from '@/products/mind/stores'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'

const DEFAULT_TIMEOUT = 3000

export async function waitForMindMapInstance(
  timeout: number = DEFAULT_TIMEOUT
): Promise<MindMap | null> {
  const existing = useMindMapStore.getState().mindMap
  if (existing) return existing

  return new Promise<MindMap | null>(resolve => {
    let settled = false

    let unsubscribe: () => void = () => {}
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        unsubscribe()
        resolve(null)
      }
    }, timeout)

    unsubscribe = useMindMapStore.subscribe(state => {
      const mindMap = state.mindMap
      if (mindMap && !settled) {
        settled = true
        clearTimeout(timer)
        unsubscribe()
        resolve(mindMap)
      }
    })
  })
}