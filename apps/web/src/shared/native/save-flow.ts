/**
 * 保存 / 容灾一体化流程 —— 桌面端保存框架的胶水层。
 *
 * 面向 editor：
 *
 *   const flow = useSaveFlow(projectId)
 *   flow.markDirty()                          // 每次画布 change 调
 *   flow.save()                               // Ctrl+S / 菜单调用
 *   flow.saveAs(newPath)                      // 另存为
 *   flow.discardAndClose()                    // 关闭且丢弃脏态
 *   flow.registerBundleSource({ tree, view }) // 编辑器把当前状态提供给保存/recovery
 *
 * 语义：
 *   - `markDirty` → isDirty=true → debounce(5s) 写 recovery
 *   - `save` / `saveAs` 成功 → 写 .zmind + refreshProjectIndex + clearRecovery + isDirty=false
 *   - window blur / beforeunload → 立即 flush recovery（若 dirty）
 *   - 用户强制关闭 = 有 recovery 兜底，下次启动扫 recovery/ 提示恢复
 *
 * 该 hook 只做协调；bundle 数据源由编辑器通过 `registerBundleSource` 注入。
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import type { MindMapNodeTree } from 'simple-mind-map'
import {
  writeBundle,
  writeRecovery,
  clearRecovery,
  refreshProjectIndex,
  getProject,
  type ZMindBundle
} from './'

const RECOVERY_DEBOUNCE_MS = 5_000

export interface BundleSource {
  tree: MindMapNodeTree
  view?: unknown
  previewPng?: Uint8Array | null
  name: string
  tags?: string[]
  nodeCount?: number
}

interface SaveFlowState {
  source: BundleSource | null
  path: string | null
  timer: number | null
  createdAt: number
}

function nowBundle(source: BundleSource, createdAt: number): ZMindBundle {
  return {
    tree: source.tree,
    view: source.view,
    previewPng: source.previewPng ?? null,
    meta: {
      name: source.name,
      tags: source.tags ?? [],
      createdAt,
      updatedAt: Date.now(),
      nodeCount: source.nodeCount ?? 0
    }
  }
}

export function useSaveFlow(projectId: string | null) {
  const setDirty = useMindMapStore(s => s.setDirty)
  const isDirty = useMindMapStore(s => s.isDirty)

  const stateRef = useRef<SaveFlowState>({ source: null, path: null, timer: null, createdAt: Date.now() })

  // 首次挂载：解析 path
  useEffect(() => {
    let mounted = true
    if (!projectId) return
    void (async () => {
      const row = await getProject(projectId)
      if (!mounted || !row) return
      stateRef.current.path = row.path
      stateRef.current.createdAt = row.createdAt
    })()
    return () => {
      mounted = false
    }
  }, [projectId])

  const registerBundleSource = useCallback((source: BundleSource) => {
    stateRef.current.source = source
  }, [])

  const scheduleRecovery = useCallback(() => {
    if (!projectId) return
    const state = stateRef.current
    clearTimeout(state.timer ?? undefined)
    state.timer = setTimeout(() => {
      if (!state.source) return
      const bundle = nowBundle(state.source, state.createdAt)
      void writeRecovery(projectId, bundle, state.path)
    }, RECOVERY_DEBOUNCE_MS)
  }, [projectId])

  const flushRecovery = useCallback(() => {
    if (!projectId || !isDirty) return
    const state = stateRef.current
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    if (!state.source) return
    const bundle = nowBundle(state.source, state.createdAt)
    void writeRecovery(projectId, bundle, state.path)
  }, [projectId, isDirty])

  const markDirty = useCallback(() => {
    setDirty(true)
    scheduleRecovery()
  }, [scheduleRecovery, setDirty])

  const save = useCallback(async () => {
    if (!projectId) return
    const state = stateRef.current
    if (!state.source || !state.path) return
    const bundle = nowBundle(state.source, state.createdAt)
    await writeBundle(state.path, bundle)
    await refreshProjectIndex(projectId, {
      name: state.source.name,
      nodeCount: state.source.nodeCount ?? 0
    })
    await clearRecovery(projectId)
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    setDirty(false)
  }, [projectId, setDirty])

  const saveAs = useCallback(
    async (newPath: string) => {
      if (!projectId) return
      const state = stateRef.current
      if (!state.source) return
      const bundle = nowBundle(state.source, state.createdAt)
      await writeBundle(newPath, bundle)
      state.path = newPath
      // 注意：调用方需要负责索引层的 UPSERT（同 path 覆盖 vs 新路径新建）
      setDirty(false)
    },
    [projectId, setDirty]
  )

  const discardAndClose = useCallback(async () => {
    if (!projectId) return
    await clearRecovery(projectId)
    setDirty(false)
  }, [projectId, setDirty])

  // window 生命周期 hook：blur / beforeunload 立刻 flush recovery
  useEffect(() => {
    if (!projectId) return
    const onBlur = () => flushRecovery()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!useMindMapStore.getState().isDirty) return
      flushRecovery()
      // 触发浏览器 "unsaved changes" 提示
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [projectId, flushRecovery])

  // Ctrl/Cmd+S 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  return useMemo(
    () => ({
      isDirty,
      markDirty,
      registerBundleSource,
      save,
      saveAs,
      discardAndClose
    }),
    [isDirty, markDirty, registerBundleSource, save, saveAs, discardAndClose]
  )
}
