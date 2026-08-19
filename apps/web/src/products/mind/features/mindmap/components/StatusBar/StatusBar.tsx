import { type FC } from "react"
import { ZoomControls } from "./ZoomControls"
import { AppVersionStatus } from "@/shared/app-shared"

export const StatusBar: FC = () => {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-muted px-4 text-xs text-muted-foreground [&>*]:-translate-y-px">
      <AppVersionStatus className="-ml-2" />
      <ZoomControls />
    </footer>
  )
}
