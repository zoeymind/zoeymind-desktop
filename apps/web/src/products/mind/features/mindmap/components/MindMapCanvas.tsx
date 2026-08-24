import { useCallback, useRef, useMemo, useEffect, useState } from "react"
import { MindMapDropdown } from "./MindMapDropdown.tsx"
import { AIChatToggle, FormatPanel, type FormatPanelRef } from "./FormatPanel/FormatPanel.tsx"
import { TopBar } from "./TopBar/TopBar.tsx"
import { StatusBar } from "./StatusBar/StatusBar"
import { useEventManager } from "./hooks/useEventManager.ts"
import { useNodeLimitGuard } from "./hooks/useNodeLimitGuard.ts"
import { useStorageManager } from "./hooks/useStorageManager.ts"
import { useShortcutManager } from "./hooks/useShortcutManager.ts"
import { useViewManager } from "./hooks/useViewManager.ts"
import { useCanvasManager, defaultData } from "./hooks/useCanvasManager.ts"
import type { MindMapSavedData } from "./hooks/useCanvasManager.ts"
import { useIconToolbarManager } from "./hooks/useIconToolbarManager.ts"
import { useConvertMindMap } from "./hooks/useConvertMindMap.ts"
import { useCollaborationManager } from "./hooks/useCollaborationManager"
import { resolveMindMapLoading } from "./hooks/mindmap-loading"
import { initPlugins } from "./managers/PluginManager.ts"
import { useCurrentUser } from "@/shared/app-shared"
import { AIFeaturePanel, AIChatProvider, resolveMindmapShortId } from "@zoeymind-ext-mind"
import { CommentProvider } from "@/products/mind/features/mindmap/contexts/CommentContext"
import { useLoading } from "@/shared/app-shared"
import { useUIStore } from "@/products/mind/stores"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useProjectContext } from "@/products/mind/features/mindmap/contexts/project-context"
import { useTranslation } from "@zoeymind/i18n"
import { Button, LoadErrorScreen } from "@zoeymind/ui"
import { isWaitingForCollaboration } from "@/products/mind/features/mindmap/types/mindmap-extensions"
import { logger } from "@zoeymind/logger"
// Save 按钮的位置在 TopBar 内 (菜单右侧), 由 TopBar 自身消费 HeaderSaveButton.
import { MindMapIconToolbar } from "./MindMapIconToolbar.tsx"
import { CanvasTool } from "./canvasTool/index.tsx"
import { MindMapScrollbar } from "./MindMapScrollbar.tsx"
import { PreviewIndicator } from "./PreviewIndicator.tsx"
import { CollaborationCursorLayer } from "./CollaborationCursorLayer"
import {
  getProject,
  notifyProjectPathChanged,
  readBundle,
  relinkProjectFile,
  unregisterProject,
} from "@/shared/native"
import { open as openNativeDialog } from "@tauri-apps/plugin-dialog"
import { useSaveFlowContext } from "@/shared/native"
import { useTabs } from "@/shared/tabs/store"
import { DiffPopover, DiffSummary, useDiffTracking } from "@/products/mind/diff-view"
import "@/products/mind/diff-view/diff-view.css"

// 初始化插件
initPlugins()

