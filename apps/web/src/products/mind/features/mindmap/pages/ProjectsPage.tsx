/** Desktop project list: all, favorites, and local folders. */

import { useCallback } from "react"
import { LayoutGridIcon, ListIcon } from "lucide-react"

import { ProjectSort } from "@/products/mind/features/mindmap/components/projects/ProjectSort"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Button } from "@zoeymind/ui"
import { LocalProjectList } from "@/products/mind/features/mindmap/components/projects/LocalProjectList"
import { useProjects } from "@/products/mind/features/mindmap/components/projects/hooks/useProjects"
import { useViewType } from "@/products/mind/features/mindmap/components/projects/hooks/useViewType"
import { useFolders } from "@/products/mind/features/mindmap/components/projects/hooks/useFolders"
import type { ProjectView } from "@/products/mind/features/mindmap/components/projects/ProjectsSidebar"
import { useCurrentUser } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"

type SortType = "recent" | "created" | "name" | "starred"

interface ProjectListPageProps {
  view: ProjectView
  folderId: string | null
  searchText: string
  onClearSearch?: () => void
  onProjectsChanged?: () => void
  /** Retained by the route shell; desktop lists are not workspace-scoped. */
  workspaceId?: string | null
  workspaceName?: string | null
}

export function ProjectListPage({
  view,
  folderId,
  searchText,
  onClearSearch,
  onProjectsChanged,
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

  const effectiveSort: SortType = sortType
  const showOverview = view === "all"
  const sectionTitle =
    view === "favorited"
      ? t("projects.home.navFavorited")
      : view === "folder"
        ? (folders.find(folder => folder.id === folderId)?.name ?? t("projects.home.folderTitle"))
        : t("projects.home.navAll")

  const renderList = () => (
    <LocalProjectList
      viewType={viewType}
      searchText={searchText}
      sortType={effectiveSort}
      filter={view === "favorited" ? "favorited" : "all"}
      folderId={view === "folder" ? (folderId ?? undefined) : undefined}
      onProjectsChanged={handleProjectsChanged}
      onClearSearch={onClearSearch}
    />
  )

  return (
    <>
      <div
        data-testid="projects-page"
        className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-auto bg-muted/30"
      >
        <div className="mx-auto w-full max-w-6xl px-8 py-6">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">
                {showOverview
                  ? t("projects.home.welcome", { name: user?.name ?? "" })
                  : sectionTitle}
              </h1>
              {showOverview && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("projects.home.welcomeSubtitle", { count: totalCount })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ProjectSort sortType={sortType} onSortChange={key => setSortType(key)} />
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
            </div>
          </header>

          {/* 列表 */}
          {renderList()}
        </div>
      </div>
    </>
  )
}
