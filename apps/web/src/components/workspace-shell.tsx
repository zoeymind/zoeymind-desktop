/**
 * WorkspaceShell —— tabs 主内容区, VS Code 风格 keep-alive.
 *
 * Home 和已加载的 editor pane 常驻 DOM。Tab 激活只改变可见性，Tab 排序只改变标题顺序；
 * editor runtime 的 DOM 顺序和组件 identity 不随这两类视图操作变化。
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Loader2, PanelLeft } from "lucide-react"
import { MindMapCanvas } from "@/products/mind/features/mindmap/components/MindMapCanvas"
import { ProjectListPage } from "@/products/mind/features/mindmap/pages/ProjectsPage"
import { TestCaseRulesPage } from "@/products/mind/features/mindmap/pages/TestCaseRulesPage"
import {
  ProjectsSidebar,
  type ProjectView,
} from "@/products/mind/features/mindmap/components/projects/ProjectsSidebar"
import { ProjectProvider } from "@/products/mind/features/mindmap/contexts/ProjectContext"
import { useLoading, useLoadingStore } from "@/shared/app-shared"
import { SaveFlowProvider, useSaveFlowContext } from "@/shared/native"
import { useTabs, type OpenTab } from "@/shared/tabs/store"
import { tabSaveFns } from "@/shared/tabs/instances"
import {
  ProjectSessionProvider,
  projectSessionRegistry,
  useProjectSessionStore,
} from "@/products/mind/editor-session"
import { reconcileEditorPaneOrder } from "@/products/mind/editor-session/editor-pane-order"
import { getPanePresentationClass } from "@/products/mind/editor-session/editor-pane-presentation"
const LOCAL_ORG_ID = "local"

export function WorkspaceShell() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const navigate = useNavigate()
  const location = useLocation()
  const { hideLoading } = useLoading()
  const [paneOrder, setPaneOrder] = useState<string[]>(() => tabs.map(tab => tab.id))
  useEffect(
    () =>
      useTabs.subscribe(state => {
        const nextTabOrder = state.tabs.map(tab => tab.id)
        setPaneOrder(current => reconcileEditorPaneOrder(current, nextTabOrder))
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
    projectSessionRegistry.setActive(activeId === "home" ? null : activeId)
  }, [activeId])
  useEffect(() => {
    if (activeId === "home") hideLoading()
  }, [activeId, hideLoading])
  // 冷启动: 持久化的 activeId 若不是 home, 首帧就同步拉起全局 loading, 遮住
  // EditorPane raf-gated Loader2 / 空画布, 避免"全局 loading 不是第一个显示"的闪.
  // 只跑一次: 后续 openTab 走 tabs store 内的 showLoading, 切 Tab 不会重放.
  useLayoutEffect(() => {
    if (activeId !== "home" && !useLoadingStore.getState().loading) {
      useLoadingStore.getState().showLoading()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const [rulesOpen, setRulesOpen] = useState(false)

  const handleViewChange = useCallback((next: ProjectView) => {
    setRulesOpen(false)
    setActiveView(next)
    setActiveFolderId(null)
  }, [])

  const handleSelectFolder = useCallback((id: string) => {
    setRulesOpen(false)
    setActiveView("folder")
    setActiveFolderId(id)
  }, [])

  return (
    <div
      className={getPanePresentationClass(visible, "flex bg-editor-shell")}
      aria-hidden={!visible}
      inert={!visible ? true : undefined}
    >
      <ProjectsSidebar
        activeView={activeView}
        activeFolderId={activeFolderId}
        onViewChange={handleViewChange}
        onSelectFolder={handleSelectFolder}
        rulesOpen={rulesOpen}
        onOpenRules={() => setRulesOpen(true)}
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
      <div className="flex min-h-0 min-w-0 flex-1">
        {rulesOpen ? (
          <TestCaseRulesPage onClose={() => setRulesOpen(false)} />
        ) : (
          <ProjectListPage
            view={activeView}
            folderId={activeFolderId}
            searchText={searchText}
            onClearSearch={() => setSearchText("")}
            workspaceId={null}
            workspaceName={null}
          />
        )}
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
    <div
      className={getPanePresentationClass(visible)}
      aria-hidden={!visible}
      inert={!visible ? true : undefined}
    >
      {mounted ? (
        <ProjectSessionProvider projectId={tab.id} initialDirty={tab.kind === "recovery"}>
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
  // 每个 tab 注册自己的命令，供菜单、单 Tab 关闭和窗口级协调器按项目定位。
  useEffect(() => {
    const commands = {
      save: () => saveFlow.save(),
      saveAs: (path: string) => saveFlow.saveAs(path),
      flushRecovery: () => saveFlow.flushRecovery(),
      discard: () => saveFlow.discardAndClose(),
    }
    sessionStore.getState().setCommands(commands)
    tabSaveFns.register(id, commands)
    return () => {
      sessionStore.getState().setCommands({})
      tabSaveFns.unregister(id)
    }
  }, [id, saveFlow, sessionStore])
  return (
    <ProjectProvider key={id} workspaceId={id} cloudMode={false}>
      <MindMapCanvas visible={visible} />
    </ProjectProvider>
  )
}
