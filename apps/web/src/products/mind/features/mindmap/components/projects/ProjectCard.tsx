import { useCallback, useMemo, useState, type MouseEvent } from "react"
import {
  BrainCircuit,
  Edit,
  FolderInput,
  History,
  MoreHorizontal,
  Star,
  StarOff,
  Trash2,
} from "lucide-react"
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener"
import { motion } from "motion/react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import type { LocalProject } from "./project-model"
import useProjectPreview from "./hooks/useProjectPreview"
import useProjectStar from "./hooks/useProjectStar"
import useProjectUtils from "./hooks/useProjectUtils"

interface ProjectCardProps {
  project: LocalProject
  onRename?: (project: LocalProject) => void
  onDelete?: (project: LocalProject) => void
  onToggleFavorite?: (project: LocalProject) => void
  onUpdate?: () => void
  onProjectClick?: (project: LocalProject) => void
  onMove?: (project: LocalProject) => void
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const ProjectCard = ({
  project,
  onRename,
  onDelete,
  onToggleFavorite,
  onUpdate,
  onProjectClick,
  onMove,
}: ProjectCardProps) => {
  const { t } = useTranslation()
  const [isHovering, setIsHovering] = useState(false)
  const { isStarred: localIsStarred, toggleStar } = useProjectStar({ project, onUpdate })
  const isStarred = onToggleFavorite ? project.isStarred : localIsStarred
  const { getRelativeTime, getProjectColor } = useProjectUtils()
  const { previewImage, handleImageError } = useProjectPreview(project)

  const stopAndRun = useCallback(
    (action: ((project: LocalProject) => void) | undefined) => (event: MouseEvent) => {
      event.stopPropagation()
      action?.(project)
    },
    [project]
  )

  const handleStarToggle = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      if (onToggleFavorite) onToggleFavorite(project)
      else void toggleStar()
    },
    [onToggleFavorite, project, toggleStar]
  )

  const handleReveal = useCallback(
    async (event: MouseEvent) => {
      event.stopPropagation()
      try {
        await revealItemInDir(project.path)
      } catch {
        const directory = project.path.replace(/[\\/][^\\/]+$/, "")
        await openPath(directory)
      }
    },
    [project.path]
  )

  const stats = useMemo(
    () => [
      { value: getRelativeTime(project.updatedAt), label: t("projects.card.lastUpdated") },
      { value: formatSize(project.size), label: t("projects.card.fileSize", "文件大小") },
    ],
    [getRelativeTime, project.size, project.updatedAt, t]
  )

  return (
    <motion.div
      initial={{ scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      data-tour="project-card"
      data-testid="project-card"
      data-project-id={project.id}
      data-favorited={isStarred}
      className="cursor-pointer"
      onClick={() => onProjectClick?.(project)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="relative h-full overflow-hidden rounded-lg border border-border bg-card transition-shadow duration-300 hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden">
          <div
            className={`absolute right-3 top-3 z-20 transition-opacity ${isStarred || isHovering ? "opacity-100" : "opacity-0"}`}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 bg-card/90"
                      onClick={handleStarToggle}
                    >
                      {isStarred ? (
                        <Star className="size-[18px] text-warning" />
                      ) : (
                        <StarOff className="size-[18px]" />
                      )}
                    </Button>
                  }
                />
                <TooltipContent>
                  {isStarred ? t("projects.card.starRemove") : t("projects.card.starAdd")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex h-[calc(100%-80px)] w-full items-center justify-center overflow-hidden bg-muted">
            {previewImage ? (
              <img
                src={previewImage}
                alt={project.name}
                className="size-full object-cover"
                onError={handleImageError}
              />
            ) : (
              <div
                className="flex size-full items-center justify-center"
                style={{ backgroundColor: getProjectColor(project.id) }}
              >
                <BrainCircuit className="size-16 text-white/40" strokeWidth={1.2} />
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 h-20 bg-card p-4">
            <div className="absolute right-3 top-3">
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={event => event.stopPropagation()}
                    >
                      <MoreHorizontal className="size-5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleStarToggle}>
                    {isStarred ? (
                      <Star className="mr-2 size-4 text-warning" />
                    ) : (
                      <StarOff className="mr-2 size-4" />
                    )}
                    {isStarred ? t("projects.card.starRemove") : t("projects.card.starAdd")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={event => void handleReveal(event)}>
                    <FolderInput className="mr-2 size-4" />
                    {t("projects.card.revealInFolder", "打开所在文件夹")}
                  </DropdownMenuItem>
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
            <div className="truncate pr-8 text-lg font-medium" data-testid="project-card-title">
              {project.name}
            </div>
            <div className="mt-2 flex gap-4 text-muted-foreground">
              {stats.map(stat => (
                <span
                  key={stat.label}
                  className="flex items-center gap-1 text-sm"
                  title={stat.label}
                >
                  <History className="size-4" />
                  {stat.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default ProjectCard
