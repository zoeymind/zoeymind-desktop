import { Download, Loader2, RefreshCw, RotateCcw } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import { Button, Progress, cn } from "@zoeymind/ui"
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
            check={() => void checkForUpdates()}
            install={() => void installUpdate()}
            restart={() => void restart()}
          />
        </div>
        {update?.body ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-1 font-medium">{t("appVersion.releaseNotes")}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{update.body}</p>
          </div>
        ) : null}
        {(status === "downloading" || status === "installing") && progress !== null ? (
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-1.5" />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{progress}%</span>
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
      <span
        className={cn("flex items-center gap-1.5 px-2 text-xs text-muted-foreground", className)}
      >
        <Loader2 className="size-3 animate-spin" />
        {status === "checking"
          ? t("appVersion.checking")
          : t("appVersion.downloading", { progress: progress ?? 0 })}
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
  check: () => void
  install: () => void
  restart: () => void
}

function UpdateAction({ status, version, check, install, restart }: UpdateActionProps) {
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
  if (status === "checking" || status === "downloading" || status === "installing") {
    return (
      <Button size="sm" disabled>
        <Loader2 className="animate-spin" data-icon="inline-start" />
        {status === "checking" ? t("appVersion.checking") : t("appVersion.installing")}
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
