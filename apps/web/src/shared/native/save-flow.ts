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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  useProjectMindMapStore as useMindMapStore,
  useProjectSessionStore,
} from "@/products/mind/editor-session"
import type { MindMapNodeTree } from "simple-mind-map"
import {
  writeBundle,
  writeRecovery,
  assertFileRevision,
  readFileRevision,
  enqueueRecoveryWrite,
  flushRecoveryWrites,
  FileConflictError,
  type FileRevision,
  clearRecovery,
  refreshProjectIndex,
  getProject,
  findByPath,
  registerProject,
  preferredSaveDir,
  rememberSaveDir,
  pendingProjects,
  createUUID,
  type ZMindBundle,
} from "./"
import { useTabs } from "@/shared/tabs/store"
import { bumpProjects, useProjectsEvents } from "./projects-events"
import { exists, mkdir } from "@tauri-apps/plugin-fs"
import { save as saveDialog } from "@tauri-apps/plugin-dialog"
import { join } from "@tauri-apps/api/path"
import { composePreviewWithLogo } from "./preview"

const RECOVERY_DEBOUNCE_MS = 5_000

/** '/a/b/foo.zmind' -> 'foo' | '' -> 'Untitled' */
function fileBasenameNoExt(path: string): string {
  if (!path) return "Untitled"
  const last = path.split(/[\\/]/).pop() ?? ""
  return last.replace(/\.zmind$/i, "") || "Untitled"
}

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
  /** draft 保存成功后写入的真实 project id; 之后 refresh/clearRecovery 都用它 */
  revision: FileRevision | null
  realProjectId: string | null
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
      createdAt: createdAt || Date.now(),
      updatedAt: Date.now(),
      nodeCount: source.nodeCount ?? 0,
    },
  }
}

