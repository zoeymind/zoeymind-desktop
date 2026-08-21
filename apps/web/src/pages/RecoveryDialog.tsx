import { useEffect, useState } from "react"
import { Clock3, FileWarning, FolderOpen } from "lucide-react"
import { useLocale, useTranslation } from "@zoeymind/i18n"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@zoeymind/ui"
import {
  resolveRecoverySelection,
  scanRecoveries,
  type RecoveryDescriptor,
  type RecoveryScan,
} from "@/shared/native"

export function RecoveryDialog() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [scan, setScan] = useState<RecoveryScan | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void scanRecoveries()
      .then(result => {
        setScan(result)
        setSelectedIds(new Set(result.valid.map(item => item.projectId)))
      })
      .catch(() => setScan({ valid: [], corrupt: [] }))
  }, [])

  const resolveSelection = async () => {
    if (!scan || busy) return
    setBusy(true)
    try {
      const result = await resolveRecoverySelection(scan, selectedIds)
      if (result.failed.length === 0) {
        setDismissed(true)
        return
      }
      const failedIds = new Set(result.failed.map(item => item.recoveryId))
      setScan({
        valid: scan.valid.filter(item => failedIds.has(item.projectId)),
        corrupt: [],
      })
      setSelectedIds(failedIds)
    } finally {
      setBusy(false)
    }
  }

  const toggleSelected = (projectId: string, checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (checked) next.add(projectId)
      else next.delete(projectId)
      return next
    })
  }

  if (dismissed || !scan || (scan.valid.length === 0 && scan.corrupt.length === 0)) return null

  return (
    <Dialog open>
      <DialogContent size="sm" showCloseButton={false} className="gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <FileWarning className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{t("recovery.title", { count: scan.valid.length })}</DialogTitle>
              <DialogDescription>{t("recovery.description")}</DialogDescription>
              {scan.corrupt.length > 0 && (
                <p className="text-sm text-destructive">
                  {t("recovery.corruptCount", { count: scan.corrupt.length })}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>
        <RecoveryList
          items={scan.valid}
          locale={locale}
          selectedIds={selectedIds}
          disabled={busy}
          onSelectedChange={toggleSelected}
        />
        <DialogFooter className="m-0 items-center rounded-none border-t px-6 py-4 sm:items-center">
          <Button
            variant={selectedIds.size === 0 ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void resolveSelection()}
          >
            {busy
              ? t("recovery.resolving")
              : selectedIds.size === 0
                ? t("recovery.discardAll")
                : t("recovery.restoreSelectedDiscardOthers", { count: selectedIds.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecoveryList({
  items,
  locale,
  selectedIds,
  disabled,
  onSelectedChange,
}: {
  items: RecoveryDescriptor[]
  locale: string
  selectedIds: ReadonlySet<string>
  disabled: boolean
  onSelectedChange: (projectId: string, checked: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <ul className="no-scrollbar max-h-[min(60vh,28rem)] divide-y overflow-y-auto">
      {items.map(item => {
        const checkboxId = `recovery-${item.projectId}`
        return (
          <li key={item.projectId} className="group px-6 py-4">
            <Label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-3">
              <Checkbox
                id={checkboxId}
                checked={selectedIds.has(item.projectId)}
                disabled={disabled}
                onCheckedChange={checked => onSelectedChange(item.projectId, checked === true)}
                aria-label={t("recovery.selectFile", { name: item.name || t("recovery.untitled") })}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="block truncate font-medium">
                  {item.name || t("recovery.untitled")}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.sourcePath ?? t("recovery.sourceMissing")}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  <time dateTime={new Date(item.savedAt).toISOString()}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.savedAt))}
                  </time>
                </span>
              </span>
            </Label>
          </li>
        )
      })}
    </ul>
  )
}
