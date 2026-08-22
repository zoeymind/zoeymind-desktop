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
import { toastLoading, dismissToast } from "@/shared/app-shared"
import { useTabs } from "@/shared/tabs/store"
import { bumpProjects, useProjectsEvents } from "./projects-events"
import { exists, mkdir } from "@tauri-apps/plugin-fs"
import { save as saveDialog } from "@tauri-apps/plugin-dialog"
import { join } from "@tauri-apps/api/path"
import { composePreviewWithLogo } from "./preview"
import { saveWithToast } from "./save-with-toast"
import { executeSaveTransaction, type SaveParticipant, type SavePhase } from "./save-transaction"

const RECOVERY_DEBOUNCE_MS = 5_000
const SAVE_TOAST_ID_PREFIX = "document-save"

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
  realProjectId: string | null
  revision: FileRevision | null
  sourceFingerprint: string
  timer: ReturnType<typeof setTimeout> | null
  createdAt: number
  renderer: PreviewRenderer | null
}

/**
 * Fingerprint 只跟树, 不跟 view: view (画布缩放/平移) 是纯表现层, 用户右键拖动
 * 就在变, 塞进 fingerprint 会让 SaveTransaction 的 isCurrent 判断在 writeBundle
 * 期间恒不成立 -> 抛 SaveSupersededError. dirty 判定同理只看树. view 仍会随
 * bundle 一起持久化, 但不参与脏态/supersede.
 */
