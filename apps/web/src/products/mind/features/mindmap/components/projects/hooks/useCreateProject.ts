/**
 * useCreateProject —— 桌面端本地版：新建 .zmind → 落磁盘 → 入索引 → 跳转编辑器。
 *
 * 与产品仓的云端版对齐 return 表面（creating / createBlank / createFromImport），
 * 但不再走 tRPC / sessionStorage handoff：新建时直接 pack 一个空白 bundle 写到
 * `<vaultDir>/<title>.zmind`，同时 register 到 SqlProjectRepo，然后 navigate 到
 * `/editor/:id`。
 *
 * 文件导入的解析器（xmind / markdown / zmxmind）复用产品仓的，只把落盘方式换成本地。
 *
 * 同名冲突：save-as 覆盖逻辑放在 editor 侧的手动 Save 流程里；本 hook 的新建走
 * "标题即文件名"的默认名，冲突时追加 `-2`/`-3`/... 直到不冲突。
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
}

interface UseCreateProjectReturn {
  creating: boolean
  createBlank: () => Promise<void>
  createFromImport: (file: File, xmindFormat?: 'standard' | 'zm') => Promise<void>
}

function deriveTitleFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  return base.trim() || i18next.t('mindmap.editor.newProjectTitle')
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

export default useCreateProject
