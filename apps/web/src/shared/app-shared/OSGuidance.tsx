import { useState } from "react"
import { useTranslation } from "@zoeymind/i18n"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoeymind/ui"
import { useAppVersion } from "./app-version-store"
import { FIRST_RUN_STORAGE_KEY, detectPlatformSync, useInstallGate } from "./os-guidance-store"

export function FirstRunGuidance() {
  const { t } = useTranslation()
  const platform = detectPlatformSync()
  const initialOpen =
    (platform === "macos" || platform === "windows") && !localStorage.getItem(FIRST_RUN_STORAGE_KEY)
  const [open, setOpen] = useState(initialOpen)

  if (platform !== "macos" && platform !== "windows") return null

  const dismiss = () => {
    localStorage.setItem(FIRST_RUN_STORAGE_KEY, "1")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={next => (!next ? dismiss() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("osGuidance.firstRun.title")}</DialogTitle>
          <DialogDescription>{t("osGuidance.firstRun.summary")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {platform === "macos" ? (
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>{t("osGuidance.firstRun.macos.step1")}</li>
              <li>{t("osGuidance.firstRun.macos.step2")}</li>
              <li>{t("osGuidance.firstRun.macos.step3")}</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>{t("osGuidance.firstRun.windows.step1")}</li>
              <li>{t("osGuidance.firstRun.windows.step2")}</li>
              <li>{t("osGuidance.firstRun.windows.step3")}</li>
            </ol>
          )}
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("osGuidance.firstRun.note")}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={dismiss}>{t("osGuidance.firstRun.dismiss")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function WindowsUpdatePreviewDialog() {
  const { t } = useTranslation()
  const [remember, setRemember] = useState(false)
  const open = useInstallGate(state => state.windowsPreviewOpen)
  const confirm = useInstallGate(state => state.confirmWindowsPreview)
  const cancel = useInstallGate(state => state.cancelWindowsPreview)
  const version = useAppVersion(state => state.update?.version)

  return (
    <Dialog open={open} onOpenChange={next => (!next ? cancel() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("osGuidance.updatePreview.title")}</DialogTitle>
          <DialogDescription>
            {t("osGuidance.updatePreview.summary", { version: version ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>{t("osGuidance.updatePreview.step1")}</li>
            <li>{t("osGuidance.updatePreview.step2")}</li>
            <li>{t("osGuidance.updatePreview.step3")}</li>
          </ol>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={event => setRemember(event.target.checked)}
              className="size-3.5 rounded border-border"
            />
            {t("osGuidance.updatePreview.doNotShow")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cancel}>
            {t("osGuidance.updatePreview.cancel")}
          </Button>
          <Button onClick={() => confirm(remember)}>{t("osGuidance.updatePreview.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
