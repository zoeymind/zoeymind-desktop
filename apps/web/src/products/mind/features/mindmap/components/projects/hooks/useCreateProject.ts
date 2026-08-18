/**
 * 创建云端项目的通用 hook（两种入口：空白 + 文件导入）。
 *
 * 设计目标
 * --------
 * - 把"创建项目"和"加载已有项目"两个阶段彻底分离：
 *   创建阶段在列表层完成（`creating` state 弹独立 Dialog），
 *   只有拿到真实 id 才跳转编辑器并让编辑器走自己的"加载"流程。
 *
 * - 文件导入复用：先解析 → mindmap.create → 把解析结果放进 sessionStorage
 *   （key = {@link PENDING_IMPORT_STORAGE_PREFIX} + newId），编辑器挂载后由
 *   `useCanvasData` 检测并通过 `mindMap.updateData(data)` 注入到画布。
 *
 * - 错误处理走 vanilla 合约：mutation 是 `trpcClient.xxx.mutate` 不经过
 *   react-query mutationCache，由本 hook 自己 catch + toast。
 */
import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { logger } from '@zoeymind/logger'
import { trpcClient, toast, useOrganization } from '@/shared/app-shared'
import { i18next } from '@zoeymind/i18n'
import type { MindMapNodeTree } from 'simple-mind-map'

import { parseXMindFile } from '@/products/mind/features/mindmap/utils/xmindParser'
import { parseZMXmindFile } from '@/products/mind/features/mindmap/utils/ZMXMindImporter'
import { parseMarkdownFile } from '@/products/mind/features/mindmap/utils/markdownParser'

/** sessionStorage 中"待导入数据"的 key 前缀 — 编辑器侧读完即清。 */
export const PENDING_IMPORT_STORAGE_PREFIX = 'mindmap:pending-import:'

/** UI 支持的导入文件类型。MVP：xmind（标准）/ md。后续可加 zmxmind。 */
export type ImportFormat = 'xmind-standard' | 'xmind-zm' | 'markdown'

interface UseCreateProjectOptions {
  /** 创建成功（或导入成功）后的副作用，例如刷新列表 / 计数。 */
  onCreated?: (newId: string) => void
  /** 当前项目空间 ID; 传了则新 mindmap 挂在这个 workspace 下 */
  workspaceId?: string | null
}

interface UseCreateProjectReturn {
  /** 是否有创建（含导入）正在进行中 —— 用于上层弹 Dialog 或禁用入口。 */
  creating: boolean
  /** 创建一个空白项目。 */
  createBlank: () => Promise<void>
  /**
   * 从文件创建项目。文件类型根据扩展名识别（.xmind/.md）。
   * `xmindFormat` 仅在 .xmind 时生效，默认 standard。
   */
  createFromImport: (file: File, xmindFormat?: 'standard' | 'zm') => Promise<void>
}

/** 从完整文件名（含扩展名）截取项目标题。 */
function deriveTitleFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  return base.trim() || i18next.t('mindmap.editor.newCloudProject')
}

/** 把 parsed 数据塞进 sessionStorage，由编辑器在挂载后自行消费。 */
function stashPendingImport(newId: string, data: MindMapNodeTree): void {
  try {
    sessionStorage.setItem(`${PENDING_IMPORT_STORAGE_PREFIX}${newId}`, JSON.stringify(data))
  } catch (error) {
    // sessionStorage 写失败（quota / privacy 模式）— 至少不要让创建跟着崩。
    logger.error('暂存待导入数据到 sessionStorage 失败:', error)
  }
}

/** 按扩展名/格式解析文件为 `MindMapNodeTree`。 */
async function parseImportFile(
  file: File,
  xmindFormat: 'standard' | 'zm'
): Promise<MindMapNodeTree | null> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xmind')) {
    if (xmindFormat === 'zm') {
      return parseZMXmindFile(file)
    }
    return (await parseXMindFile(file)) as MindMapNodeTree | null
  }
  if (name.endsWith('.md')) {
    return (await parseMarkdownFile(file)) as MindMapNodeTree | null
  }
  return null
}

export function useCreateProject({
  onCreated,
  workspaceId
}: UseCreateProjectOptions = {}): UseCreateProjectReturn {
  const { currentOrg } = useOrganization()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  /** 公共后段：拿到 newId 后回调列表 + 跳编辑器。 */
  const navigateToEditor = useCallback(
    (newId: string) => {
      if (!currentOrg) return
      onCreated?.(newId)
      navigate({
        to: '/org/$orgId/zoeymind/editor/$id',
        params: { orgId: currentOrg.id, id: newId }
      })
    },
    [currentOrg, navigate, onCreated]
  )

  const createBlank = useCallback(async () => {
    if (!currentOrg || creating) return
    setCreating(true)
    try {
      // workspaceId 未选 (view=mine 或未挑 workspace) → null-project 建"我的图"
      const created = await trpcClient.mindmap.create.mutate({
        title: i18next.t('mindmap.editor.newCloudProject'),
        description: '',
        tags: [],
        organizationId: currentOrg.id,
        workspaceId: workspaceId ?? null
      })
      navigateToEditor(created.mindmap.id as string)
    } catch (error) {
      logger.error('创建云项目失败:', error)
      toast({
        variant: 'destructive',
        description:
          error instanceof Error
            ? error.message
            : i18next.t('projects.actions.createFailedFallback')
      })
    } finally {
      setCreating(false)
    }
  }, [creating, currentOrg, navigateToEditor, workspaceId])

  const createFromImport = useCallback(
    async (file: File, xmindFormat: 'standard' | 'zm' = 'standard') => {
      if (!currentOrg || creating) return
      setCreating(true)
      try {
        const parsed = await parseImportFile(file, xmindFormat)
        if (!parsed) {
          toast({
            variant: 'destructive',
            description: i18next.t('projects.import.parseFailed', { name: file.name })
          })
          return
        }
        const title = deriveTitleFromFilename(file.name)
        const created = await trpcClient.mindmap.create.mutate({
          title,
          description: '',
          tags: [],
          organizationId: currentOrg.id,
          workspaceId: workspaceId ?? null
        })
        const newId = created.mindmap.id as string
        stashPendingImport(newId, parsed)
        toast({
          variant: 'success',
          description: i18next.t('projects.import.success', { name: title })
        })
        navigateToEditor(newId)
      } catch (error) {
        logger.error('导入并创建云项目失败:', error)
        toast({
          variant: 'destructive',
          description:
            error instanceof Error ? error.message : i18next.t('projects.import.failedFallback')
        })
      } finally {
        setCreating(false)
      }
    },
    [creating, currentOrg, navigateToEditor, workspaceId]
  )

  return { creating, createBlank, createFromImport }
}
