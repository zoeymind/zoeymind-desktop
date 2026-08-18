/**
 * WorkspaceShell —— tabs 主内容区.
 *
 * Home 区 (ProjectListShell) 始终 mounted, 只是根据 activeId 决定 visible;
 * 每个 open editor tab 也 mounted 到自己的容器, 通过 CSS 显示/隐藏,
 * 达到 VS Code 风格的 keep-alive 效果.
 *
 * 注意: useMindMapStore 是全局单例, 只有 active tab 的 MindMapCanvas 通过
 * `isActive` prop 触发 setMindMap; 其它 tab 的 canvas 保留 DOM 但不占用全局
 * store 的 mindMap 引用.
 */
import { useCallback, useState } from 'react'
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

const LOCAL_ORG_ID = 'local'

export function WorkspaceShell() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
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
    <div
      className="absolute inset-0 flex bg-background"
      // 用 hidden 而非 display:none, 更语义化, tailwind 会加 display:none.
      hidden={!visible}
    >
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
  // useMindMapStore 是全局单例, 同时挂多个 canvas 会互相踩 setMindMap.
  // v1: 只有 active tab 挂完整子树, 切走时卸载 (~1s reload). 未来可以改成
  // 每 tab 独立 mindmap-store + 全局代理才能真 keep-alive.
  if (!visible) return null
  return (
    <div className="absolute inset-0">
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
