/**
 * Enterprise mind 桥接层 —— 把散落在扩展模块内部的 hook / helper 组装成
 * `apps/mind/src/enterprise-shim.ts` 定义的对外接口, 让 mind app 代码只
 * 依赖一个入口 (`@zoeymind-ext-mind`).
 */

import type { ReactElement } from 'react'
import { useAIChatRuntime } from './ai-chat/context/AIChatRuntimeContext'
import { getModuleAIChatRuntime } from './ai-chat/context/AIChatRuntimeContext'
import { SessionIdMapper } from './ai-chat/tools/session-id-mapper'
import { UnifiedAIPanel } from './UnifiedAIPanel'

export { AIChatProvider } from './ai-chat/AIChatProvider'
export { attachGhostCompletion } from './plugins/ghost-completion'

export function AIFeaturePanel({ isActive }: { isActive?: boolean }): ReactElement {
  return <UnifiedAIPanel isActive={isActive} />
}

export function AIStatusBadge(): ReactElement | null {
  const runtime = useAIChatRuntime()
  const active = runtime.status === 'submitted' || runtime.status === 'streaming'
  return active ? (
    <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary animate-pulse" />
  ) : null
}

export function useAIProcessing(): boolean {
  const runtime = useAIChatRuntime()
  return runtime.status === 'submitted' || runtime.status === 'streaming'
}

/**
 * 把 AI 生成的短 id (Session-scoped, 由 SessionIdMapper 分配) 还原为 mindmap
 * 节点 UUID. 只有 AI 工具产出的引用会用到短 id, 社区版永远收到 UUID, 因此
 * shim 里等价于 identity.
 */
export function resolveMindmapShortId(nodeId: string): string {
  if (!SessionIdMapper.isShortId(nodeId)) return nodeId
  const mapper = getModuleAIChatRuntime()?.getIdMapper() ?? null
  return mapper ? mapper.tryResolve(nodeId) : nodeId
}
