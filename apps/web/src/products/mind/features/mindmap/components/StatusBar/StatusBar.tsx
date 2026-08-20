import { type FC } from "react"
import { ZoomControls } from "./ZoomControls"
import { AppVersionStatus } from "@/shared/app-shared"

export const StatusBar: FC = () => {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between px-4 text-xs text-muted-foreground">
      <AppVersionStatus className="-ml-2" />
      <ZoomControls />
    </footer>
  )
}
