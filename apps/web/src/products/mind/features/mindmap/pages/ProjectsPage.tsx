// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- legacy cloud components use desktop no-op shims with narrower props
// @ts-nocheck
/**
 * 项目列表主区 — 欢迎语 + 统计卡（仅首页）+ 内容（按侧栏 view 驱动）。
 * 侧栏(ProjectsSidebar)与顶栏在路由层 projects.tsx。
 *
 * view 取值：all（全部导图）/ favorited（收藏）/ shared（分享给我）/ trash（回收站）/ folder（某文件夹）。
 */

import { useCallback } from "react"
import { LayoutGridIcon, ListIcon } from "lucide-react"

import { ProjectSort } from "@/products/mind/features/mindmap/components/projects/ProjectSort"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Button } from "@zoeymind/ui"
import { CloudProjectList } from "@/products/mind/features/mindmap/components/projects/CloudProjectList"
import { SharedWithMeList } from "@/products/mind/features/mindmap/components/projects/SharedWithMeList"
import { TrashList } from "@/products/mind/features/mindmap/components/projects/TrashList"
import { useProjects } from "@/products/mind/features/mindmap/components/projects/hooks/useProjects"
import { useViewType } from "@/products/mind/features/mindmap/components/projects/hooks/useViewType"
import { useFolders } from "@/products/mind/features/mindmap/components/projects/hooks/useFolders"
import type { ProjectView } from "@/products/mind/features/mindmap/components/projects/ProjectsSidebar"
import { useCurrentUser, NotificationBell, PageHeader } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"

type SortType = "recent" | "created" | "name" | "starred"

interface ProjectListPageProps {
  view: ProjectView
  folderId: string | null
  searchText: string
  onClearSearch?: () => void
  onProjectsChanged?: () => void
  /** 当前项目空间 ID; 传了则统计 & 列表按 workspace 过滤 */
  workspaceId?: string | null
  /** view=='workspace' 时用作 sectionTitle. */
  workspaceName?: string | null
}

export function ProjectListPage({
  view,
  folderId,
  searchText,
  onClearSearch,
  onProjectsChanged,
  workspaceId,
  workspaceName,
}: ProjectListPageProps) {
  const { t } = useTranslation()
  const { data: user } = useCurrentUser()

  const {
    projects: allProjects,
    refreshProjects,
    sortType,
    handleSortChange: setSortType,
  } = useProjects()
  const { viewType, toggleViewType } = useViewType()
  const { folders } = useFolders()

  const totalCount = allProjects.length

  const handleProjectsChanged = useCallback(() => {
    onProjectsChanged?.()
    void refreshProjects()
  }, [onProjectsChanged, refreshProjects])

  // ─── 视图配置 ─────────────────────────────────────
  const effectiveSort: SortType = sortType as SortType
  const showOverview = view === "all"
  const showSort = view !== "shared" && view !== "trash"

  const sectionTitle =
    view === "mine"
      ? t("projects.home.navMine")
      : view === "favorited"
        ? t("projects.home.navFavorited")
        : view === "shared"
          ? t("projects.home.navShared")
          : view === "trash"
            ? t("projects.home.navTrash")
            : view === "folder"
              ? (folders.find(f => f.id === folderId)?.name ?? t("projects.home.folderTitle"))
              : view === "workspace"
                ? (workspaceName ?? t("project.workspacePlural", "项目空间"))
                : t("projects.home.navAll")

  const renderList = () => {
    if (view === "favorited") {
      return (
        <CloudProjectList
          viewType={viewType}
          searchText={searchText}
          sortType={effectiveSort}
          filter="favorited"
          onProjectsChanged={handleProjectsChanged}
          onClearSearch={onClearSearch}
          workspaceId={workspaceId ?? undefined}
        />
      )
    }
    if (view === "mine") {
      return (
        <CloudProjectList
          viewType={viewType}
          searchText={searchText}
          sortType={effectiveSort}
          filter="mine"
          onProjectsChanged={handleProjectsChanged}
          onClearSearch={onClearSearch}
        />
      )
    }
    if (view === "shared") {
      return <SharedWithMeList viewType={viewType} searchText={searchText} />
    }
    if (view === "trash") {
      return <TrashList searchText={searchText} onChanged={handleProjectsChanged} />
    }
    return (
      <CloudProjectList
        viewType={viewType}
        searchText={searchText}
        sortType={effectiveSort}
        filter="all"
        folderId={view === "folder" ? (folderId ?? undefined) : undefined}
        onProjectsChanged={handleProjectsChanged}
        onClearSearch={onClearSearch}
        workspaceId={workspaceId ?? undefined}
      />
    )
  }

  return (
    <>
      <div
        data-testid="projects-page"
        className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-auto bg-muted/30"
      >
        <div className="mx-auto w-full max-w-6xl px-8 py-6">
          {/* 页面 header: 无框, 左标题+描述, 右 slot (通知铃 + 视图/排序按钮) */}
          <PageHeader
            className="mb-6"
            title={
              showOverview ? t("projects.home.welcome", { name: user?.name ?? "" }) : sectionTitle
            }
            description={
              showOverview ? t("projects.home.welcomeSubtitle", { count: totalCount }) : undefined
            }
            actions={
              <>
                {showSort && (
                  <ProjectSort sortType={sortType} onSortChange={key => setSortType(key)} />
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground"
                          onClick={toggleViewType}
                          aria-label={
                            viewType === "grid"
                              ? t("projects.page.viewListLabel")
                              : t("projects.page.viewGridLabel")
                          }
                        >
                          {viewType === "grid" ? (
                            <ListIcon className="size-4" />
                          ) : (
                            <LayoutGridIcon className="size-4" />
                          )}
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {viewType === "grid"
                        ? t("projects.page.viewListLabel")
                        : t("projects.page.viewGridLabel")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <NotificationBell />
              </>
            }
          />

          {/* 列表 */}
          {renderList()}
        </div>
      </div>
    </>
  )
}
