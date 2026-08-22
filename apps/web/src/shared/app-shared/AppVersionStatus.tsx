import { Download, Loader2, RefreshCw, RotateCcw, X } from "lucide-react"
import Markdown from "react-markdown"
import { useTranslation } from "@zoeymind/i18n"
import { Button, cn } from "@zoeymind/ui"
import { useAppVersion, type AppUpdateStatus } from "./app-version-store"

type AppVersionStatusVariant = "compact" | "detail"

interface AppVersionStatusProps {
  variant?: AppVersionStatusVariant
  className?: string
}

export function AppVersionStatus({ variant = "compact", className }: AppVersionStatusProps) {
  const { t } = useTranslation()
  const currentVersion = useAppVersion(state => state.currentVersion)
  const update = useAppVersion(state => state.update)
  const status = useAppVersion(state => state.status)
  const progress = useAppVersion(state => state.progress)
  const checkForUpdates = useAppVersion(state => state.checkForUpdates)
  const installUpdate = useAppVersion(state => state.installUpdate)
  const cancelUpdate = useAppVersion(state => state.cancelUpdate)
  const restart = useAppVersion(state => state.restart)
  const busy = status === "checking" || status === "downloading" || status === "installing"

  if (variant === "detail") {
    return (
      <div className={cn("flex min-w-0 flex-col gap-3", className)}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="tabular-nums">v{currentVersion}</span>
            {update ? (
              <span className="text-xs text-muted-foreground">
                {t("appVersion.latestAvailable", { version: update.version })}
              </span>
            ) : null}
            {status === "up-to-date" ? (
              <span className="text-xs text-muted-foreground">{t("appVersion.upToDate")}</span>
            ) : null}
            {status === "unavailable" || status === "failed" ? (
              <span className="text-xs text-destructive">{t("appVersion.operationFailed")}</span>
            ) : null}
          </div>
          <UpdateAction
            status={status}
            version={update?.version}
            progress={progress}
            check={() => void checkForUpdates()}
            install={() => void installUpdate()}
            cancel={() => cancelUpdate()}
            restart={() => void restart()}
          />
        </div>
        {update?.body ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-2 font-medium">{t("appVersion.releaseNotes")}</p>
            <div className="prose prose-sm dark:prose-invert max-h-80 max-w-none overflow-y-auto prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-sm prose-p:my-1 prose-li:my-0.5 prose-strong:font-semibold prose-code:text-xs">
              <Markdown>{update.body}</Markdown>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (status === "restart-required") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 gap-1.5 px-2 text-xs text-primary", className)}
        onClick={() => void restart()}
      >
        <RotateCcw data-icon="inline-start" />
        {t("appVersion.restart")}
      </Button>
    )
  }

  if (update && !busy) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 gap-1.5 px-2 text-xs text-primary", className)}
        onClick={() => void installUpdate()}
        title={t("appVersion.latestAvailable", { version: update.version })}
      >
        <Download data-icon="inline-start" />
        {t("appVersion.installUpdate", { version: update.version })}
      </Button>
    )
  }

  if (busy) {
    return (
      <span className={cn("flex items-center gap-1 px-1 text-xs text-muted-foreground", className)}>
        <span className="flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin" />
          <span className="tabular-nums">{busyLabel(t, status, progress)}</span>
        </span>
        {status === "downloading" || status === "installing" ? (
          <button
            type="button"
            onClick={() => cancelUpdate()}
            className="ml-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            title={t("appVersion.cancel")}
            aria-label={t("appVersion.cancel")}
          >
            <X className="size-3" />
          </button>
        ) : null}
      </span>
    )
  }

  return (
    <span className={cn("px-2 text-xs tabular-nums text-muted-foreground", className)}>
      v{currentVersion}
    </span>
  )
}

interface UpdateActionProps {
  status: AppUpdateStatus
  version?: string
  progress: number | null
  check: () => void
  install: () => void
  cancel: () => void
  restart: () => void
}

function UpdateAction({
  status,
  version,
  progress,
  check,
  install,
  cancel,
  restart,
}: UpdateActionProps) {
  const { t } = useTranslation()
  if (status === "available" && version) {
    return (
      <Button size="sm" onClick={install}>
        <Download data-icon="inline-start" />
        {t("appVersion.installUpdate", { version })}
      </Button>
    )
  }
  if (status === "restart-required") {
    return (
      <Button size="sm" onClick={restart}>
        <RotateCcw data-icon="inline-start" />
        {t("appVersion.restart")}
      </Button>
    )
  }
  if (status === "downloading" || status === "installing") {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" disabled className="tabular-nums">
          <Loader2 className="animate-spin" data-icon="inline-start" />
          {busyLabel(t, status, progress)}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={cancel}
          title={t("appVersion.cancel")}
          aria-label={t("appVersion.cancel")}
        >
          <X data-icon="inline-start" />
          {t("appVersion.cancel")}
        </Button>
      </div>
    )
  }
  if (status === "checking") {
    return (
      <Button size="sm" disabled>
        <Loader2 className="animate-spin" data-icon="inline-start" />
        {t("appVersion.checking")}
      </Button>
    )
  }
  return (
    <Button variant="outline" size="sm" onClick={check}>
      <RefreshCw data-icon="inline-start" />
      {t("appVersion.checkForUpdates")}
    </Button>
  )
}

function busyLabel(
  t: (key: string, params?: Record<string, unknown>) => string,
  status: AppUpdateStatus,
  progress: number | null
): string {
  if (status === "checking") return t("appVersion.checking")
  if (status === "installing") return t("appVersion.installing")
  return t("appVersion.downloading", { progress: progress ?? 0 })
}
