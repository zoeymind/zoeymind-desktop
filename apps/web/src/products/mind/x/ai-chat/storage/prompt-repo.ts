/**
 * Prompt repo —— sqlite:app.db 上的 prompts 表 CRUD.
 *
 * 桌面端单人本地库, 没有 isPublic / user 字段 / 社区分享概念. UI 里删除的
 * community tab / togglePublic / saveToLibrary 都不会调到这里.
 */

import { select, execute } from '@/shared/native/db'

export interface PromptRecord {
  id: string
  title: string
  content: string
  isEnabled: boolean
  createdAt: number
  updatedAt: number
}

interface PromptRow {
  id: string
  title: string
  content: string
  is_enabled: number
  created_at: number
  updated_at: number
}

const fromRow = (r: PromptRow): PromptRecord => ({
  id: r.id,
  title: r.title,
  content: r.content,
  isEnabled: r.is_enabled === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

const genId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function listPrompts(): Promise<PromptRecord[]> {
  const rows = await select<PromptRow>(
    'SELECT id, title, content, is_enabled, created_at, updated_at FROM prompts ORDER BY updated_at DESC'
  )
  return rows.map(fromRow)
}

export async function createPrompt(input: {
  title: string
  content: string
}): Promise<PromptRecord> {
  const now = Date.now()
  const id = genId()
  await execute(
    'INSERT INTO prompts (id, title, content, is_enabled, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    [id, input.title, input.content, now, now]
  )
  return {
    id,
    title: input.title,
    content: input.content,
    isEnabled: false,
    createdAt: now,
    updatedAt: now
  }
}

export async function updatePrompt(input: {
  id: string
  title: string
  content: string
}): Promise<void> {
  await execute(
    'UPDATE prompts SET title = ?, content = ?, updated_at = ? WHERE id = ?',
    [input.title, input.content, Date.now(), input.id]
  )
}

export async function togglePromptEnable(input: {
  id: string
  isEnabled: boolean
}): Promise<void> {
  await execute(
    'UPDATE prompts SET is_enabled = ?, updated_at = ? WHERE id = ?',
    [input.isEnabled ? 1 : 0, Date.now(), input.id]
  )
}

export async function deletePrompt(id: string): Promise<void> {
  await execute('DELETE FROM prompts WHERE id = ?', [id])
}
