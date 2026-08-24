/**
 * waitForMindMapInstance — 在 store 还没装载 mindMap 时, 等一段时间再 resolve.
 * 提取自原 useAIChat.ts.
 */

import type { MindMap } from "@/products/mind/stores"
import type { ProjectSessionStore } from "@/products/mind/editor-session"

const DEFAULT_TIMEOUT = 3000

export async function waitForMindMapInstance(
  sessionStore: ProjectSessionStore,
  timeout: number = DEFAULT_TIMEOUT
): Promise<MindMap | null> {
  const existing = sessionStore.getState().mindMap
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

    unsubscribe = sessionStore.subscribe(state => {
      if (state.mindMap && !settled) {
        settled = true
        clearTimeout(timer)
        unsubscribe()
        resolve(state.mindMap)
      }
    })
  })
}
