/* eslint-disable @typescript-eslint/ban-ts-comment -- legacy cloud/collab file remains intentionally unchecked */
// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
/**
 * Mind projects 侧栏.
 *
 * 结构 (从上到下):
 *   1. 品牌 (AppBrandBar variant=vertical)
 *   2. 搜索按钮 (点击/⌘K 弹 WorkspaceSearchDialog)
 *   3. 主导航: 全部导图 / 收藏 / 分享给我 (view 切换)
 *   4. 项目空间分组: 列出所有可访问 workspace, 点击切换 filter
 *      - 每行显示 avatar + 名字 + ⚙ 打开设置 (悬停显示)
 *      - "全部" 是虚拟项 workspaceId=null, 已在主导航顶部
 *   5. 文件夹分组 (SidebarFolders)
 *   6. 回收站
 *   7. + 新建按钮
 *   8. 底部账户菜单
 *
 * 通知铃在页面 PageHeader 右上, 不在 sidebar 内.
 */
import {
  BookOpen,
  LayoutGrid,
  Star,
  Search as SearchIcon,
  PanelLeftClose,
  Plus,
} from "lucide-react"
import { cn, Button } from "@zoeymind/ui"
import { useState } from "react"
import { useTranslation } from "@zoeymind/i18n"
import {
  CreateProjectDialog,
  ProjectSettingsDialog,
  type WorkspaceOption,
} from "@/shared/organization"
import { WorkspaceAvatar } from "@/shared/auth"
import { NewProjectMenu } from "./NewProjectMenu"
import { SidebarFolders } from "./SidebarFolders"
import { SearchShortcutHint } from "./WorkspaceSearchDialog"
import brandLogo from "@/assets/logo.svg?url"
import { AppVersionStatus } from "@/shared/app-shared"

export type ProjectView = "all" | "mine" | "favorited" | "shared" | "trash" | "folder" | "workspace"

interface ProjectsSidebarProps {
  activeView: ProjectView
  activeFolderId: string | null
  onViewChange: (view: ProjectView) => void
  onSelectFolder: (id: string) => void
  onCreated?: () => void
  rulesOpen: boolean
  onOpenRules: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  /** 当前选中的 workspace id; null 表示"全部导图" filter. */
  activeWorkspaceId: string | null
  /** 组织下的 workspace 列表 (从 useCurrentWorkspace 传入). */
  workspaces: WorkspaceOption[]
  /** 切换 workspace filter — 传 null 切到"全部导图". */
  onSelectWorkspace: (workspaceId: string | null) => void
  /** 触发全局搜索 (⌘K / 点击). */
  onOpenSearch: () => void
  /** 组织 ID (创建新 workspace 时用). */
  organizationId: string
  /** 是否有权限创建 workspace (OWNER/ADMIN). */
  canCreateWorkspace: boolean
  /** 新建 workspace 成功后回调 (切换到新 workspace). */
  onWorkspaceCreated?: (workspaceId: string) => void
}

// 桌面端本地视图：全部 / 收藏（去掉云端"分享给我" 和 "回收站"）
const MAIN_NAV: { view: ProjectView; icon: typeof LayoutGrid; labelKey: string }[] = [
  { view: "all", icon: LayoutGrid, labelKey: "projects.home.navAll" },
  { view: "favorited", icon: Star, labelKey: "projects.home.navFavorited" },
]

