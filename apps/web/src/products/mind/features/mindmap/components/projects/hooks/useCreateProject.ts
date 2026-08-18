/**
 * useCreateProject —— 桌面端本地版：
 *   - 新建 = 内存 pendingProjects.stash + 跳编辑器 (id `unsaved-*`)
 *   - 只有用户 Ctrl+S 时才走 saveDialog + writeBundle + registerProject
 *   - 未保存返回列表 → 不留任何记录
 */
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logger } from '@zoeymind/logger'
import { toast } from '@/shared/app-shared'
import { i18next } from '@zoeymind/i18n'
import type { MindMapNodeTree } from 'simple-mind-map'

import { parseXMindFile } from '@/products/mind/features/mindmap/utils/xmindParser'
import { parseZMXmindFile } from '@/products/mind/features/mindmap/utils/ZMXMindImporter'
import { parseMarkdownFile } from '@/products/mind/features/mindmap/utils/markdownParser'
import { pendingProjects } from '@/shared/native'

export type ImportFormat = 'xmind-standard' | 'xmind-zm' | 'markdown'

interface UseCreateProjectOptions {
  folderId?: string | null
  onCreated?: (id: string) => void
}

interface UseCreateProjectReturn {
  creating: boolean
  createBlank: () => Promise<void>
  createFromImport: (file: File, xmindFormat?: 'standard' | 'zm') => Promise<void>
}

function deriveTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '')
  return base.trim() || i18next.t('mindmap.editor.newProjectTitle') || '未命名'
}


export function useCreateProject(opts: UseCreateProjectOptions = {}): UseCreateProjectReturn {
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  const stashAndOpen = useCallback(
    (title: string, tree: MindMapNodeTree) => {
      const id = pendingProjects.stash({ title, tree })
      opts.onCreated?.(id)
      navigate(`/editor/${id}`)
    },
    [navigate, opts]
  )

  // 新建空白 -> /editor/new (VS Code 风格 draft 路由). draft 内 stash 由 EditorShellForDraft 挂载时创建.
  const createBlank = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      opts.onCreated?.('new')
      navigate('/editor/new')
    } catch (error) {
      logger.error('新建跳转失败', error)
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
          parsed =
            xmindFormat === 'zm' ? await parseZMXmindFile(file) : await parseXMindFile(file)
        } else {
          throw new Error('unsupported file type')
        }
        stashAndOpen(deriveTitleFromFilename(file.name), parsed)
      } catch (error) {
        logger.error('导入失败', error)
        toast.error(i18next.t('mindmap.editor.importFailed'))
      } finally {
        setCreating(false)
      }
    },
    [creating, stashAndOpen]
  )

  return { creating, createBlank, createFromImport }
}

// 旧 sessionStorage handoff 常量, 桌面端不用, 保留占位.
export const PENDING_IMPORT_STORAGE_PREFIX = 'mindmap:pending-import:'

export default useCreateProject
