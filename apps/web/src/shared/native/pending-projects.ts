/**
 * 未保存新建项目的暂存池 —— 仅内存，不落盘也不入 SqlProjectRepo。
 *
 * 触发时机：
 *   - "+新建"点击后：`stash(bundle, title)` 生成 tempId (`unsaved-<uuid>`) 并 push，
 *     然后 navigate `/editor/<tempId>`
 *   - 编辑器判断 id 以 `unsaved-` 开头 → 走 `read(tempId)` 从内存取
 *   - Ctrl+S 触发 tauri save dialog；writeBundle + registerProject 完成后 `clear(tempId)`
 *     并 navigate replace 到 `/editor/<realId>`
 *   - 关闭编辑器（返回列表 / 关闭 tab）：`clear(tempId)`，卡片不出现在列表
 *
 * 现存条目在页面 reload 后清空 —— 未保存的想法本来就该丢。
 */
import type { MindMapNodeTree } from "simple-mind-map"
import type { FileRevision } from "./file-revision"

export interface RecoveryOrigin {
  recoveryId: string
  path: string | null
  revision: FileRevision | null
}

export interface PendingProject {
  id: string
  title: string
  tree: MindMapNodeTree
  view?: unknown
  createdAt: number
  recovery?: RecoveryOrigin
}

const store = new Map<string, PendingProject>()

const PREFIX = "unsaved-"

/**
 * 成员判断: 只要不在内存 stash 里就不算 pending, 与运行期 id 前缀无关.
 * 之前是 `id.startsWith('unsaved-')`, 但保存成功后 tab 就地晋升仍保留 tempId,
 * 前缀仍匹配 -> saveAllSessions 保存后二次检查判 "未保存", 关窗全部保存必失败.
 */
export function isPending(id: string): boolean {
  return store.has(id)
}

export function stash(input: Omit<PendingProject, "id" | "createdAt">): string {
  const id = `${PREFIX}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
  store.set(id, { ...input, id, createdAt: Date.now() })
  return id
}
export function stashRecovered(input: {
  title: string
  tree: MindMapNodeTree
  view?: unknown
  recoveryId: string
  originPath: string | null
  originRevision: FileRevision | null
}): string {
  const id = stash({
    title: input.title,
    tree: input.tree,
    view: input.view,
    recovery: {
      recoveryId: input.recoveryId,
      path: input.originPath,
      revision: input.originRevision,
    },
  })
  return id
}

export function read(id: string): PendingProject | undefined {
  return store.get(id)
}

/** 恢复 tab 继续覆盖原备份；普通 draft/file 使用自己的项目 ID。 */
export function recoveryStorageId(id: string): string {
  return store.get(id)?.recovery?.recoveryId ?? id
}

export function clear(id: string): void {
  store.delete(id)
}

/** pending 项目改标题 — 供 TopBar 双击编辑标题 flow. */
export function rename(id: string, name: string): void {
  const p = store.get(id)
  if (!p) return
  store.set(id, { ...p, title: name })
}
