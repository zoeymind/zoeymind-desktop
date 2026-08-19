/**
 * WorkspaceShell —— tabs 主内容区, VS Code 风格 keep-alive.
 *
 * Home 区和每个 open editor tab 都常驻 DOM (via `hidden` 属性), 切 tab 不再 unmount.
 *
 * useMindMapStore 是全局单例, 直接挂多个 canvas 会互相踩. 解决:
 *   - 每个 MindMapCanvas 挂载时把自己的 MindMap 实例 register 到 tabInstances Map
 *   - WorkspaceShell 监听 activeId, 把 tabInstances[activeId] 塞回全局 store
 *   - dirty state 同样按 tab 缓存 (tabDirty)
 * 切 tab: 全局 store swap 一次, 不重载 canvas, 不弹 Loading.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Loader2, PanelLeft } from "lucide-react"
import { MindMapCanvas } from "@/products/mind/features/mindmap/components/MindMapCanvas"
import { ProjectListPage } from "@/products/mind/features/mindmap/pages/ProjectsPage"
import {
  ProjectsSidebar,
  type ProjectView,
} from "@/products/mind/features/mindmap/components/projects/ProjectsSidebar"
import { ProjectProvider } from "@/products/mind/features/mindmap/contexts/ProjectContext"
import {
  SaveFlowProvider,
  UnsavedGuard,
  useSaveFlowContext,
  setMenuSaveFlow,
} from "@/shared/native"
import { useTabs, type OpenTab } from "@/shared/tabs/store"
import { tabInstances, tabDirty, tabSaveFns } from "@/shared/tabs/instances"
import { useMindMapStore } from "@/products/mind/features/mindmap/stores/mindmap-store"
import { useLoading } from "@/shared/app-shared"
import {
  ProjectSessionProvider,
  activateLegacyProjectSession,
  startLegacyProjectSessionAdapter,
  useProjectSessionStore,
} from "@/products/mind/editor-session"
const LOCAL_ORG_ID = "local"

export function WorkspaceShell() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const navigate = useNavigate()
  useEffect(() => startLegacyProjectSessionAdapter(), [])
  const location = useLocation()
  const [paneOrder, setPaneOrder] = useState<string[]>(() => tabs.map(tab => tab.id))
  useEffect(
    () =>
      useTabs.subscribe(state => {
        const currentTabIds = new Set(state.tabs.map(tab => tab.id))
        setPaneOrder(current => {
          const next = [
            ...current.filter(id => currentTabIds.has(id)),
            ...state.tabs.map(tab => tab.id).filter(id => !current.includes(id)),
          ]
          return next.length === current.length && next.every((id, index) => id === current[index])
            ? current
            : next
        })
      }),
    []
  )
  const tabsById = new Map(tabs.map(tab => [tab.id, tab]))
  const editorTabs = paneOrder.flatMap(id => {
    const tab = tabsById.get(id)
    return tab ? [tab] : []
  })

  // URL <- activeId (deep-link). 用 activeId 本身当 URL 段, 与 tab.kind 无关 ->
  // draft 保存后 kind 从 'draft' 翻 'file' 但 tab.id (=activeId) 不变, URL 也不变,
  // 不会触发 React Router 换 route element -> WorkspaceShell 不 remount, 不闪.
  useEffect(() => {
    const target = activeId === "home" ? "/" : `/editor/${activeId}`
    if (location.pathname !== target) navigate(target, { replace: true })
  }, [activeId, location.pathname, navigate])
  useEffect(() => {
    activateLegacyProjectSession(activeId === "home" ? null : activeId)
  }, [activeId])

  // 切 tab: 从 tabInstances 恢复 active tab 的 mindMap + dirty 到全局 store.
  // 离开的 tab 把当前 dirty 存进缓存.
  const prevActiveRef = useRef<string | null>(null)
  const { hideLoading } = useLoading()
  useEffect(() => {
    const prev = prevActiveRef.current
    if (prev && prev !== "home" && prev !== activeId) {
      tabDirty.set(prev, useMindMapStore.getState().isDirty)
    }
    if (activeId === "home") {
      // 回首页: 保留全局 mindMap 不动, 只关闭 loading 遮罩 (避免 hidden EditorPane
      // 的 resolveMindMapLoading 看到 hasMindMap=false 触发 showLoading 循环).
      hideLoading()
    } else {
      // 切到已有 canvas 实例的 tab: swap 到那个实例.
      // 新 tab 首次挂载: tabInstances 里还没有实例, 保留全局 mindMap 不动,
      // 等 EditorPane useCanvasManager 自己 setMindMap 上来.
      const instance = tabInstances.get(activeId)
      if (instance) {
        useMindMapStore.setState({
          mindMap: instance as never,
          isDirty: tabDirty.get(activeId),
        })
      }
    }
    prevActiveRef.current = activeId
  }, [activeId, hideLoading])
  return (
    <div className="relative h-full w-full">
      <HomePane visible={activeId === "home"} />
      {editorTabs.map(tab => (
        <EditorPane key={tab.id} tab={tab} visible={activeId === tab.id} />
      ))}
    </div>
  )
}

function HomePane({ visible }: { visible: boolean }) {
  const [activeView, setActiveView] = useState<ProjectView>("all")
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [searchText, setSearchText] = useState("")

  const handleViewChange = useCallback((next: ProjectView) => {
    setActiveView(next)
    setActiveFolderId(null)
  }, [])

  const handleSelectFolder = useCallback((id: string) => {
    setActiveView("folder")
    setActiveFolderId(id)
  }, [])

  return (
    <div className="absolute inset-0 flex bg-background" hidden={!visible}>
      <ProjectsSidebar
        activeView={activeView}
        activeFolderId={activeFolderId}
        onViewChange={handleViewChange}
        onSelectFolder={handleSelectFolder}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        activeWorkspaceId={null}
        workspaces={[]}
        onSelectWorkspace={() => undefined}
        onOpenSearch={() => undefined}
        organizationId={LOCAL_ORG_ID}
        canCreateWorkspace={false}
      />
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute left-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-muted"
          aria-label="展开侧栏"
        >
          <PanelLeft className="size-4" />
        </button>
      )}
      <div className="flex flex-1 min-w-0 min-h-0">
        <ProjectListPage
          view={activeView}
          folderId={activeFolderId}
          searchText={searchText}
          onClearSearch={() => setSearchText("")}
          workspaceId={null}
          workspaceName={null}
        />
      </div>
    </div>
  )
}

function EditorPane({ tab, visible }: { tab: OpenTab; visible: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!visible || mounted) return
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [mounted, visible])

  return (
    <div className="absolute inset-0" hidden={!visible}>
      {mounted ? (
        <ProjectSessionProvider projectId={tab.id}>
          <SaveFlowProvider projectId={tab.id}>
            <EditorPaneInner id={tab.id} visible={visible} />
          </SaveFlowProvider>
        </ProjectSessionProvider>
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
    </div>
  )
}

function EditorPaneInner({ id, visible }: { id: string; visible: boolean }) {
  const saveFlow = useSaveFlowContext()
  const sessionStore = useProjectSessionStore()
  // 每个 tab 都注册自己的 save 句柄, 供 CloseConfirmDialog / TabBar 关闭时调用
  // (不能只依赖 setMenuSaveFlow, 那个只映射当前 active tab).
  useEffect(() => {
    const commands = {
      save: () => saveFlow.save(),
      saveAs: (path: string) => saveFlow.saveAs(path),
    }
    sessionStore.getState().setCommands(commands)
    tabSaveFns.register(id, commands)
    return () => {
      sessionStore.getState().setCommands({})
      tabSaveFns.unregister(id)
    }
  }, [id, saveFlow, sessionStore])
  // Active tab 时把 saveFlow 暴露给顶部 macOS 原生菜单 (File > Save / Save As).
  useEffect(() => {
    if (!visible) return
    setMenuSaveFlow({
      save: () => saveFlow.save(),
      saveAs: (path: string) => saveFlow.saveAs(path),
    })
    return () => setMenuSaveFlow(null)
  }, [visible, saveFlow])
  return (
    <ProjectProvider key={id} workspaceId={id} cloudMode={false}>
      <MindMapCanvas visible={visible} />
      <UnsavedGuard projectId={id} saveFlow={saveFlow} />
    </ProjectProvider>
  )
}
