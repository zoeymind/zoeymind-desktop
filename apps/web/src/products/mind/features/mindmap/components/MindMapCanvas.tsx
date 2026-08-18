// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { useCallback, useRef, useMemo, useEffect } from 'react'
import { MindMapDropdown } from './MindMapDropdown.tsx'
import { FormatPanel, type FormatPanelRef } from './FormatPanel/FormatPanel.tsx'
import { TopBar } from './TopBar/TopBar.tsx'
import { StatusBar } from './StatusBar/StatusBar'
import { useEventManager } from './hooks/useEventManager.ts'
import { useNodeLimitGuard } from './hooks/useNodeLimitGuard.ts'
import { useStorageManager } from './hooks/useStorageManager.ts'
import { useCloudStorageManager } from './hooks/useCloudStorageManager.ts'
import { useShortcutManager } from './hooks/useShortcutManager.ts'
import { useViewManager } from './hooks/useViewManager.ts'
import { useCanvasManager, defaultData } from './hooks/useCanvasManager.ts'
import type { MindMapSavedData } from './hooks/useCanvasManager.ts'
import { useIconToolbarManager } from './hooks/useIconToolbarManager.ts'
import { useConvertMindMap } from './hooks/useConvertMindMap.ts'
import { useCollaborationManager } from './hooks/useCollaborationManager'
import { resolveMindMapLoading } from './hooks/mindmap-loading'
import { initPlugins, setCurrentOrganizationId } from './managers/PluginManager.ts'
import { useCurrentUser } from '@/shared/app-shared'
import { useCommentYJS } from '@/products/mind/features/mindmap/hooks/useCommentYJS'
import { AIChatProvider, resolveMindmapShortId } from '@zoeymind-ext-mind'
import {
  CommentProvider,
  type CommentContextValue
} from '@/products/mind/features/mindmap/contexts/CommentContext'
import { EMPTY_SNAPSHOT } from '@/products/mind/features/mindmap/services/comment-service'
import { useLoading } from '@/shared/app-shared'
import { trpcClient } from '@/shared/app-shared'
import { useUIStore } from '@/products/mind/stores'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useCommentStore } from '@/products/mind/features/mindmap/stores/comment-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { useOrganization } from '@/shared/app-shared'
import { toast, toastLoading, dismissToast, ThemeMenu, LanguageSwitcher } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'
import { Button } from '@zoeymind/ui'
import type { default as MindMap } from 'simple-mind-map'
import { isWaitingForCollaboration } from '@/products/mind/features/mindmap/types/mindmap-extensions'
import { logger } from '@zoeymind/logger'
// Save 按钮的位置在 TopBar 内 (菜单右侧), 由 TopBar 自身消费 HeaderSaveButton.
import { MindMapIconToolbar } from './MindMapIconToolbar.tsx'
import { HeaderTitle } from './HeaderTitle'
import { MindMapScrollbar } from './MindMapScrollbar.tsx'
import { PreviewIndicator } from './PreviewIndicator.tsx'
import { CollaborationCursorLayer } from './CollaborationCursorLayer'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'

// 初始化插件
initPlugins()

// 协作同步中 Toast 的固定 id：toast.loading 原位更新避免重复弹
const MINDMAP_SYNC_TOAST_ID = 'mindmap-collab-sync'

