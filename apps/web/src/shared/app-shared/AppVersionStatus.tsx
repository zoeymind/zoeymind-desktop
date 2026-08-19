import { ArrowUpRight } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import { Button, cn } from "@zoeymind/ui"
import { useAppVersion } from "./app-version-store"

type AppVersionStatusVariant = "compact" | "detail"

interface AppVersionStatusProps {
  variant?: AppVersionStatusVariant
  className?: string
}

export function AppVersionStatus({ variant = "compact", className }: AppVersionStatusProps) {
  const { t } = useTranslation()
  const currentVersion = useAppVersion(state => state.currentVersion)
  const latestRelease = useAppVersion(state => state.latestRelease)
  const hasUpdate = useAppVersion(state => state.hasUpdate)
  const openRelease = useAppVersion(state => state.openRelease)
  const latestVersion = latestRelease?.tagName.replace(/^v/, "")

  if (variant === "detail") {
    return (
      <div className={cn("flex items-center justify-between gap-6", className)}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="tabular-nums">v{currentVersion}</span>
          {hasUpdate ? (
            <span className="text-xs text-muted-foreground">
              {t("appVersion.latestAvailable", { version: latestVersion })}
            </span>
          ) : null}
        </div>
        {hasUpdate ? (
          <Button variant="outline" size="sm" onClick={() => void openRelease()}>
            {t("appVersion.viewRelease")}
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{t("appVersion.upToDate")}</span>
        )}
      </div>
    )
  }

  if (hasUpdate) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 gap-1.5 px-2 text-xs text-primary", className)}
        onClick={() => void openRelease()}
        title={t("appVersion.latestAvailable", { version: latestVersion })}
      >
        {t("appVersion.updateAvailable")}
        <span className="tabular-nums">v{latestVersion}</span>
        <ArrowUpRight data-icon="inline-end" />
      </Button>
    )
  }

  return (
    <span className={cn("px-2 text-xs tabular-nums text-muted-foreground", className)}>
      v{currentVersion}
    </span>
  )
}
