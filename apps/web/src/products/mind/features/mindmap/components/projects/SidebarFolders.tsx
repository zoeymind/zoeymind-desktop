import { useState } from "react"
import { Folder as FolderIcon, FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { useFolders, type FolderItem } from "./hooks/useFolders"
import { RenameDialog } from "./dialogs"

interface SidebarFoldersProps {
  /** 当前是否处于「文件夹」视图 */
  active: boolean
  activeFolderId: string | null
  onSelectFolder: (id: string) => void
}

/**
 * 侧栏文件夹分区：列表 + 新建/重命名/删除（组织级，扁平）。
 * 复用 RenameDialog（新建/重命名）与 DeleteDialog（删除）。
 */
export function SidebarFolders({ active, activeFolderId, onSelectFolder }: SidebarFoldersProps) {
  const { t } = useTranslation()
  const { folders, createFolder, renameFolder, deleteFolder, isMutating } = useFolders()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FolderItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FolderItem | null>(null)

  return (
    <div className="px-2">
      <div className="mt-3 mb-1 flex items-center justify-between px-2.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {t("projects.sidebar.groupPersonal")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setCreateOpen(true)}
          aria-label={t("projects.home.newFolder")}
          data-testid="new-folder"
          className="text-muted-foreground hover:text-foreground"
        >
          <FolderPlus className="size-4" />
        </Button>
      </div>

      {folders.length === 0 ? (
        <p className="px-2.5 py-1 text-xs text-muted-foreground/70">
          {t("projects.home.noFolders")}
        </p>
      ) : (
        folders.map(f => {
          const isActive = active && activeFolderId === f.id
          return (
            <div
              key={f.id}
              data-testid="folder-row"
              data-folder-name={f.name}
              className={cn(
                "group flex items-center rounded-md",
                isActive ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSelectFolder(f.id)}
                className={cn(
                  "h-auto min-w-0 flex-1 justify-start gap-2.5 px-2.5 py-2 text-sm hover:bg-transparent",
                  isActive ? "font-medium text-accent-foreground" : "text-muted-foreground"
                )}
              >
                <FolderIcon className="size-4 shrink-0" />
                <span className="flex-1 truncate text-left">{f.name}</span>
                {f.mindmapCount > 0 && (
                  <span className="text-xs text-muted-foreground/70">{f.mindmapCount}</span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="mr-1 text-muted-foreground opacity-0 group-hover:opacity-100"
                      aria-label={t("projects.home.rename")}
                      data-testid="folder-menu"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setRenameTarget(f)}
                    data-testid="folder-rename"
                    className="gap-2"
                  >
                    <Pencil className="size-4" />
                    {t("projects.home.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(f)}
                    data-testid="folder-delete"
                    className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })
      )}

      <RenameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        currentName=""
        title={t("projects.home.newFolder")}
        description={t("projects.home.newFolderDesc")}
        onConfirm={async name => {
          await createFolder(name)
        }}
        loading={isMutating}
      />

      <RenameDialog
        open={!!renameTarget}
        onOpenChange={open => !open && setRenameTarget(null)}
        currentName={renameTarget?.name ?? ""}
        title={t("projects.home.renameFolder")}
        onConfirm={async name => {
          if (renameTarget) await renameFolder(renameTarget.id, name)
        }}
        loading={isMutating}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {t("projects.home.deleteFolderTitle", { itemName: deleteTarget?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("projects.home.deleteFolderDesc")}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null)
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={isMutating}
              data-testid="folder-delete-confirm"
              onClick={async () => {
                if (deleteTarget) await deleteFolder(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
