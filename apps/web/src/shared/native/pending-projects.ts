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
import type { MindMapNodeTree } from 'simple-mind-map'

export interface PendingProject {
  id: string
  title: string
  tree: MindMapNodeTree
  createdAt: number
}

const store = new Map<string, PendingProject>()

const PREFIX = 'unsaved-'

export function isPending(id: string): boolean {
  return id.startsWith(PREFIX)
}

export function stash(input: Omit<PendingProject, 'id' | 'createdAt'>): string {
  const id = `${PREFIX}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
  store.set(id, { id, title: input.title, tree: input.tree, createdAt: Date.now() })
  return id
}

export function read(id: string): PendingProject | undefined {
  return store.get(id)
}

export function clear(id: string): void {
  store.delete(id)
}