export function useSaveFlow(projectId: string | null) {
  const setDirty = useMindMapStore(s => s.setDirty)
  const isDirty = useMindMapStore(s => s.isDirty)
  const [conflict, setConflict] = useState<FileConflictError | null>(null)
  const sessionStore = useProjectSessionStore()

  const stateRef = useRef<SaveFlowState>({
    source: null,
    path: null,
    realProjectId: null,
    revision: null,
    timer: null,
    createdAt: 0,
    renderer: null,
  })

  // 首次挂载：解析 path
  useEffect(() => {
    let mounted = true
    if (!projectId || pendingProjects.isPending(projectId)) return
    void (async () => {
      const row = await getProject(projectId)
      if (!mounted || !row) return
      stateRef.current.path = row.path
      stateRef.current.revision = await readFileRevision(row.path)
      stateRef.current.createdAt = row.createdAt
    })()
    return () => {
      mounted = false
    }
  }, [projectId])

  // 卡片重命名会移动磁盘文件；同步已挂载编辑器持有的写入路径，避免下次保存写回旧地址。
  useEffect(() => {
    return useProjectsEvents.subscribe(events => {
      const changed = events.pathChanged
      if (!changed) return
      const state = stateRef.current
      if (changed.id !== projectId && changed.id !== state.realProjectId) return
      state.path = changed.path
      void readFileRevision(changed.path).then(revision => {
        if (stateRef.current.path === changed.path) stateRef.current.revision = revision
      })
      if (state.source) state.source.name = changed.name
      useTabs.getState().renameTab(projectId ?? changed.id, changed.name)
    })
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
      enqueueRecoveryWrite(projectId, () => writeRecovery(projectId, bundle, state.path))
    }, RECOVERY_DEBOUNCE_MS)
  }, [projectId])

  const flushRecovery = useCallback(async () => {
    if (!projectId || !isDirty) return
    const state = stateRef.current
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    if (state.source) {
      const bundle = nowBundle(state.source, state.createdAt)
      enqueueRecoveryWrite(projectId, () => writeRecovery(projectId, bundle, state.path))
    }
    await flushRecoveryWrites(projectId)
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

    if (pendingProjects.isPending(projectId) && !state.path) {
      const dir = await preferredSaveDir()
      if (!(await exists(dir))) await mkdir(dir, { recursive: true })
      const safeName = (state.source.name || "Untitled").replace(/[\\/:*?"<>|]/g, "_")
      const defaultPath = await join(dir, `${safeName}.zmind`)
      const picked = await saveDialog({
        defaultPath,
        filters: [{ name: "ZoeyMind", extensions: ["zmind"] }],
      })
      if (!picked) throw new Error("保存已取消")

      const collided = await findByPath(picked)
      if (await exists(picked)) {
        const busy = collided
          ? useTabs
              .getState()
              .tabs.find(
                t => t.id !== projectId && (t.projectId === collided.id || t.id === collided.id)
              )
          : null
        throw new Error(
          busy
            ? `“${collided?.name ?? fileBasenameNoExt(picked)}” 已在另一个 Tab 中打开`
            : `目标文件已存在：${picked}`
        )
      }

      let previewPng: Uint8Array | null = state.source.previewPng ?? null
      if (state.renderer) {
        try {
          const raw = await state.renderer()
          if (raw) previewPng = await composePreviewWithLogo(raw)
        } catch {
          previewPng = state.source.previewPng ?? null
        }
      }
      const fileName = fileBasenameNoExt(picked)
      const nextSource = { ...state.source, name: fileName, previewPng }
      await writeBundle(picked, nowBundle(nextSource, state.createdAt))

      const realId = createUUID()
      await registerProject({
        id: realId,
        path: picked,
        name: fileName,
        nodeCount: nextSource.nodeCount ?? 0,
      })
      state.path = picked
      state.revision = await readFileRevision(picked)
      state.realProjectId = realId
      state.source.name = fileName
      await Promise.all([rememberSaveDir(picked), clearRecovery(projectId), clearRecovery(realId)])
      setDirty(false)
      bumpProjects()
      useTabs.getState().promoteDraftInPlace(projectId, realId, fileName)
      pendingProjects.clear(projectId)
      return
    }

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
    const fileName = fileBasenameNoExt(state.path)
    state.source.name = fileName
    const bundle = nowBundle({ ...state.source, previewPng }, state.createdAt)
    try {
      await assertFileRevision(state.path, state.revision)
    } catch (error) {
      if (error instanceof FileConflictError) setConflict(error)
      throw error
    }
    await writeBundle(state.path, bundle)
    state.revision = await readFileRevision(state.path)
    const effectiveId = state.realProjectId ?? projectId
    await refreshProjectIndex(effectiveId, {
      name: fileName,
      nodeCount: state.source.nodeCount ?? 0,
    })
    await Promise.all([clearRecovery(effectiveId), clearRecovery(projectId)])
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    setDirty(false)
    bumpProjects()
    setConflict(null)
  }, [projectId, setDirty])

  const saveAs = useCallback(
    async (newPath: string) => {
      if (!projectId) return
      const state = stateRef.current
      if (!state.source) return
      if ((await findByPath(newPath)) || (await exists(newPath))) {
        throw new Error(`目标文件已存在：${newPath}`)
      }

      const fileName = fileBasenameNoExt(newPath)
      const bundle = nowBundle({ ...state.source, name: fileName }, state.createdAt)
      await writeBundle(newPath, bundle)
      const copyId = createUUID()
      await registerProject({
        id: copyId,
        path: newPath,
        name: fileName,
        nodeCount: state.source.nodeCount ?? 0,
      })
      bumpProjects()
      useTabs.getState().openTab({ id: copyId, kind: "file", title: fileName, projectId: copyId })
    },
    [projectId]
  )

  const overwrite = useCallback(async () => {
    if (!projectId) return
    const state = stateRef.current
    if (!state.path || !state.source) return
    const fileName = fileBasenameNoExt(state.path)
    await writeBundle(state.path, nowBundle({ ...state.source, name: fileName }, state.createdAt))
    state.revision = await readFileRevision(state.path)
    await refreshProjectIndex(state.realProjectId ?? projectId, {
      name: fileName,
      nodeCount: state.source.nodeCount ?? 0,
    })
    setConflict(null)
    setDirty(false)
    bumpProjects()
  }, [projectId, setDirty])

  const reloadFromDisk = useCallback(async () => {
    const state = stateRef.current
    if (!state.path) return
    state.revision = await readFileRevision(state.path)
    setConflict(null)
    setDirty(false)
  }, [setDirty])

  const saveCopy = useCallback(async () => {
    const picked = await saveDialog({ filters: [{ name: "ZoeyMind", extensions: ["zmind"] }] })
    if (!picked) throw new Error("保存副本已取消")
    await saveAs(picked)
  }, [saveAs])

  const discardAndClose = useCallback(async () => {
    if (!projectId) return
    await clearRecovery(projectId)
    setDirty(false)
  }, [projectId, setDirty])

  // window 生命周期 hook：blur / beforeunload 立刻 flush recovery
  useEffect(() => {
    if (!projectId) return
    const onBlur = () => {
      void flushRecovery()
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!sessionStore.getState().dirty) return
      void flushRecovery()
      // 触发浏览器 "unsaved changes" 提示
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("blur", onBlur)
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [projectId, flushRecovery, sessionStore])

  // Ctrl/Cmd+S 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [save])

  return useMemo(
    () => ({
      isDirty,
      markDirty,
      conflict,
      registerBundleSource,
      registerPreviewRenderer,
      save,
      saveAs,
      flushRecovery,
      discardAndClose,
      overwrite,
      reloadFromDisk,
      saveCopy,
    }),
    [
      isDirty,
      markDirty,
      conflict,
      registerBundleSource,
      registerPreviewRenderer,
      save,
      saveAs,
      flushRecovery,
      discardAndClose,
      overwrite,
      reloadFromDisk,
      saveCopy,
    ]
  )
}
