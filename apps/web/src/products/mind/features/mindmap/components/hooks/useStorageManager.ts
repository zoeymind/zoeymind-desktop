/**
 * useStorageManager —— 桌面端 native 版：从 .zmind bundle 读取 / 写回。
 *
 * MindMapCanvas destructures `{ loadSavedData, saveData }`；桌面端 saveData
 * 由 useSaveFlow 里的 Ctrl+S / 菜单栏 Save 主动触发，这里的 saveData 保留
 * API 表面但只做 mindMap.getData() → registerBundleSource + markDirty 的同步，
 * 真正的 writeBundle 在 useSaveFlow.save() 里跑。
 *
 * 云版本里的 autosave + auto-snapshot 全部去掉（用户方案：手动保存 + 容灾快照）。
 */
import { useCallback, useEffect, useRef } from 'react'
import type { MindMapNodeTree } from 'simple-mind-map'
import { logger } from '@zoeymind/logger'
import { defaultData } from './useCanvasManager'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { getProject, readBundle, useSaveFlow } from '@/shared/native'

interface LoadedData {
  savedData: MindMapNodeTree | null
  savedViewData: unknown | null
}

interface UseStorageManagerResult {
  loadSavedData: () => Promise<LoadedData>
  saveData: () => Promise<void>
}

function countNodes(tree: MindMapNodeTree | null | undefined): number {
  if (!tree) return 0
  const children = Array.isArray(tree.children) ? tree.children : []
  let total = 1
  for (const child of children) total += countNodes(child)
  return total
}

export function useStorageManager(): UseStorageManagerResult {
  const { workspaceId } = useProjectContext()
  const { mindMap } = useMindMapStore()
  const flow = useSaveFlow(workspaceId ?? null)
  const nameRef = useRef<string>('')

  const loadSavedData = useCallback(async (): Promise<LoadedData> => {
    if (!workspaceId) {
      return { savedData: defaultData, savedViewData: null }
    }
    try {
      const row = await getProject(workspaceId)
      if (!row) {
        logger.warn(`项目 ${workspaceId} 不存在，使用默认数据`)
        return { savedData: defaultData, savedViewData: null }
      }
      if (!row.exists) {
        logger.warn(`项目 ${workspaceId} 磁盘文件缺失`)
        return { savedData: defaultData, savedViewData: null }
      }
      const bundle = await readBundle(row.path)
      nameRef.current = bundle.meta.name || row.name
      return { savedData: bundle.tree, savedViewData: bundle.view ?? null }
    } catch (error) {
      logger.error('读取 .zmind 失败', error)
      return { savedData: defaultData, savedViewData: null }
    }
  }, [workspaceId])

  // 每次画布改动同步 bundle source 到 save-flow；真正的写盘由 Ctrl+S 触发
  useEffect(() => {
    if (!mindMap) return
    const sync = () => {
      const tree = mindMap.getData() as MindMapNodeTree
      flow.registerBundleSource({
        tree,
        name: nameRef.current,
        nodeCount: countNodes(tree)
      })
    }
    sync()
    const onChange = () => {
      sync()
      flow.markDirty()
    }
    mindMap.on?.('data_change', onChange)
    return () => {
      mindMap.off?.('data_change', onChange)
    }
  }, [mindMap, flow])

  // 老 API 兼容：saveData() → 转发到 save-flow.save()
  const saveData = useCallback(async () => {
    await flow.save()
  }, [flow])

  return { loadSavedData, saveData }
}
