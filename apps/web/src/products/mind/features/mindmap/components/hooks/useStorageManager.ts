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
import { getProject, readBundle, pendingProjects, useOptionalSaveFlow } from '@/shared/native'

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
  const flow = useOptionalSaveFlow(workspaceId ?? null)
  const nameRef = useRef<string>('')

  const loadSavedData = useCallback(async (): Promise<LoadedData> => {
    if (!workspaceId) {
      return { savedData: defaultData, savedViewData: null }
    }
    // 未保存的新建项目 —— bundle 只在内存里，getProject 拿不到
    if (pendingProjects.isPending(workspaceId)) {
      const pending = pendingProjects.read(workspaceId)
      if (!pending) {
        return { savedData: defaultData, savedViewData: null }
      }
      nameRef.current = pending.title
      return { savedData: pending.tree, savedViewData: null }
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

  /**
   * 挂 data_change 前拿一次 baseline hash: mindmap 首帧 setData 之后
   * 也会触发 data_change (引擎内部的初始化事件), 这些不是用户编辑, 不应
   * markDirty. 用 tree JSON hash 做门槛: 只有真的变了才 markDirty.
   */
  const lastCleanHashRef = useRef<string>('')

  useEffect(() => {
    if (!mindMap) return

    const treeHash = (t: MindMapNodeTree): string => {
      try {
        return JSON.stringify(t)
      } catch {
        return `${Date.now()}`
      }
    }

    const sync = () => {
      const tree = mindMap.getData() as MindMapNodeTree
      flow.registerBundleSource({
        tree,
        name: nameRef.current,
        nodeCount: countNodes(tree)
      })
      return tree
    }

    // 初次挂载: 记 baseline (代表当前是干净态), 之后再判 dirty.
    const initTree = sync()
    lastCleanHashRef.current = treeHash(initTree)

    const onChange = () => {
      const tree = sync()
      const nextHash = treeHash(tree)
      if (nextHash === lastCleanHashRef.current) return
      flow.markDirty()
    }
    mindMap.on?.('data_change', onChange)

    // 保存 (isDirty: true -> false) 完成后, 把当前 tree 记成新的 baseline.
    let prevDirty = useMindMapStore.getState().isDirty
    const unsubDirty = useMindMapStore.subscribe(state => {
      const nextDirty = state.isDirty
      if (prevDirty === true && nextDirty === false) {
        const tree = mindMap.getData() as MindMapNodeTree
        lastCleanHashRef.current = treeHash(tree)
      }
      prevDirty = nextDirty
    })

    return () => {
      mindMap.off?.('data_change', onChange)
      unsubDirty()
    }
  }, [mindMap, flow])


  /**
   * 注册预览图渲染器 —— save-flow 在写盘时按需调用, 得到 canvas.toDataURL png,
   * 转 Uint8Array 交给 writeBundle 塞到 .zmind bundle 里.
   */
  useEffect(() => {
    if (!mindMap) return
    const renderer = async (): Promise<Uint8Array | null> => {
      try {
        const doExport = (mindMap as unknown as { doExport?: { png: (name: string, transparent?: boolean) => Promise<string> } }).doExport
        if (!doExport?.png) return null
        const dataUrl = await doExport.png('preview', true)
        if (typeof dataUrl !== 'string') return null
        const base64 = dataUrl.split(',')[1]
        if (!base64) return null
        const bin = atob(base64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return bytes
      } catch (error) {
        logger.warn('生成预览 PNG 失败', error)
        return null
      }
    }
    flow.registerPreviewRenderer(renderer)
    return () => flow.registerPreviewRenderer(null)
  }, [mindMap, flow])
  // 老 API 兼容：saveData() → 转发到 save-flow.save()
  const saveData = useCallback(async () => {
    await flow.save()
  }, [flow])

  return { loadSavedData, saveData }
}
