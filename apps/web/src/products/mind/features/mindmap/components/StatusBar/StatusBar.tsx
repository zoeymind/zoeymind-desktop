import { type FC } from "react"
import { ZoomControls } from "./ZoomControls"

export const StatusBar: FC = () => {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-end border-t border-border bg-muted px-4 text-xs text-muted-foreground [&>*]:-translate-y-px">
      <ZoomControls />
    </footer>
  )
}
