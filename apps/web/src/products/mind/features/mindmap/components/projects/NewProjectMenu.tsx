import { useCallback, useRef } from "react"
import { ChevronDownIcon, FileUpIcon, FolderOpenIcon, PlusIcon, SparklesIcon } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { logger } from "@zoeymind/logger"
import { toast } from "@/shared/app-shared"
import { open as openDialog } from "@tauri-apps/plugin-dialog"

import { useCreateProject } from "./hooks/useCreateProject"
import { openZmindProject } from "@/shared/native"
import { IMPORT_ACCEPT } from "@/products/mind/features/mindmap/utils/fileFormats"

interface NewProjectMenuProps {
  onCreated?: (newId: string) => void
}

export function NewProjectMenu({ onCreated }: NewProjectMenuProps) {
  const { t } = useTranslation()
  const importInputRef = useRef<HTMLInputElement>(null)
  const importFormatRef = useRef<"standard" | "zm">("standard")
  const { creating, createBlank, createFromImport } = useCreateProject({ onCreated })

  const handleOpenExisting = useCallback(async () => {
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: "ZoeyMind", extensions: ["zmind"] }],
      })
      if (!picked || typeof picked !== "string") return
      const { id } = await openZmindProject(picked)
      onCreated?.(id)
    } catch (error) {
      logger.error("open .zmind failed", error)
      toast.error(t("mindmap.editor.openFailed", "打开文件失败"))
    }
  }, [onCreated, t])

  const chooseImport = useCallback((format: "standard" | "zm") => {
    importFormatRef.current = format
    importInputRef.current?.click()
  }, [])

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) await createFromImport(file, importFormatRef.current)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton
          render={
            <Button
              disabled={creating}
              className="w-full justify-between"
              data-testid="new-mindmap"
              data-tour="new-project-menu"
            >
              <span className="flex items-center">
                <PlusIcon className="mr-1.5 size-4" />
                {t("projects.newMenu.trigger", "新项目")}
              </span>
              <ChevronDownIcon className="size-4 opacity-80" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-[260px]">
          <DropdownMenuItem onClick={() => void createBlank()}>
            <SparklesIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>{t("projects.newMenu.blank", "新建")}</span>
              <span className="text-xs text-muted-foreground">
                {t("projects.newMenu.blankDesc", "创建一个空白思维导图")}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleOpenExisting()}>
            <FolderOpenIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>{t("projects.newMenu.open", "打开")}</span>
              <span className="text-xs text-muted-foreground">
                {t("projects.newMenu.openDesc", "从磁盘选择一个 .zmind 文件")}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => chooseImport("standard")}>
            <FileUpIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>{t("projects.newMenu.import", "导入文件")}</span>
              <span className="text-xs text-muted-foreground">
                {t("projects.newMenu.importDesc", "从 XMind、Markdown 或嵌套 ZIP 文件创建")}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => chooseImport("zm")}>
            <FileUpIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>{t("projects.newMenu.importMsXmind", "导入 MeterSphere XMind")}</span>
              <span className="text-xs text-muted-foreground">
                {t("projects.newMenu.importMsXmindDesc", "导入 MeterSphere 用例格式")}
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={importInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={handleFile}
        aria-label={t("projects.newMenu.import", "导入文件")}
      />

      <Dialog
        open={creating}
        onOpenChange={(_, details) => {
          if (details.reason === "outside-press" || details.reason === "escape-key") {
            details.cancel()
          }
        }}
      >
        <DialogContent className="sm:max-w-[380px] [&>button]:hidden">
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="relative flex size-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
                style={{ animationDuration: "900ms" }}
              />
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                <SparklesIcon className="size-4 text-primary" />
              </div>
            </div>
            <div className="space-y-1.5 text-center">
              <DialogTitle className="text-base font-semibold tracking-tight">
                {t("projects.actions.creatingTitle")}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t("projects.actions.creatingDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
