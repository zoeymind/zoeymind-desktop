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
  findByPath,
  registerProject,
  unregisterProject,
  preferredSaveDir,
  rememberSaveDir,
  pendingProjects,
  createUUID,
  type ZMindBundle,
  type ProjectRow,
} from './'
import { useTabs } from '@/shared/tabs/store'
import { bumpProjects } from './projects-events'
import { exists, mkdir } from '@tauri-apps/plugin-fs'
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { join } from '@tauri-apps/api/path'
import { composePreviewWithLogo } from './preview'

const RECOVERY_DEBOUNCE_MS = 5_000

export interface BundleSource {
  tree: MindMapNodeTree
  view?: unknown
  previewPng?: Uint8Array | null
  name: string
  tags?: string[]
  nodeCount?: number
}

export type PreviewRenderer = () => Promise<Uint8Array | null>
interface SaveFlowState {
  source: BundleSource | null
  path: string | null
  timer: ReturnType<typeof setTimeout> | null
  createdAt: number
  renderer: PreviewRenderer | null
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

  const stateRef = useRef<SaveFlowState>({
    source: null,
    path: null,
    timer: null,
    createdAt: Date.now(),
    renderer: null
  })

  // 首次挂载：解析 path
  useEffect(() => {
    let mounted = true
    if (!projectId || pendingProjects.isPending(projectId)) return
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

  const registerPreviewRenderer = useCallback((renderer: PreviewRenderer | null) => {
    stateRef.current.renderer = renderer
  }, [])

  const save = useCallback(async () => {
    if (!projectId) return
    const state = stateRef.current
    if (!state.source) return

    // draft (unsaved-*): 先弹 saveDialog, 检查目标是否已被别的 tab 占用, 通过后写盘 + 入库
    if (pendingProjects.isPending(projectId)) {
      const dir = await preferredSaveDir()
      if (!(await exists(dir))) await mkdir(dir, { recursive: true })
      const safeName = (state.source.name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_')
      const defaultPath = await join(dir, `${safeName}.zmind`)
      const picked = await saveDialog({
        defaultPath,
        filters: [{ name: 'ZoeyMind', extensions: ['zmind'] }]
      })
      if (!picked) return

      // 碰撞检查: 目标路径已被登记 -> 若还被别的 tab 打开, 拒绝
      const collided = await findByPath(picked)
      if (collided) {
        const busy = useTabs.getState().tabs.find(
          t => t.id !== projectId && (t.projectId === collided.id || t.id === collided.id)
        )
        if (busy) {
          const { toast } = await import('@/shared/app-shared')
          toast.error(
            `“${collided.name}” 已在另一个 tab 中打开, 请先关闭再保存到该路径`
          )
          return
        }
      }

      // preview
      let previewPng: Uint8Array | null = state.source.previewPng ?? null
      if (state.renderer) {
        try {
          const raw = await state.renderer()
          if (raw) previewPng = await composePreviewWithLogo(raw)
        } catch {
          previewPng = state.source.previewPng ?? null
        }
      }

      const bundle = nowBundle({ ...state.source, previewPng }, state.createdAt)
      await writeBundle(picked, bundle)

      let realId: string
      if (collided) {
        realId = collided.id
        await refreshProjectIndex(realId, {
          name: state.source.name,
          nodeCount: state.source.nodeCount ?? 0
        })
      } else {
        realId = createUUID()
        await registerProject({
          id: realId,
          path: picked,
          name: state.source.name,
          nodeCount: state.source.nodeCount ?? 0
        })
      }

      // pending stash 保留 (仍以 draft id 作为 workspaceId 供 useCanvasManager 使用),
      // state.path 记录真实路径, 之后再次 save 就走 "已入库" 分支.
      state.path = picked
      await rememberSaveDir(picked)
      setDirty(false)
      bumpProjects()

      // 就地升级 tab: id 保持不变 -> EditorPane React key 稳定 -> 不 remount
      useTabs.getState().promoteDraftInPlace(projectId, realId, state.source.name)
      return
    }

    // 已入库：正常写回原路径
    if (!state.path) return
    let previewPng: Uint8Array | null = state.source.previewPng ?? null
    if (state.renderer) {
      try {
        const raw = await state.renderer()
        if (raw) previewPng = await composePreviewWithLogo(raw)
      } catch {
        previewPng = state.source.previewPng ?? null
      }
    }
    const bundle = nowBundle({ ...state.source, previewPng }, state.createdAt)
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
    bumpProjects()
  }, [projectId, setDirty])

  const saveAs = useCallback(
    async (newPath: string, opts?: { onCollide?: (row: ProjectRow) => Promise<boolean> }) => {
      if (!projectId) return
      const state = stateRef.current
      if (!state.source) return

      // 若目标路径已被另一条记录占用，问调用方（UI 侧）弹框确认覆盖
      const collide = await findByPath(newPath)
      if (collide && collide.id !== projectId) {
        const ok = opts?.onCollide ? await opts.onCollide(collide) : true
        if (!ok) return
        await unregisterProject(collide.id)
      }

      const bundle = nowBundle(state.source, state.createdAt)
      await writeBundle(newPath, bundle)
      state.path = newPath

      // 若本项目已经登记，仅回写元数据；否则新登记一条
      const own = await getProject(projectId)
      if (own) {
        await refreshProjectIndex(projectId, {
          name: state.source.name,
          nodeCount: state.source.nodeCount ?? 0
        })
      } else {
        await registerProject({
          id: projectId,
          path: newPath,
          name: state.source.name,
          nodeCount: state.source.nodeCount ?? 0
        })
      }
      await clearRecovery(projectId)
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
      registerPreviewRenderer,
      save,
      saveAs,
      discardAndClose
    }),
    [
      isDirty,
      markDirty,
      registerBundleSource,
      registerPreviewRenderer,
      save,
      saveAs,
      discardAndClose
    ]
  )
}
