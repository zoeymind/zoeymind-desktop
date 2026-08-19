/**
 * RecoveryDialog —— App boot 时扫 `<appData>/recovery/*.zmind`。
 *
 * 若列出的每条 recovery：
 *   - Reopen：从 recovery 里读回 tree/meta，若 sourcePath 仍存在就把 .zmind
 *     覆盖回原路径并把 recovery 删掉，然后跳编辑器；若 sourcePath 缺失（源被删）
 *     就走"另存为"落新路径 + 重新入库 → 再删 recovery。
 *   - Discard：仅删 recovery 文件，不动源，不入库。
 *
 * 弹框会一次展示所有异常 recovery，用户可逐项处理，处理完自动关闭。
 */
import { useEffect, useState } from "react"
import { Clock3, FileWarning, FolderOpen, Trash2 } from "lucide-react"
import { useLocale, useTranslation } from "@zoeymind/i18n"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@zoeymind/ui"
import { router } from "@/routes"
import { toast, createUUID } from "@/shared/app-shared"
import {
  listRecoveries,
  readRecoveryBundle,
  clearRecovery,
  writeBundle,
  registerProject,
  findByPath,
  refreshProjectIndex,
  defaultVaultDir,
  type RecoveryDescriptor,
} from "@/shared/native"
import { exists, mkdir } from "@tauri-apps/plugin-fs"
import { save as saveDialog } from "@tauri-apps/plugin-dialog"
import { join } from "@tauri-apps/api/path"

export function RecoveryDialog() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [items, setItems] = useState<RecoveryDescriptor[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const list = await listRecoveries()
        setItems(list)
      } catch {
        setItems([])
      }
    })()
  }, [])

  const closeIfEmpty = (next: RecoveryDescriptor[]) => {
    if (next.length === 0) setItems(null)
    else setItems(next)
  }

  const handleReopen = async (desc: RecoveryDescriptor) => {
    setBusyId(desc.projectId)
    try {
      const bundle = await readRecoveryBundle(desc.projectId)
      if (!bundle) throw new Error("recovery bundle missing")

      let targetPath = desc.sourcePath
      if (!targetPath || !(await exists(targetPath))) {
        const picked = await saveDialog({
          defaultPath: await join(await defaultVaultDir(), `${desc.name || "recovered"}.zmind`),
          filters: [{ name: "ZoeyMind", extensions: ["zmind"] }],
        })
        if (!picked) {
          setBusyId(null)
          return
        }
        targetPath = picked
      }

      await writeBundle(targetPath, bundle)

      const existing = await findByPath(targetPath)
      let id = existing?.id ?? desc.projectId
      if (existing) {
        await refreshProjectIndex(existing.id, {
          name: bundle.meta.name,
          nodeCount: bundle.meta.nodeCount,
        })
      } else {
        id = createUUID()
        const dir = await defaultVaultDir()
        if (!(await exists(dir))) await mkdir(dir, { recursive: true })
        await registerProject({
          id,
          path: targetPath,
          name: bundle.meta.name,
          nodeCount: bundle.meta.nodeCount,
        })
      }

      await clearRecovery(desc.projectId)
      toast.success(t("recovery.restored"))
      closeIfEmpty((items ?? []).filter(i => i.projectId !== desc.projectId))
      await router.navigate(`/editor/${id}`)
    } catch (error) {
      toast.error(t("recovery.restoreFailed", { message: (error as Error).message }))
    } finally {
      setBusyId(null)
    }
  }

  const handleDiscard = async (desc: RecoveryDescriptor) => {
    setBusyId(desc.projectId)
    try {
      await clearRecovery(desc.projectId)
      closeIfEmpty((items ?? []).filter(i => i.projectId !== desc.projectId))
    } finally {
      setBusyId(null)
    }
  }

  if (!items || items.length === 0) return null

  return (
    <Dialog open>
      <DialogContent size="lg" showCloseButton={false} className="gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileWarning className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{t("recovery.title", { count: items.length })}</DialogTitle>
              <DialogDescription className="text-pretty">
                {t("recovery.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ul className="max-h-[min(60vh,28rem)] divide-y overflow-y-auto">
          {items.map(desc => {
            const busy = busyId !== null
            return (
              <li key={desc.projectId} className="flex items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate font-medium">{desc.name || t("recovery.untitled")}</p>
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {desc.sourcePath ?? t("recovery.sourceMissing")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    <time dateTime={new Date(desc.savedAt).toISOString()}>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(desc.savedAt))}
                    </time>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleDiscard(desc)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                    {t("recovery.discard")}
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => void handleReopen(desc)}>
                    {busyId === desc.projectId ? t("recovery.restoring") : t("recovery.restore")}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="border-t bg-muted/30 px-6 py-3 text-xs text-muted-foreground">
          {t("recovery.discardWarning")}
        </p>
      </DialogContent>
    </Dialog>
  )
}
