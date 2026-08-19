// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
/**
 * MoveDialog —— 桌面端虚拟文件夹分类。
 *
 * 移动只更新 projects_index.folder_id，不改变用户磁盘上的 .zmind 路径。
 *
 * 交互:
 *   - 顶部标题 + 项目名副标题
 *   - 中间 radio 列表: (无文件夹) + 所有 folders
 *   - 底部 取消 / 移动 主操作按钮
 */
import { useEffect, useState } from "react"
import { Check, Folder as FolderIcon, FolderMinus, Loader2 } from "lucide-react"
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoeymind/ui"
import { toast } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"
import { useFolders } from "./hooks/useFolders"
import { moveProjectToFolder, bumpProjects } from "@/shared/native"
import type { CloudProjectWithStats } from "./hooks/useCloudProjects"

interface MoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: CloudProjectWithStats | null
  onMoved?: () => void
}

export function MoveDialog({ open, onOpenChange, project, onMoved }: MoveDialogProps) {
  const { t } = useTranslation()
  const { folders } = useFolders()
  const currentFolderId = project?.folderId ?? null
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId)
  const [busy, setBusy] = useState(false)

  // Dialog 每次打开时同步选中当前项目所在文件夹.
  useEffect(() => {
    if (open) setSelectedFolderId(currentFolderId)
  }, [open, currentFolderId])

  if (!project) return null

  const changed = selectedFolderId !== currentFolderId

  const handleConfirm = async () => {
    if (!changed || busy) return
    setBusy(true)
    try {
      await moveProjectToFolder(project.id, selectedFolderId)
      bumpProjects()
      toast.success(t("projects.home.moveSuccess", "已移动"))
      onMoved?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: string }).message)
          : t("projects.home.moveFailed", "移动失败")
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => (!busy ? onOpenChange(o) : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("projects.home.moveTo", "移动到")}</DialogTitle>
          <DialogDescription className="truncate">
            {project.name ?? project.title ?? ""}
          </DialogDescription>
        </DialogHeader>

        <div className="no-scrollbar max-h-72 space-y-1 overflow-y-auto py-1">
          <FolderRow
            icon={FolderMinus}
            label={t("projects.home.moveOutFolder", "无文件夹 (根目录)")}
            active={selectedFolderId === null}
            onSelect={() => setSelectedFolderId(null)}
          />
          {folders.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t("projects.home.noFolderToMove", "暂无文件夹, 请先在侧栏创建一个.")}
            </p>
          ) : (
            folders.map(f => (
              <FolderRow
                key={f.id}
                icon={FolderIcon}
                label={f.name}
                active={selectedFolderId === f.id}
                onSelect={() => setSelectedFolderId(f.id)}
              />
            ))
          )}
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "取消")}
          </Button>
          <Button onClick={handleConfirm} disabled={!changed || busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1 size-3.5 animate-spin" />
                {t("common.processing", "处理中...")}
              </>
            ) : (
              t("projects.home.moveTo", "移动到")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface FolderRowProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onSelect: () => void
}

function FolderRow({ icon: Icon, label, active, onSelect }: FolderRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  )
}
