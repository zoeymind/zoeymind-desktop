/**
 * useCreateProject —— 桌面端本地版：新建 .zmind → 落磁盘 → 入索引 → 跳编辑器。
 */
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logger } from '@zoeymind/logger'
import { toast } from '@/shared/app-shared'
import { i18next } from '@zoeymind/i18n'
import type { MindMapNodeTree } from 'simple-mind-map'
import { defaultMindmapData } from '@zoeymind/shared'
import { exists, mkdir } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'

import { parseXMindFile } from '@/products/mind/features/mindmap/utils/xmindParser'
import { parseZMXmindFile } from '@/products/mind/features/mindmap/utils/ZMXMindImporter'
import { parseMarkdownFile } from '@/products/mind/features/mindmap/utils/markdownParser'
import {
  createUUID,
  defaultVaultDir,
  registerProject,
  writeBundle,
  type ZMindBundle
} from '@/shared/native'

export type ImportFormat = 'xmind-standard' | 'xmind-zm' | 'markdown'

interface UseCreateProjectOptions {
  onCreated?: (newId: string) => void
  folderId?: string | null
  workspaceId?: string | null
}

interface UseCreateProjectReturn {
  creating: boolean
  createBlank: () => Promise<void>
  createFromImport: (file: File, xmindFormat?: 'standard' | 'zm') => Promise<void>
}

function deriveTitleFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  return base.trim() || i18next.t('mindmap.editor.newCloudProject')
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled'
}

async function pickUniquePath(dir: string, baseName: string): Promise<string> {
  const first = await join(dir, `${baseName}.zmind`)
  if (!(await exists(first))) return first
  for (let i = 2; i < 1000; i++) {
    const candidate = await join(dir, `${baseName}-${i}.zmind`)
    if (!(await exists(candidate))) return candidate
  }
  throw new Error('cannot pick unique filename')
}

function countNodes(tree: MindMapNodeTree): number {
  const children = Array.isArray(tree.children) ? tree.children : []
  let total = 1
  for (const child of children) total += countNodes(child)
  return total
}

async function persistNewProject(
  title: string,
  tree: MindMapNodeTree,
  folderId: string | null
): Promise<string> {
  const dir = await defaultVaultDir()
  if (!(await exists(dir))) await mkdir(dir, { recursive: true })
  const targetPath = await pickUniquePath(dir, sanitizeFilename(title))
  const now = Date.now()
  const nodeCount = countNodes(tree)
  const bundle: ZMindBundle = {
    tree,
    meta: { name: title, tags: [], createdAt: now, updatedAt: now, nodeCount }
  }
  await writeBundle(targetPath, bundle)
  const id = createUUID()
  await registerProject({ id, path: targetPath, name: title, folderId, nodeCount })
  return id
}

export function useCreateProject(opts: UseCreateProjectOptions = {}): UseCreateProjectReturn {
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  const createBlank = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      const title = i18next.t('mindmap.editor.newProjectTitle')
      const id = await persistNewProject(title, defaultMindmapData, opts.folderId ?? null)
      opts.onCreated?.(id)
      navigate(`/editor/${id}`)
    } catch (error) {
      logger.error('创建空白项目失败', error)
      toast.error(i18next.t('mindmap.editor.createFailed'))
    } finally {
      setCreating(false)
    }
  }, [creating, navigate, opts])

  const createFromImport = useCallback(
    async (file: File, xmindFormat: 'standard' | 'zm' = 'standard') => {
      if (creating) return
      setCreating(true)
      try {
        const lower = file.name.toLowerCase()
        let parsed: MindMapNodeTree
        if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
          parsed = await parseMarkdownFile(file)
        } else if (lower.endsWith('.xmind')) {
          parsed = xmindFormat === 'zm' ? await parseZMXmindFile(file) : await parseXMindFile(file)
        } else {
          throw new Error('unsupported file type')
        }
        const title = deriveTitleFromFilename(file.name)
        const id = await persistNewProject(title, parsed, opts.folderId ?? null)
        opts.onCreated?.(id)
        navigate(`/editor/${id}`)
      } catch (error) {
        logger.error('导入失败', error)
        toast.error(i18next.t('mindmap.editor.importFailed'))
      } finally {
        setCreating(false)
      }
    },
    [creating, navigate, opts]
  )

  return { creating, createBlank, createFromImport }
}

// PENDING_IMPORT_STORAGE_PREFIX 原云版用于 sessionStorage handoff；桌面端不用了但
// 老代码里可能 import 这个常量，保留一个空串占位。
export const PENDING_IMPORT_STORAGE_PREFIX = 'mindmap:pending-import:'

export default useCreateProject
