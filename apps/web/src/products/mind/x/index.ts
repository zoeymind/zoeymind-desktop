// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * enterprise/web/mind 入口 —— apps/mind 通过 tsconfig `paths` 的
 * `@zoeymind-ext-mind` 数组 fallback 命中本文件；社区版落到
 * `apps/mind/src/enterprise-shim.ts`。两侧 API 表面严格对齐。
 */

export {
  AIChatProvider,
  AIFeaturePanel,
  AIStatusBadge,
  useAIProcessing,
  resolveMindmapShortId,
  attachGhostCompletion
} from './bridge'