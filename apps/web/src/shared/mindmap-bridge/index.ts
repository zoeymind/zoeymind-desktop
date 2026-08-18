/**
 * @zoeymind/mindmap-bridge —— mindmap 产品对外暴露给其他 app 的表面。
 *
 * **设计意图**：
 *
 *   web / kb / qms 不渲染思维导图编辑器（那是 mind 的产品），但需要消费
 *   mindmap 的少量公共表面：AI Chat 状态、IndexedDB schema、icon → priority
 *   映射、joyride 引导配置、可选的 Cloud Project picker 等。
 *
 *   过去这些是直接 `import` features/mindmap 源码 —— 导致 kb / qms 不得不
 *   复制整个 features/mindmap 才能编译过，几百个文件因此变成死代码副本。
 *
 *   本包收编"被其他 app 真实消费的 mindmap 表面"。kb / qms 只 import
 *   这个 bridge 包，**不再需要 features/mindmap 副本**。
 *
 * **目录结构**：
 *
 *   bridge 镜像了 apps/mind/src 的相对路径，但把 `features/mindmap/` 前缀
 *   去掉（因为这个包本身就是 mindmap 域，不需要再嵌套一层）。
 *
 *     features/mindmap/X       → mindmap-bridge/src/X
 *     features/mindmap/ai-chat → mindmap-bridge/src/ai-chat
 *
 *   还包含被 mindmap 闭包依赖的少量平台工具（hooks/useLoading、stores/project-store、
 *   utils/storage/projectDB、utils/uuid），这些后续可下沉到 @zoeymind/app-shared。
 *
 * **演进方向**：
 *
 *   每个导出件改成 `interface` + factory，由 mind 注入实现，bridge 仅
 *   定义契约不带实现。届时达到"插件 + 统一接口"形态。
 */

// === 类型 ===
export type { Position, DropdownState, IconToolbarState, ViewData } from './components/types'
export type {
  CollaborationUserInfo,
  CursorPosition,
  AwarenessSync,
  CooperatePlugin
} from './types/mindmap-extensions'

// === 核心 store / state ===
export { useMindMapStore, type MindMapRef, type ExitPreviewCallback } from './stores/mindmap-store'

// === Icon priority utility ===
export {
  extractPriorityFromIcons,
  parsePriorityFromText,
  createPriorityIcons,
  type Priority
} from './ai-chat/tools/mindmap/priority-label'

// === Joyride 引导配置 ===
export { joyrideStyles, joyrideLocale } from './components/guides/joyrideConfig'

// === Cloud project picker ===
export { useCloudProjects } from './components/projects/hooks/useCloudProjects'

// mindmap 元数据（IndexedDB schema）
export { mindmapDB } from './utils/storage/mindmapDB'

// === Project state + DB (mindmap-specific) ===
export { useProjectManager } from './stores/project-store'
export {
  projectDB,
  type ProjectDB,
  type Project,
  type ProjectStats,
  type ProjectWithStats
} from './utils/storage/projectDB'
