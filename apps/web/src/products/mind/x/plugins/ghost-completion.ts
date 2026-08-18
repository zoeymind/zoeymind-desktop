/**
 * Ghost completion 插件挂载. 由 `apps/mind/src/features/mindmap/components/managers/PluginManager.ts`
 * 通过 `@zoeymind-ext-mind` 导入; 社区版对应 shim 里为 `undefined`, 不挂.
 *
 * `getOrganizationId` 由宿主 (`MindMapCanvas`) 每次 currentOrg 变化时通过
 * `setCurrentOrganizationId` 更新, 这里读时拿到最新值.
 */
import type { default as MindMap } from 'simple-mind-map'
import GhostCompletion from 'simple-mind-map/src/plugins/GhostCompletion'
import { logger } from '@zoeymind/logger'
import { trpcClient } from '../lib/trpc'

interface GhostSuggestionPayload {
  nodeUid: string
  text: string
  context: {
    node: { uid: string; text: string }
    type: 'module' | 'case' | 'step' | 'unknown'
    module?: {
      node: { uid: string; text: string }
      cases: Array<{
        uid: string
        text: string
        steps: Array<{ uid: string; text: string }>
      }>
    } | null
  } | null
}

export function attachGhostCompletion(
  mindMap: typeof MindMap,
  getOrganizationId: () => string | undefined
): void {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  mindMap.usePlugin(GhostCompletion, {
    minLength: 0,
    delay: 1000,
    suggestionProvider: async (payload: GhostSuggestionPayload) => {
      logger.debug('[MindMapAICompletion] suggestion-request', payload)
      const organizationId = getOrganizationId()
      if (!organizationId) {
        logger.debug('[MindMapAICompletion] 无组织 ID，跳过')
        return ''
      }
      try {
        const data = await trpcClient.ghost.completion.mutate({
          ...payload,
          organizationId
        })
        logger.info('[MindMapAICompletion] suggestion-response', data)
        if (data && typeof data === 'object' && 'suggestion' in data) {
          const { suggestion } = data
          return typeof suggestion === 'string' ? suggestion : ''
        }
        return ''
      } catch (error) {
        logger.warn('[MindMapAICompletion] suggestion-fetch-error', { error })
        return ''
      }
    },
    onContextLog: (payload: GhostSuggestionPayload) => {
      logger.info('[MindMapAICompletion] ghost-context', payload)
    },
    onError: (error: unknown, payload: GhostSuggestionPayload) => {
      logger.warn('[MindMapAICompletion] suggestion-error', { error, payload })
    }
  })
}
