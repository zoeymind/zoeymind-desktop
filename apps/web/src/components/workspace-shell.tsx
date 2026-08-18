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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { MindMapCanvas } from '@/products/mind/features/mindmap/components/MindMapCanvas'
import { ProjectListPage } from '@/products/mind/features/mindmap/pages/ProjectsPage'
import {
  ProjectsSidebar,
  type ProjectView
} from '@/products/mind/features/mindmap/components/projects/ProjectsSidebar'
import { ProjectProvider } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { SaveFlowProvider, UnsavedGuard, useSaveFlowContext } from '@/shared/native'
import { useTabs, type OpenTab } from '@/shared/tabs/store'
import { tabInstances, tabDirty } from '@/shared/tabs/instances'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useLoading } from '@/shared/app-shared'
const LOCAL_ORG_ID = 'local'

export function WorkspaceShell() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const navigate = useNavigate()
  const location = useLocation()

  // URL <- activeId (deep-link)
  useEffect(() => {
    const target =
      activeId === 'home'
        ? '/'
        : tabs.find(t => t.id === activeId)?.kind === 'draft'
          ? '/editor/new'
          : `/editor/${activeId}`
    if (location.pathname !== target) navigate(target, { replace: true })
  }, [activeId, tabs, location.pathname, navigate])

  // 切 tab: 从 tabInstances 恢复 active tab 的 mindMap + dirty 到全局 store.
  // 离开的 tab 把当前 dirty 存进缓存.
  const prevActiveRef = useRef<string | null>(null)
  const { hideLoading } = useLoading()
  useEffect(() => {
    const prev = prevActiveRef.current
    if (prev && prev !== 'home' && prev !== activeId) {
      tabDirty.set(prev, useMindMapStore.getState().isDirty)
    }
    if (activeId === 'home') {
      // 回首页: 不动全局 mindMap (否则所有 hidden EditorPane 的 loading resolver
      // 会看到 hasMindMap=false 集体 showLoading, 卡住). 直接把全局 loading 关掉.
      hideLoading()
    } else {
      const instance = tabInstances.get(activeId) ?? null
      useMindMapStore.setState({
        mindMap: instance as never,
        isDirty: tabDirty.get(activeId)
      })
    }
    prevActiveRef.current = activeId
  }, [activeId, hideLoading])

  return (
    <div className="relative h-full w-full">
      <HomePane visible={activeId === 'home'} />
      {tabs.map(tab => (
        <EditorPane key={tab.id} tab={tab} visible={activeId === tab.id} />
      ))}
    </div>
  )
}

function HomePane({ visible }: { visible: boolean }) {
  const [activeView, setActiveView] = useState<ProjectView>('all')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [searchText, setSearchText] = useState('')

  const handleViewChange = useCallback((next: ProjectView) => {
    setActiveView(next)
    setActiveFolderId(null)
  }, [])

  const handleSelectFolder = useCallback((id: string) => {
    setActiveView('folder')
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
          onClearSearch={() => setSearchText('')}
          workspaceId={null}
          workspaceName={null}
        />
      </div>
    </div>
  )
}

function EditorPane({ tab, visible }: { tab: OpenTab; visible: boolean }) {
  return (
    <div className="absolute inset-0" hidden={!visible}>
      <SaveFlowProvider projectId={tab.id}>
        <EditorPaneInner id={tab.id} />
      </SaveFlowProvider>
    </div>
  )
}

function EditorPaneInner({ id }: { id: string }) {
  const saveFlow = useSaveFlowContext()
  return (
    <ProjectProvider key={id} workspaceId={id} cloudMode={false}>
      <MindMapCanvas />
      <UnsavedGuard projectId={id} saveFlow={saveFlow} />
    </ProjectProvider>
  )
}