export function MindMapCanvas() {
  // 🎯 记录页面组件开始时间，用于计算总加载耗时（只在首次渲染时设置）
  const componentStartTimeRef = useRef<number>(undefined)
  const mountCountRef = useRef(0)

  // 只在首次渲染时记录开始时间
  if (componentStartTimeRef.current === undefined) {
    componentStartTimeRef.current = performance.now()
    mountCountRef.current += 1
  }

  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const formatPanelRef = useRef<FormatPanelRef>(null)

  // 🎯 从 Context 获取 workspaceId 和 cloudMode (页面级作用域)
  const { workspaceId, cloudMode } = useProjectContext()
  const { currentOrg } = useOrganization()

  // 同步组织 ID 到 PluginManager（供 Ghost Completion 使用）
  useEffect(() => {
    setCurrentOrganizationId(currentOrg?.id)
  }, [currentOrg?.id])

  const { showLoading, hideLoading, updateProgress, loading } = useLoading()

  const { data: user } = useCurrentUser()

  // 使用Zustand stores替代本地状态
  const { mindMap, loadError, setMindMap, setLoadError } = useMindMapStore()

  const { forceDefaultTemplate, setForceDefaultTemplate } = useUIStore()

  const { syncFromHook } = useCommentStore()

  // 权限管理 - 从store获取权限状态
  const { hasPermission, canEdit } = usePermissionStore()


  const handleLoadError = useCallback(
    (error: unknown) => {
      hideLoading()
      const fallback = t('mindmap.canvas.loadFailed')
      const message = error instanceof Error ? error.message || fallback : fallback
      setLoadError(message)
    },
    [hideLoading, setLoadError, t]
  )

  const handleUseDefaultTemplate = useCallback(() => {
    showLoading(t('mindmap.canvas.loadingDefaultTemplate'))
    setLoadError(null)
    setForceDefaultTemplate(true)
    setMindMap(null)
  }, [setMindMap, showLoading, setLoadError, setForceDefaultTemplate, t])

  const handleUseSnapshot = useCallback(() => {
    toast({
      title: t('mindmap.canvas.snapshotComingSoonTitle'),
      description: t('mindmap.canvas.snapshotComingSoonDescription')
    })
  }, [toast, t])

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

  // 根据云模式选择不同的存储管理器
  const { loadSavedData: loadLocalSavedData, saveData: saveLocalData } = useStorageManager()
  const { saveData: saveCloudData, uploadPreviewThrottled } = useCloudStorageManager(mindMap, {
    collaborative: cloudMode
  })

  const saveData = cloudMode ? saveCloudData : saveLocalData

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
          avatar: user.avatar || undefined
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
    if (cloudMode) {
      // 先获取 Y.Doc 二进制数据，再实例化画布
      if (workspaceId) {
        try {
          updateProgress(30)
          const yDocResponse = await trpcClient.mindmap.content.getYDocBinary.query({
            mindmapId: workspaceId
          })
          updateProgress(50)

          if (yDocResponse.success && yDocResponse.hasYDocData && yDocResponse.binary) {
            // Base64 -> Uint8Array
            const binaryString = atob(yDocResponse.binary)
            const binary = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              binary[i] = binaryString.charCodeAt(i)
            }

            // 直接将 binary 注入给 cooperate 插件的 bootstrapFromInitialState
            // document-sync 会通过 Y.Map observe 自动渲染到 MindMap
            return {
              savedData: {
                ...defaultData,
                __initialYDocState: binary,
                __hasRealData: true
              } as MindMapSavedData,
              savedViewData: null
            }
          }

          // 没有远端数据时，使用默认模板并等待协作同步
          if (yDocResponse.success && !yDocResponse.hasYDocData) {
            return {
              savedData: {
                ...defaultData,
                __waitForCollaboration: true
              } as MindMapSavedData,
              savedViewData: null
            }
          }
        } catch (error) {
          logger.warn('HTTP获取YDoc数据失败，使用默认数据等待WebSocket同步', error)
        }
      }

      // HTTP获取失败或无数据，使用默认数据让WebSocket处理协作同步
      updateProgress(40)
      return {
        savedData: {
          ...defaultData,
          __waitForCollaboration: true
        } as MindMapSavedData,
        savedViewData: null
      }
    }
    updateProgress(40)
    const result = await loadLocalSavedData()
    updateProgress(50)
    return {
      savedData: result.savedData as MindMapSavedData,
      savedViewData: result.savedViewData
    }
  }, [forceDefaultTemplate, cloudMode, workspaceId, loadLocalSavedData, trpcClient, updateProgress])

  // MindMap状态设置函数
  const setMindMapReact = useCallback(
    (mindMapOrUpdater: MindMap | null | ((prev: MindMap | null) => MindMap | null)) => {
      if (typeof mindMapOrUpdater === 'function') {
        setMindMap(mindMapOrUpdater(mindMap))
      } else {
        setMindMap(mindMapOrUpdater)
      }
    },
    [mindMap, setMindMap]
  )

  // 使用画布管理器初始化和管理画布（从 Context 获取 workspaceId 和 cloudMode）
  useCanvasManager(
    containerRef,
    setMindMapReact,
    loadSavedData,
    saveData,
    0, // reloadToken 已移除,workspaceId 变化时 Provider 会重新挂载
    handleLoadError,
    updateProgress
  )

  const collaboration = useCollaborationManager(userInfo, updateProgress)

  // 评论协同系统
  const commentData = useCommentYJS(mindMap, true)

  // 同步评论数据到 store（FormatPanel 的 badge 需要 totalComments）
  useEffect(() => {
    syncFromHook({ totalComments: commentData.totalComments, stats: commentData.stats })
  }, [commentData.totalComments, commentData.stats, syncFromHook])

  // CommentContext value（传给子组件）
  const commentContextValue: CommentContextValue = useMemo(
    () => ({
      service: commentData.service ?? null,
      comments: commentData.comments ?? EMPTY_SNAPSHOT.comments,
      stats: commentData.stats ?? EMPTY_SNAPSHOT.stats,
      totalComments: commentData.totalComments ?? 0
    }),
    [commentData.service, commentData.comments, commentData.stats, commentData.totalComments]
  )

  // 评论点击处理回调
  const handleNodeCommentClick = useCallback((nodeUid: string) => {
    // 使用FormatPanel的评论功能
    formatPanelRef.current?.openCommentPanelForNode(nodeUid)
  }, [])

  // 设置评论插件的点击回调
  useEffect(() => {
    if (mindMap && mindMap.comment) {
      mindMap.comment.options.onNodeCommentClick = handleNodeCommentClick
    }
  }, [mindMap, handleNodeCommentClick])

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

    mindMap.on('node_comment_label_click', handleCommentLabelClick)

    return () => {
      mindMap.off('node_comment_label_click', handleCommentLabelClick)
    }
  }, [mindMap, handleNodeCommentClick])

  // 只读模式提示
  useEffect(() => {
    if (mindMap && cloudMode && !canEdit && hasPermission) {
      toast({
        title: t('mindmap.canvas.readOnlyModeTitle'),
        description: t('mindmap.canvas.readOnlyModeDescription'),
        variant: 'default'
      })
    }
  }, [mindMap, cloudMode, canEdit, hasPermission, toast, t])

  // 右键菜单管理现在由 MindMapDropdown 内部处理

  // 预览状态管理
  const handlePreviewStateChange = useCallback(() => {
    // 这个功能现在由store管理
  }, [])

  // 退出预览模式的回调（这个会被PreviewIndicator调用，然后转发给SnapshotPanel）
  const exitPreviewRef = useRef<(() => void) | null>(null)

  // 预览退出现在由 PreviewIndicator 内部处理

  const setExitPreviewCallback = useCallback((callback: (() => void) | null) => {
    exitPreviewRef.current = callback
  }, [])

  // ✅ 简化的Loading管理逻辑 —— 首次同步完成后，重连/重新同步不再覆盖全局 Loading
  useEffect(() => {
    const decision = resolveMindMapLoading({
      workspaceId,
      cloudMode,
      hasMindMap: Boolean(mindMap),
      loadError,
      collaboration: collaboration
        ? {
            status: collaboration.status,
            synced: collaboration.synced,
            initialSyncDone: collaboration.initialSyncDone
          }
        : null,
      waitingForCollaboration: mindMap ? isWaitingForCollaboration(mindMap) : false
    })

    if (decision.kind === 'hide') {
      hideLoading()
      return
    }
    if (decision.kind === 'show') {
      showLoading(t(decision.tipKey), decision.progress)
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
    cloudMode,
    workspaceId,
    mindMap,
    collaboration?.status,
    collaboration?.synced,
    collaboration?.initialSyncDone,
    loadError,
    showLoading,
    hideLoading,
    updateProgress,
    t
  ])

  // 轻量"同步中" Toast：首次同步完成后用右上角 sonner 提示；连接恢复后自动收起。
  // 不再覆盖全局 Loading，画布保持原样。
  useEffect(() => {
    if (!cloudMode || !collaboration?.initialSyncDone) return
    const syncing = collaboration.status !== 'connected' || !collaboration.synced
    if (syncing) {
      toastLoading(t('mindmap.canvas.syncingIndicator'), MINDMAP_SYNC_TOAST_ID)
    } else {
      dismissToast(MINDMAP_SYNC_TOAST_ID)
    }
  }, [cloudMode, collaboration?.initialSyncDone, collaboration?.status, collaboration?.synced, t])

  // 组件卸载时清理同步 Toast
  useEffect(() => () => dismissToast(MINDMAP_SYNC_TOAST_ID), [])

  useEffect(() => {
    if (!cloudMode || !mindMap || !uploadPreviewThrottled) return
    if (!collaboration?.synced || loadError) return
    if (!canEdit) return

    let cancelled = false

    const trigger = async () => {
      if (cancelled) return
      await uploadPreviewThrottled()
    }

    trigger()
    const interval = window.setInterval(trigger, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [cloudMode, mindMap, collaboration?.synced, loadError, uploadPreviewThrottled, canEdit])

  // 监听来自AI Chat的节点激活事件（支持短 ID 自动 resolve）
  useEffect(() => {
    const handleGoToNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string }>
      let { nodeId } = customEvent.detail
      if (mindMap && nodeId) {
        try {
          nodeId = resolveMindmapShortId(nodeId)
          mindMap.execCommand('GO_TARGET_NODE', nodeId)
        } catch (error) {
          logger.error('[MindMapCanvas] GO_TARGET_NODE执行失败:', error)
        }
      }
    }

    window.addEventListener('mindmap:goToNode', handleGoToNode)
    return () => {
      window.removeEventListener('mindmap:goToNode', handleGoToNode)
    }
  }, [mindMap])

  return (
    <CommentProvider value={commentContextValue}>
      <AIChatProvider>
        <div className="flex flex-col h-screen">
          {/* 编辑器 Header —— 把左上/右上原本的两个悬浮按钮组合成一条完整 Header,
              位于 TitleBar (32px) 之下. 面板内容 (Tags/Theme/AI) 仍走各自的 fixed 定位. */}
          <div className="relative z-30 flex h-10 items-center border-b bg-background/95 px-2 backdrop-blur">
            <div className="flex flex-1 min-w-0 items-center gap-0.5">
              <TopBar collaboration={collaboration} />
            </div>
            {/* 绝对居中的标题, 与左右两侧独立, 长度不影响两侧宽度 */}
            <div className="pointer-events-none absolute inset-x-0 flex justify-center">
              <div className="pointer-events-auto">
                <HeaderTitle />
              </div>
            </div>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-0.5">
              <LanguageSwitcher />
              <ThemeMenu />
              <div className="mx-1 h-4 w-px bg-border" />
              <FormatPanel
                ref={formatPanelRef}
                onPreviewStateChange={handlePreviewStateChange}
                setExitPreviewCallback={setExitPreviewCallback}
              />
            </div>
          </div>
          <div className="flex-1 relative">
            <div
              ref={containerRef}
              key="mind-map-container"
              className="absolute inset-0"
              style={{ visibility: loading ? 'hidden' : 'visible' }}
            />
            <MindMapDropdown
              formatPanelRef={formatPanelRef}
              copyXMindDataToClipboard={copyXMindDataToClipboard}
            />
            <MindMapIconToolbar />
            {loadError && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t('mindmap.canvas.loadFailed')}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('mindmap.canvas.loadFailedDescription', { value: loadError })}
                  </p>
                  <div className="mt-6 flex justify-end gap-3">
                    <Button variant="outline" onClick={handleUseSnapshot}>
                      {t('mindmap.canvas.restoreFromSnapshot')}
                    </Button>
                    <Button onClick={handleUseDefaultTemplate}>
                      {t('mindmap.canvas.useDefaultTemplate')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <CanvasTool />
            <MindMapScrollbar />
            <PreviewIndicator />
            <CollaborationCursorLayer containerRef={containerRef} collaboration={collaboration} />
            <StatusBar />

          </div>
        </div>
      </AIChatProvider>
    </CommentProvider>
  )
}