function bundleSourceFingerprint(source: BundleSource): string {
  return JSON.stringify({ tree: source.tree })
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
  const [savePhase, setSavePhase] = useState<SavePhase>("idle")
  const sessionStore = useProjectSessionStore()

  const stateRef = useRef<SaveFlowState>({
    source: null,
    sourceFingerprint: "",
    path: null,
    realProjectId: null,
    revision: null,
    timer: null,
    createdAt: 0,
    renderer: null,
  })
  const saveParticipantsRef = useRef<Set<SaveParticipant>>(new Set())
  const registerSaveParticipant = useCallback((participant: SaveParticipant) => {
    saveParticipantsRef.current.add(participant)
    return () => {
      saveParticipantsRef.current.delete(participant)
    }
  }, [])
  const savePhaseRef = useRef<SavePhase>("idle")
  const transitionSavePhase = useCallback((phase: SavePhase) => {
    savePhaseRef.current = phase
    setSavePhase(phase)
  }, [])

  const runSaveTransaction = useCallback(
    async <T>(persist: (source: BundleSource) => Promise<T>, commit: boolean) => {
      if (savePhaseRef.current !== "idle" && savePhaseRef.current !== "failed") {
        throw new Error("保存正在进行")
      }
      const state = stateRef.current
      if (!state.source) return null
      const sourceFingerprint = state.sourceFingerprint
      return executeSaveTransaction({
        source: state.source,
        participants: [...saveParticipantsRef.current],
        persist,
        commit,
        isCurrent: () => stateRef.current.sourceFingerprint === sourceFingerprint,
        onCommit: () => setDirty(false),
        onPhase: transitionSavePhase,
      })
    },
    [setDirty, transitionSavePhase]
  )

  useEffect(() => {
    if (!projectId) return
    const toastId = `${SAVE_TOAST_ID_PREFIX}:${projectId}`
    const saving =
      savePhase === "preparing" || savePhase === "persisting" || savePhase === "committing"
    if (saving) toastLoading("保存中…", toastId)
    else dismissToast(toastId)
    return () => dismissToast(toastId)
  }, [projectId, savePhase])

  const recoveryStorageId = projectId ? pendingProjects.recoveryStorageId(projectId) : null

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

  /**
   * 允许调用方传入预计算 fingerprint. 编辑器上层已经 `JSON.stringify(tree)`
   * 做 baseline hash, 这里直接复用避免同一 data_change 事件里对整树 stringify 两次.
   */
  const registerBundleSource = useCallback((source: BundleSource, fingerprint?: string) => {
    stateRef.current.source = source
    stateRef.current.sourceFingerprint = fingerprint ?? bundleSourceFingerprint(source)
  }, [])

  const scheduleRecovery = useCallback(() => {
    if (!recoveryStorageId) return
    const state = stateRef.current
    clearTimeout(state.timer ?? undefined)
    state.timer = setTimeout(() => {
      state.timer = null
      if (!state.source) return
      // 5s 内保存成功已经 clearRecovery 了, 现在文档已 clean; 再落一次会造成
      // 下次启动误弹 "有未保存快照" 的幽灵恢复对话框.
      if (!sessionStore.getState().dirty) return
      const bundle = nowBundle(state.source, state.createdAt)
      enqueueRecoveryWrite(recoveryStorageId, () =>
        writeRecovery(recoveryStorageId, bundle, state.path)
      )
    }, RECOVERY_DEBOUNCE_MS)
  }, [recoveryStorageId, sessionStore])

  /** 取消挂起的 recovery timer 并等待队列中正在落盘的写完成. save 进入 persist 前必须调, 否则 clearRecovery 会被随后触发的 timer 覆盖. */
  const drainPendingRecovery = useCallback(async (): Promise<void> => {
    const state = stateRef.current
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    if (recoveryStorageId) await flushRecoveryWrites(recoveryStorageId)
  }, [recoveryStorageId])

  const flushRecovery = useCallback(async () => {
    if (!recoveryStorageId) return
    // 实时读 dirty, 别依赖 useCallback 的 isDirty 闭包: saveAllSessions 会
    // 在 await save() 后立刻调 commands.flushRecovery, 那时旧闭包的 isDirty
    // 还是 true, 会把刚保存 clean 的内容重新写进 recovery -> 幽灵恢复弹窗.
    if (!sessionStore.getState().dirty) return
    const state = stateRef.current
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    if (state.source) {
      const bundle = nowBundle(state.source, state.createdAt)
      enqueueRecoveryWrite(recoveryStorageId, () =>
        writeRecovery(recoveryStorageId, bundle, state.path)
      )
    }
    await flushRecoveryWrites(recoveryStorageId)
  }, [recoveryStorageId, sessionStore])

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

    await drainPendingRecovery()

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

      // 只拒绝会真正撞车的情况: 目标文件是另一个 Tab 正在编辑的项目.
      // 单纯"文件已存在"的场景由原生 Save Dialog 的 Replace 确认覆盖,
      // 再抛一次错反而让用户困惑 "刚才不是选了替换?".
      const collided = await findByPath(picked)
      const busyTab = collided
        ? useTabs
            .getState()
            .tabs.find(
              t => t.id !== projectId && (t.projectId === collided.id || t.id === collided.id)
            )
        : null
      if (busyTab) {
        throw new Error(`“${collided?.name ?? fileBasenameNoExt(picked)}” 已在另一个 Tab 中打开`)
      }

      // 恢复文档 (从 recovery snapshot 打开) 首保存若选中原路径 -> 用 originRevision
      // 做冲突门, 允许写回原文件. 之前一律 throw 让用户永远救不回原文件.
      const recovery = pendingProjects.read(projectId)?.recovery ?? null
      const isWritingBackToOrigin = recovery?.path != null && recovery.path === picked

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
      const realId = collided?.id ?? createUUID()
      const result = await runSaveTransaction(async prepared => {
        if (isWritingBackToOrigin && recovery?.revision) {
          try {
            await assertFileRevision(picked, recovery.revision)
          } catch (error) {
            if (error instanceof FileConflictError) setConflict(error)
            throw error
          }
        }
        const nextSource = { ...prepared, name: fileName, previewPng }
        await writeBundle(picked, nowBundle(nextSource, state.createdAt))
        if (collided) {
          await refreshProjectIndex(collided.id, {
            name: fileName,
            nodeCount: nextSource.nodeCount ?? 0,
          })
        } else {
          await registerProject({
            id: realId,
            path: picked,
            name: fileName,
            nodeCount: nextSource.nodeCount ?? 0,
          })
        }
        state.path = picked
        state.revision = await readFileRevision(picked)
        state.realProjectId = realId
        // clearRecovery 前再取消一次 timer: writeBundle 期间可能已 schedule 新 timer.
        if (state.timer) {
          clearTimeout(state.timer)
          state.timer = null
        }
        if (recoveryStorageId) await flushRecoveryWrites(recoveryStorageId)
        await Promise.all([
          rememberSaveDir(picked),
          clearRecovery(projectId),
          clearRecovery(realId),
          ...(recoveryStorageId && recoveryStorageId !== projectId
            ? [clearRecovery(recoveryStorageId)]
            : []),
        ])
      }, true)
      if (!result) return
      if (result.liveStateMatchesPersisted) state.source.name = fileName
      bumpProjects()
      useTabs.getState().promoteDraftInPlace(projectId, realId, fileName)
      pendingProjects.clear(projectId)
      setConflict(null)
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
    const path = state.path
    const fileName = fileBasenameNoExt(path)
    const effectiveId = state.realProjectId ?? projectId
    const result = await runSaveTransaction(async prepared => {
      try {
        await assertFileRevision(path, state.revision)
      } catch (error) {
        if (error instanceof FileConflictError) setConflict(error)
        throw error
      }
      const nextSource = { ...prepared, name: fileName, previewPng }
      await writeBundle(path, nowBundle(nextSource, state.createdAt))
      state.revision = await readFileRevision(path)
      await refreshProjectIndex(effectiveId, {
        name: fileName,
        nodeCount: nextSource.nodeCount ?? 0,
      })
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
      if (recoveryStorageId) await flushRecoveryWrites(recoveryStorageId)
      await Promise.all([
        clearRecovery(effectiveId),
        clearRecovery(projectId),
        ...(recoveryStorageId && recoveryStorageId !== projectId
          ? [clearRecovery(recoveryStorageId)]
          : []),
      ])
    }, true)
    if (!result) return
    if (result.liveStateMatchesPersisted) state.source.name = fileName
    bumpProjects()
    setConflict(null)
  }, [projectId, recoveryStorageId, runSaveTransaction, drainPendingRecovery])

  const saveAs = useCallback(
    async (newPath: string) => {
      if (!projectId) return
      const state = stateRef.current
      if (!state.source) return
      // 只拦另一个 Tab 正在编辑的目标; 单纯 "文件已存在" 交给原生对话框的 Replace.
      const collided = await findByPath(newPath)
      if (collided) {
        const busy = useTabs
          .getState()
          .tabs.find(
            t => t.id !== projectId && (t.projectId === collided.id || t.id === collided.id)
          )
        if (busy) {
          throw new Error(`“${collided.name}” 已在另一个 Tab 中打开`)
        }
      }

      const fileName = fileBasenameNoExt(newPath)
      const copyId = collided?.id ?? createUUID()
      await runSaveTransaction(async prepared => {
        await writeBundle(newPath, nowBundle({ ...prepared, name: fileName }, state.createdAt))
        if (collided) {
          await refreshProjectIndex(collided.id, {
            name: fileName,
            nodeCount: prepared.nodeCount ?? 0,
          })
        } else {
          await registerProject({
            id: copyId,
            path: newPath,
            name: fileName,
            nodeCount: prepared.nodeCount ?? 0,
          })
        }
      }, false)
      bumpProjects()
      useTabs.getState().openTab({ id: copyId, kind: "file", title: fileName, projectId: copyId })
    },
    [projectId, runSaveTransaction]
  )

  const overwrite = useCallback(async () => {
    if (!projectId) return
    const state = stateRef.current
    if (!state.path || !state.source) return
    await drainPendingRecovery()
    const path = state.path
    const fileName = fileBasenameNoExt(path)
    const effectiveId = state.realProjectId ?? projectId
    await runSaveTransaction(async prepared => {
      await writeBundle(path, nowBundle({ ...prepared, name: fileName }, state.createdAt))
      state.revision = await readFileRevision(path)
      await refreshProjectIndex(effectiveId, {
        name: fileName,
        nodeCount: prepared.nodeCount ?? 0,
      })
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
      if (recoveryStorageId) await flushRecoveryWrites(recoveryStorageId)
      // overwrite 之前漏了清 recovery. 保存成功后残留快照会在下次启动误弹恢复对话框.
      await Promise.all([
        clearRecovery(effectiveId),
        clearRecovery(projectId),
        ...(recoveryStorageId && recoveryStorageId !== projectId
          ? [clearRecovery(recoveryStorageId)]
          : []),
      ])
    }, true)
    setConflict(null)
    bumpProjects()
  }, [projectId, recoveryStorageId, runSaveTransaction, drainPendingRecovery])

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
    await Promise.all([
      clearRecovery(projectId),
      ...(recoveryStorageId && recoveryStorageId !== projectId
        ? [clearRecovery(recoveryStorageId)]
        : []),
    ])
    setDirty(false)
  }, [projectId, recoveryStorageId, setDirty])

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

  // Ctrl/Cmd+S 快捷键. 走 saveWithToast 统一反馈.
  // 每个 tab 的 SaveFlowProvider 都挂一次全局 keydown, 但只有 active tab 应答;
  // 否则开 N 个 tab 会触发 N 次 save + N 个 toast.
  useEffect(() => {
    if (!projectId) return
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.key.toLowerCase() !== "s") return
      if (useTabs.getState().activeId !== projectId) return
      e.preventDefault()
      void saveWithToast(save, projectId)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [projectId, save])

  return useMemo(
    () => ({
      isDirty,
      savePhase,
      markDirty,
      conflict,
      registerBundleSource,
      registerPreviewRenderer,
      registerSaveParticipant,
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
      savePhase,
      markDirty,
      conflict,
      registerBundleSource,
      registerPreviewRenderer,
      registerSaveParticipant,
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
