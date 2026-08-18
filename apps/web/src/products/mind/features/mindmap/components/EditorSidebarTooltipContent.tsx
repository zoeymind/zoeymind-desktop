import type { ComponentProps } from "react"
import { TooltipContent } from "@zoeymind/ui"

const SIDEBAR_WIDTH = 48
const SIDEBAR_ICON_SIZE = 28
const SIDEBAR_TOOLTIP_GAP = 8
export const EDITOR_SIDEBAR_CONTENT_OFFSET =
  (SIDEBAR_WIDTH - SIDEBAR_ICON_SIZE) / 2 + SIDEBAR_TOOLTIP_GAP

type EditorSidebarTooltipContentProps = Omit<
  ComponentProps<typeof TooltipContent>,
  "side" | "sideOffset"
>

/** Positions tooltips beyond the right edge of the editor's 48px activity bar. */
export function EditorSidebarTooltipContent(props: EditorSidebarTooltipContentProps) {
  return <TooltipContent side="right" sideOffset={EDITOR_SIDEBAR_CONTENT_OFFSET} {...props} />
}