export function ProjectsSidebar({
  activeView,
  activeFolderId,
  onViewChange,
  onSelectFolder,
  onCreated,
  rulesOpen,
  onOpenRules,
  collapsed,
  onToggleCollapse,
  activeWorkspaceId,
  workspaces,
  onSelectWorkspace,
  onOpenSearch,
  organizationId,
  canCreateWorkspace,
  onWorkspaceCreated,
}: ProjectsSidebarProps) {
  const { t } = useTranslation()
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <aside
        className={cn(
          "shrink-0 overflow-hidden border-r bg-muted/30 transition-[width] duration-200",
          collapsed ? "w-0 border-r-0" : "w-60"
        )}
      >
        <div className="flex h-full w-60 flex-col">
          {/* 顶部品牌 + 折叠按钮 */}
          <div className="flex items-start gap-2 border-b border-border/50 p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <img src={brandLogo} alt="ZoeyMind" className="size-6 shrink-0" />
              <span className="truncate text-sm font-semibold">ZoeyMind</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={onToggleCollapse}
              aria-label={t("projects.home.collapseSidebar")}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>

          {/* 新建按钮 */}
          <div className="px-3 pt-3 pb-2">
            <NewProjectMenu
              onCreated={onCreated}
              workspaceId={
                activeView === "mine" || activeView === "shared"
                  ? undefined
                  : (activeWorkspaceId ?? undefined)
              }
            />
          </div>

          {/* 搜索按钮 (⌘K 触发) */}
          <div className="px-3 pb-2">
            <Button
              variant="outline"
              className="h-9 w-full justify-start gap-2 text-sm text-muted-foreground font-normal"
              onClick={onOpenSearch}
              aria-label={t("projects.search.button", "搜索思维导图")}
            >
              <SearchIcon className="size-4 shrink-0" />
              <span className="flex-1 text-left truncate">
                {t("projects.search.button", "搜索思维导图")}
              </span>
              <SearchShortcutHint />
            </Button>
          </div>

          {/* 主导航 + workspace 分组 + folders */}
          <nav className="no-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
            {MAIN_NAV.map(item => {
              const Icon = item.icon
              const active = activeView === item.view
              return (
                <Button
                  key={item.view}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    // 顶部导航 (跨 workspace 视图) → 清 workspaceId, 让 workspace 项不再高亮
                    onSelectWorkspace(null)
                    onViewChange(item.view)
                  }}
                  className={cn(
                    "h-auto w-full justify-start gap-2.5 rounded-md px-2.5 py-2 text-sm",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {t(item.labelKey)}
                </Button>
              )
            })}

            {(workspaces.length > 0 || canCreateWorkspace) && (
              <>
                <div className="mt-3 mb-1 flex items-center justify-between px-2.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {t("projects.sidebar.groupShared")}
                  </span>
                  {canCreateWorkspace && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setCreateOpen(true)}
                      aria-label={t("project.switcher.newProject")}
                      data-testid="create-project"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Plus className="size-4" />
                    </Button>
                  )}
                </div>
                {workspaces.map(w => (
                  <WorkspaceItem
                    key={w.id}
                    workspace={w}
                    // Workspace 分组 = 独立 view=workspace, 与顶部主导航互斥
                    active={activeWorkspaceId === w.id && activeView === "workspace"}
                    onSelect={() => {
                      onSelectWorkspace(w.id)
                      onViewChange("workspace")
                    }}
                    onOpenSettings={() => setSettingsProjectId(w.id)}
                  />
                ))}
              </>
            )}

            <SidebarFolders
              active={activeView === "folder"}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
            />
          </nav>
          <div className="shrink-0 border-t border-border/50 px-2 py-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onOpenRules}
              className={cn(
                "h-9 w-full justify-start gap-2.5 rounded-md px-2.5 text-sm",
                rulesOpen
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              <BookOpen className="size-4 shrink-0" aria-hidden="true" />
              {t("projects.rules.entry")}
            </Button>
          </div>
          <div className="flex shrink-0 items-center border-t border-border/50 px-2 py-1">
            <AppVersionStatus className="justify-start" />
          </div>
        </div>
      </aside>

      {settingsProjectId && (
        <ProjectSettingsDialog
          open={!!settingsProjectId}
          onOpenChange={o => !o && setSettingsProjectId(null)}
          workspaceId={settingsProjectId}
        />
      )}

      <CreateProjectDialog
        organizationId={organizationId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={id => onWorkspaceCreated?.(id)}
      />
    </>
  )
}

function WorkspaceItem({
  workspace,
  active,
  onSelect,
  onOpenSettings,
}: {
  workspace: WorkspaceOption
  active: boolean
  onSelect: () => void
  onOpenSettings: () => void
}) {
  return (
    <div
      data-testid="workspace-item"
      data-workspace-name={workspace.name}
      className={cn(
        "group flex items-center gap-2 rounded-md py-1.5 px-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground hover:bg-primary/5 hover:text-primary"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onSelect}
        className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-0 text-left hover:bg-transparent"
      >
        <WorkspaceAvatar workspace={workspace} size="xs" />
        <span className="truncate">{workspace.name}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-primary/10"
        onClick={onOpenSettings}
        data-testid="workspace-settings"
        aria-label="settings"
      >
        <Settings className="size-3.5" />
      </Button>
    </div>
  )
}
