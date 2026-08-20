/**
 * shared/native —— 桌面端所有 native 依赖的入口 (SQLite / fs / dialog / shell)。
 * 前端其它地方一律通过本文件 import，不直接 import @tauri-apps/*，
 * 便于测试和替换。
 */
export * from "./db"
export * from "./paths"
export * from "./atomic-file"
export * from "./file-revision"
export * from "./zmind-file"
export * from "./chat-repo"
export * from "./models-config"
export * from "./preview"
export * from "./recovery-queue"
export * from "./recovery-service"
export * from "./recovery"
export * from "./folders-repo"
export * from "./projects-repo"
export * from "./mcp-repo"
export * from "./mcp-spawn"
export * from "./window-close-coordinator"
export * from "./save-flow"
export { UnsavedGuard } from "./unsaved-guard"
export { SaveFlowProvider, useSaveFlowContext, useOptionalSaveFlow } from "./save-flow-context"
export {
  useProjectsEvents,
  bumpProjects,
  notifyProjectPathChanged,
  notifyProjectRenamed,
  type ProjectPathEvent,
  type ProjectRenameEvent,
} from "./projects-events"
export { FileAssociationsListener } from "./file-associations"
export { setupAppMenu } from "./app-menu"
export { fetchProviderModels, type FetchedModel } from "./fetch-provider-models"
export {
  loadAppVersionInfo,
  openLatestRelease,
  openGitHubSupport,
  isNewerVersion,
  type AppVersionInfo,
  type LatestRelease,
} from "./app-version"
export {
  streamChat,
  type StreamChatOptions,
  type StreamChatHandle,
  type StreamChatMessage,
} from "./desktop-chat"
export { nativeFetch } from "./native-fetch"
export * as chatRepo from "./chat-repo"
export type { ChatConversationRow, ChatMessageRow } from "./chat-repo"

export * as pendingProjects from "./pending-projects"
// 便利再导出：native 侧 hook 大多同时要 UUID，避免调用方两条 import
export { createUUID, generateUUID } from "@/shared/app-shared"
