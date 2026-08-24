import { useCallback, useState, type MouseEvent } from "react"
import {
  BrainCircuit,
  Calendar,
  Edit,
  FolderInput,
  GitBranch,
  History,
  MoreHorizontal,
  Star,
  StarOff,
  Trash2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import type { LocalProject } from "./project-model"
import useProjectPreview from "./hooks/useProjectPreview"
import useProjectStar from "./hooks/useProjectStar"
import useProjectUtils from "./hooks/useProjectUtils"

interface ProjectListItemProps {
  project: LocalProject
  onRename?: (project: LocalProject) => void
  onDelete?: (project: LocalProject) => void
  onToggleFavorite?: (project: LocalProject) => void
  onUpdate?: () => void
  onProjectClick?: (project: LocalProject) => void
  onMove?: (project: LocalProject) => void
}

export const ProjectListItem = ({
  project,
  onRename,
  onDelete,
  onToggleFavorite,
  onUpdate,
  onProjectClick,
  onMove,
}: ProjectListItemProps) => {
  const { t } = useTranslation()
  const [isHovering, setIsHovering] = useState(false)
  const { isStarred: localIsStarred, toggleStar } = useProjectStar({ project, onUpdate })
  const isStarred = onToggleFavorite ? project.isStarred : localIsStarred
  const { getRelativeTime, getProjectColor } = useProjectUtils()
  const { previewImage, handleImageError } = useProjectPreview(project)

  const handleStar = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      if (onToggleFavorite) onToggleFavorite(project)
      else void toggleStar(event)
    },
    [onToggleFavorite, project, toggleStar]
  )

  const stopAndRun = useCallback(
    (action: ((project: LocalProject) => void) | undefined) => (event: MouseEvent) => {
      event.stopPropagation()
      action?.(project)
    },
    [project]
  )

  return (
    <div
      className={`cursor-pointer rounded-lg border transition-colors ${isHovering ? "border-primary" : "border-transparent"}`}
      onClick={() => onProjectClick?.(project)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="grid grid-cols-11 items-center gap-4 p-4">
        <div
          className="col-span-1 flex size-10 items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: getProjectColor(project.id) }}
        >
          {previewImage ? (
            <img
              src={previewImage}
              alt={project.name}
              onError={handleImageError}
              className="size-full object-cover"
            />
          ) : (
            <BrainCircuit className="size-5 text-white/70" />
          )}
        </div>

        <div className="col-span-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-base font-medium">{project.name}</div>
            {isStarred && <Star className="size-4 text-warning" />}
          </div>
        </div>

        <div className="col-span-2 flex items-center text-muted-foreground">
          <Calendar className="mr-1 size-4" />
          <span className="text-sm">{project.createdAt.toLocaleDateString()}</span>
        </div>

        <div
          className="col-span-1 flex items-center justify-center text-muted-foreground"
          title={t("projects.card.testCaseCount")}
        >
          <GitBranch className="mr-1 size-4" />
          <span className="text-sm">{project.nodeCount}</span>
        </div>

        <div className="col-span-2 flex items-center text-muted-foreground">
          <History className="mr-1 size-4" />
          <span className="text-sm">{getRelativeTime(project.updatedAt)}</span>
        </div>

        <div className="col-span-1 flex items-center justify-end gap-2">
          <button
            type="button"
            className={`size-5 ${isHovering || isStarred ? "visible" : "invisible"}`}
            onClick={handleStar}
            aria-label={isStarred ? t("projects.card.starRemove") : t("projects.card.starAdd")}
          >
            {isStarred ? (
              <Star className="size-5 text-warning" />
            ) : (
              <StarOff className="size-5 text-muted-foreground" />
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton
              render={
                <button type="button" className="size-5" onClick={event => event.stopPropagation()}>
                  <MoreHorizontal className="size-5 text-muted-foreground" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={stopAndRun(onRename)}>
                <Edit className="mr-2 size-4" />
                {t("projects.card.rename")}
              </DropdownMenuItem>
              {onMove && (
                <DropdownMenuItem onClick={stopAndRun(onMove)}>
                  <FolderInput className="mr-2 size-4" />
                  {t("projects.home.moveTo")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={stopAndRun(onDelete)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default ProjectListItem
