/** Desktop project sidebar: local projects, favorites, folders, and test-case rules. */
import { BookOpen, LayoutGrid, Star, PanelLeftClose } from "lucide-react"
import { cn, Button } from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { NewProjectMenu } from "./NewProjectMenu"
import { SidebarFolders } from "./SidebarFolders"
import brandLogo from "@/assets/logo.svg?url"
import { AppVersionStatus } from "@/shared/app-shared"

export type ProjectView = "all" | "favorited" | "folder"

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
}: ProjectsSidebarProps) {
  const { t } = useTranslation()

  return (
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
          <NewProjectMenu onCreated={onCreated} />
        </div>

        {/* Local navigation and folders. */}
        <nav className="no-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {MAIN_NAV.map(item => {
            const Icon = item.icon
            const active = activeView === item.view
            return (
              <Button
                key={item.view}
                type="button"
                variant="ghost"
                onClick={() => onViewChange(item.view)}
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
  )
}
