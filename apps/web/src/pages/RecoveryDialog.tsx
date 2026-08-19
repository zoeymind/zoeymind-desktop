import { useEffect, useState } from "react"
import { Clock3, FileWarning, FolderOpen } from "lucide-react"
import { useLocale, useTranslation } from "@zoeymind/i18n"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoeymind/ui"
import {
  restoreAllRecoveries,
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

  useEffect(() => {
    void scanRecoveries()
      .then(setScan)
      .catch(() => setScan({ valid: [], corrupt: [] }))
  }, [])

  const restoreAll = async () => {
    if (!scan || busy) return
    setBusy(true)
    try {
      await restoreAllRecoveries(scan.valid)
    } finally {
      setBusy(false)
      setDismissed(true)
    }
  }

  if (dismissed || !scan || (scan.valid.length === 0 && scan.corrupt.length === 0)) return null

  return (
    <Dialog open onOpenChange={open => !open && !busy && setDismissed(true)}>
      <DialogContent size="lg" showCloseButton={false} className="gap-0 overflow-hidden p-0">
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
        <RecoveryList items={scan.valid} locale={locale} />
        <DialogFooter className="items-center border-t px-6 py-4 sm:items-center">
          <Button variant="ghost" disabled={busy} onClick={() => setDismissed(true)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={busy || scan.valid.length === 0} onClick={() => void restoreAll()}>
            {busy ? t("recovery.restoring") : t("recovery.restoreAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecoveryList({ items, locale }: { items: RecoveryDescriptor[]; locale: string }) {
  const { t } = useTranslation()
  return (
    <ul className="no-scrollbar max-h-[min(60vh,28rem)] divide-y overflow-y-auto">
      {items.map(item => (
        <li key={item.projectId} className="space-y-1.5 px-6 py-4">
          <p className="truncate font-medium">{item.name || t("recovery.untitled")}</p>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.sourcePath ?? t("recovery.sourceMissing")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" aria-hidden="true" />
            <time dateTime={new Date(item.savedAt).toISOString()}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(item.savedAt))}
            </time>
          </div>
        </li>
      ))}
    </ul>
  )
}
