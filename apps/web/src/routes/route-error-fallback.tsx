import { useEffect } from "react"
import { isRouteErrorResponse, useRouteError } from "react-router-dom"
import { useTranslation } from "@zoeymind/i18n"
import { logger } from "@zoeymind/logger"
import { LoadErrorScreen } from "@zoeymind/ui"
import { TitleBar } from "@/components/layouts/titlebar"

function describeRouteError(error: unknown): string | undefined {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`.trim()
  }
  return error instanceof Error ? error.message : undefined
}

export function RouteErrorFallback() {
  const error = useRouteError()
  const { t } = useTranslation()
  const errorDetail = describeRouteError(error)

  useEffect(() => {
    logger.error("[RouteErrorFallback] Unhandled route error", error)
  }, [error])

  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar />
      <LoadErrorScreen
        title={t("routeError.title")}
        description={t("routeError.description")}
        primaryLabel={t("routeError.retry")}
        onPrimary={() => window.location.reload()}
        secondaryLabel={t("routeError.home")}
        onSecondary={() => window.location.assign("/")}
      >
        {import.meta.env.DEV && errorDetail && (
          <details className="mb-6 w-full max-w-md rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">
              {t("routeError.details")}
            </summary>
            <p className="mt-2 max-h-24 overflow-auto break-words font-mono select-text">
              {errorDetail}
            </p>
          </details>
        )}
      </LoadErrorScreen>
    </div>
  )
}