export function MindMapCanvas({ visible = true }: { visible?: boolean }) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasViewportRef = useRef<HTMLDivElement>(null)
  const visibleRef = useRef(visible)
  useEffect(() => {
    visibleRef.current = visible
  }, [visible])
  const [reloadToken, setReloadToken] = useState(0)
  const saveFlow = useSaveFlowContext()
  useDiffTracking()
  const formatPanelRef = useRef<FormatPanelRef>(null)

  // 🎯 从 Context 获取 workspaceId 和 cloudMode (页面级作用域)
  const { workspaceId } = useProjectContext()

  const { showLoading, hideLoading, updateProgress: updateGlobalProgress, loading } = useLoading()
  const updateProgress = useCallback(
    (progress: number) => {
      if (visibleRef.current) updateGlobalProgress(progress)
    },
    [updateGlobalProgress]
  )
  const { data: user } = useCurrentUser()

  // 使用Zustand stores替代本地状态
  const { mindMap, loadError, setMindMap, setLoadError } = useMindMapStore()

  const { forceDefaultTemplate, setForceDefaultTemplate } = useUIStore()
  const aiPanelOpen = useUIStore(state => state.activeFormatTab === "ai")
  const [aiPanelWidth, setAIPanelWidth] = useState(400)
  const aiPanelRef = useRef<HTMLElement>(null)
  const aiPanelContentRef = useRef<HTMLDivElement>(null)
  const aiResizeCleanupRef = useRef<(() => void) | null>(null)
  const handleAIWidthPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      const splitter = event.currentTarget
      const pointerId = event.pointerId
      splitter.dataset.dragging = "true"
      splitter.setPointerCapture(pointerId)
      if (aiPanelRef.current) aiPanelRef.current.dataset.resizing = "true"
      const startX = event.clientX
      const startWidth = aiPanelWidth
      let nextWidth = startWidth
      let animationFrame = 0

      const applyWidth = () => {
        animationFrame = 0
        if (aiPanelRef.current) aiPanelRef.current.style.width = `${nextWidth + 12}px`
        if (aiPanelContentRef.current) {
          aiPanelContentRef.current.style.width = `${nextWidth}px`
        }
      }
      const handlePointerMove = (moveEvent: PointerEvent) => {
        nextWidth = Math.min(800, Math.max(300, startWidth + startX - moveEvent.clientX))
        if (!animationFrame) animationFrame = requestAnimationFrame(applyWidth)
      }
      const cleanup = () => {
        splitter.removeEventListener("pointermove", handlePointerMove)
        splitter.removeEventListener("pointerup", handlePointerUp)
        splitter.removeEventListener("pointercancel", handlePointerUp)
        if (animationFrame) cancelAnimationFrame(animationFrame)
        if (splitter.hasPointerCapture(pointerId)) splitter.releasePointerCapture(pointerId)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        delete splitter.dataset.dragging
        if (aiPanelRef.current) delete aiPanelRef.current.dataset.resizing
        aiResizeCleanupRef.current = null
      }
      const handlePointerUp = () => {
        applyWidth()
        cleanup()
        setAIPanelWidth(nextWidth)
      }

      aiResizeCleanupRef.current?.()
      aiResizeCleanupRef.current = cleanup
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      splitter.addEventListener("pointermove", handlePointerMove)
      splitter.addEventListener("pointerup", handlePointerUp)
      splitter.addEventListener("pointercancel", handlePointerUp)
    },
    [aiPanelWidth]
  )

  useEffect(() => () => aiResizeCleanupRef.current?.(), [])

  useEffect(() => {
    const viewport = canvasViewportRef.current
    if (!viewport || !visible) return

    const updateFloatingPanelBounds = () => {
      const rect = viewport.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const titlebarBottom =
        document.querySelector<HTMLElement>("[data-app-titlebar]")?.getBoundingClientRect()
          .bottom ?? 0
      const safeTop = Math.max(rect.top, titlebarBottom)
      document.documentElement.style.setProperty("--mind-floating-top", `${safeTop + 16}px`)
      document.documentElement.style.setProperty(
        "--mind-floating-right",
        `${window.innerWidth - rect.right + 16}px`
      )
      document.documentElement.style.setProperty(
        "--mind-floating-bottom",
        `${window.innerHeight - rect.bottom + 16}px`
      )
      document.documentElement.style.setProperty(
        "--mind-floating-max-width",
        `${Math.max(300, rect.width - 32)}px`
      )
    }

    // WKWebView 不保证 hidden -> visible 会触发 ResizeObserver；等布局提交后主动测量。
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(updateFloatingPanelBounds)
    })
    const observer = new ResizeObserver(updateFloatingPanelBounds)
    observer.observe(viewport)
    window.addEventListener("resize", updateFloatingPanelBounds)
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      observer.disconnect()
      window.removeEventListener("resize", updateFloatingPanelBounds)
    }
  }, [visible])

  const handleLoadError = useCallback(
    (error: unknown) => {
      if (visibleRef.current) hideLoading()
      const fallback = t("mindmap.canvas.loadFailed")
      const message = error instanceof Error ? error.message || fallback : fallback
      setLoadError(message)
    },
    [hideLoading, setLoadError, t]
  )

  // ✅ 项目切换时清理错误状态（reloadToken 由 store 统一管理）
  useEffect(() => {
    setLoadError(null)
    setForceDefaultTemplate(false)
  }, [workspaceId, setLoadError, setForceDefaultTemplate])

  // 搜索相关功能现在由 useShortcutManager 和 TopBar 内部处理

  // Dropdown状态设置函数

  // 使用拆分出的各个管理器
  useEventManager(mindMap)
  useNodeLimitGuard(mindMap)

  const { loadSavedData: loadLocalSavedData, saveData } = useStorageManager()

  // 使用快捷键管理器，现在直接使用 store
  useShortcutManager()

  useViewManager()

  // 使用思维导图格式转换钩子，启用飞书格式复制粘贴
  const { copyXMindDataToClipboard } = useConvertMindMap(mindMap)

  // 图标工具栏管理
  // 图标工具栏关闭现在由组件内部处理

  // IconToolbar状态设置现在由组件内部处理

  useIconToolbarManager(mindMap)

  // 使用协作管理器 - 在数据加载完成后自动初始化协作
  const userInfo = useMemo(() => {
    return user
      ? {
          id: user.id,
          name: user.name || undefined,
          avatar: user.avatar || undefined,
        }
      : undefined
  }, [user])

  const loadSavedData = useCallback(async (): Promise<{
    savedData: MindMapSavedData | null
    savedViewData: { scale: number; translateX: number; translateY: number } | null
  }> => {
    if (forceDefaultTemplate) {
      updateProgress(50)
      return { savedData: defaultData as MindMapSavedData, savedViewData: null }
    }
    updateProgress(40)
    const result = await loadLocalSavedData()
    updateProgress(50)
    const savedViewData = result.savedViewData as {
      scale: number
      translateX: number
      translateY: number
    } | null
    return { savedData: result.savedData as unknown as MindMapSavedData, savedViewData }
  }, [forceDefaultTemplate, loadLocalSavedData, updateProgress])

  // 使用画布管理器初始化和管理画布（从 Context 获取 workspaceId 和 cloudMode）
  useCanvasManager(
    containerRef,
    setMindMap,
    loadSavedData,
    saveData,
    reloadToken,
    handleLoadError,
    updateProgress
  )

  const collaboration = useCollaborationManager(userInfo, updateProgress)

  // 评论点击处理回调
  const handleNodeCommentClick = useCallback((nodeUid: string) => {
    // 使用FormatPanel的评论功能
    formatPanelRef.current?.openCommentPanelForNode(nodeUid)
  }, [])

  // 监听评论标签点击事件
  useEffect(() => {
    if (!mindMap) return

    const handleCommentLabelClick = (...args: unknown[]) => {
      // 获取节点的 UID
      const node = args[0] as { nodeData?: { data?: { uid?: string } } } | undefined
      const nodeUid = node?.nodeData?.data?.uid
      if (nodeUid) {
        handleNodeCommentClick(nodeUid)
      }
    }

    mindMap.on("node_comment_label_click", handleCommentLabelClick)

    return () => {
      mindMap.off("node_comment_label_click", handleCommentLabelClick)
    }
  }, [mindMap, handleNodeCommentClick])

  // 右键菜单管理现在由 MindMapDropdown 内部处理

  // ✅ 简化的Loading管理逻辑 —— 首次同步完成后，重连/重新同步不再覆盖全局 Loading
  useEffect(() => {
    if (!visible) return
    const decision = resolveMindMapLoading({
      workspaceId,
      cloudMode: false,
      hasMindMap: Boolean(mindMap),
      loadError,
      collaboration: collaboration
        ? {
            status: collaboration.status,
            synced: collaboration.synced,
            initialSyncDone: collaboration.initialSyncDone,
          }
        : null,
      waitingForCollaboration: mindMap ? isWaitingForCollaboration(mindMap) : false,
    })

    if (decision.kind === "hide") {
      hideLoading()
      return
    }
    if (decision.kind === "show") {
      showLoading(t(decision.tipKey))
      return
    }
    // complete: 已就绪
    updateProgress(100)
    // 等待1秒后关闭,让用户看到100%完成状态
    const progressTimer = setTimeout(() => {
      hideLoading()
    }, 1000)
    return () => clearTimeout(progressTimer)
  }, [
    workspaceId,
    mindMap,
    collaboration,
    loadError,
    showLoading,
    hideLoading,
    updateProgress,
    t,
    visible,
  ])

  // 监听来自AI Chat的节点激活事件（支持短 ID 自动 resolve）
  useEffect(() => {
    const handleGoToNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string }>
      let { nodeId } = customEvent.detail
      if (mindMap && nodeId) {
        try {
          nodeId = resolveMindmapShortId(nodeId)
          mindMap.execCommand("GO_TARGET_NODE", nodeId)
        } catch (error) {
          logger.error("[MindMapCanvas] GO_TARGET_NODE执行失败:", error)
        }
      }
    }

    window.addEventListener("mindmap:goToNode", handleGoToNode)
    return () => {
      window.removeEventListener("mindmap:goToNode", handleGoToNode)
    }
  }, [mindMap])

  const handleLocateMissingFile = useCallback(async () => {
    if (!workspaceId) return
    const picked = await openNativeDialog({
      multiple: false,
      filters: [{ name: "ZoeyMind", extensions: ["zmind"] }],
    })
    if (!picked || typeof picked !== "string") return
    await readBundle(picked)
    const changed = await relinkProjectFile(workspaceId, picked)
    notifyProjectPathChanged({ id: workspaceId, ...changed })
    useTabs.getState().renameProjectTabs(workspaceId, changed.name)
    setLoadError(null)
    setReloadToken(value => value + 1)
  }, [setLoadError, workspaceId])

  const handleRemoveMissingProject = useCallback(async () => {
    if (!workspaceId) return
    await unregisterProject(workspaceId)
    useTabs.getState().closeTab(workspaceId)
    useTabs.getState().goHome()
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    const checkPath = async () => {
      const project = await getProject(workspaceId)
      if (project && !project.exists) setLoadError(t("fileRepair.missingDescription"))
    }
    window.addEventListener("focus", checkPath)
    return () => window.removeEventListener("focus", checkPath)
  }, [setLoadError, t, workspaceId])
  return (
    <CommentProvider>
      <AIChatProvider>
        <div className="flex h-full min-h-0 overflow-hidden bg-editor-shell">
          <section className="flex min-w-0 flex-1 flex-col">
            <header className="z-30 flex h-12 shrink-0 items-center gap-1 px-3">
              <TopBar collaboration={collaboration} />
              <div className="flex-1" />
              <FormatPanel ref={formatPanelRef} />
              <CanvasTool />
              <AIChatToggle />
            </header>
            <main className="flex min-h-0 flex-1 px-3">
              <div
                ref={canvasViewportRef}
                className="relative h-full min-w-0 flex-1 overflow-hidden rounded-xl bg-background ring-1 ring-border/70"
              >
                <div
                  ref={containerRef}
                  key="mind-map-container"
                  className="absolute inset-0"
                  style={{ visibility: loading ? "hidden" : "visible" }}
                />
                <MindMapDropdown
                  formatPanelRef={formatPanelRef}
                  copyXMindDataToClipboard={copyXMindDataToClipboard}
                />
                <MindMapIconToolbar />
                {saveFlow.conflict && !loadError && (
                  <LoadErrorScreen
                    title={t("fileConflict.title")}
                    description={t("fileConflict.description")}
                    secondaryLabel={t("fileConflict.reload")}
                    onSecondary={() => {
                      void saveFlow.reloadFromDisk().then(() => setReloadToken(value => value + 1))
                    }}
                    primaryLabel={t("fileConflict.saveCopy")}
                    onPrimary={() => void saveFlow.saveCopy()}
                  >
                    <Button variant="destructive" onClick={() => void saveFlow.overwrite()}>
                      {t("fileConflict.overwrite")}
                    </Button>
                  </LoadErrorScreen>
                )}
                {loadError && (
                  <LoadErrorScreen
                    title={t("fileRepair.title")}
                    description={loadError}
                    secondaryLabel={t("fileRepair.remove")}
                    onSecondary={() => void handleRemoveMissingProject()}
                    primaryLabel={t("fileRepair.locate")}
                    onPrimary={() => void handleLocateMissingFile()}
                  />
                )}
                <DiffSummary />
                <DiffPopover containerRef={containerRef} />
                <MindMapScrollbar />
                <PreviewIndicator />
                <CollaborationCursorLayer />
              </div>
            </main>
            <StatusBar />
          </section>
          {aiPanelOpen && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("mindmap.aiChat.core.resizePanel")}
              onPointerDown={handleAIWidthPointerDown}
              className="group relative z-20 -mx-1 h-full w-2 shrink-0 cursor-col-resize touch-none"
            >
              <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-border group-data-[dragging=true]:bg-border" />
            </div>
          )}
          <aside
            ref={aiPanelRef}
            aria-hidden={!aiPanelOpen}
            inert={!aiPanelOpen ? true : undefined}
            className="t-resize h-full shrink-0 overflow-hidden pb-3 pr-3 data-[resizing=true]:transition-none data-[resizing=true]:will-change-auto"
            style={{ width: aiPanelOpen ? aiPanelWidth + 12 : 0 }}
          >
            <div ref={aiPanelContentRef} className="h-full" style={{ width: aiPanelWidth }}>
              <AIFeaturePanel isActive={true} />
            </div>
          </aside>
        </div>
      </AIChatProvider>
    </CommentProvider>
  )
}
