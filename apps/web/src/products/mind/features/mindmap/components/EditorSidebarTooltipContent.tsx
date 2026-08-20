import type { ComponentProps } from "react"
import { TooltipContent } from "@zoeymind/ui"

const EDITOR_HEADER_TOOLTIP_OFFSET = 8

type EditorSidebarTooltipContentProps = Omit<
  ComponentProps<typeof TooltipContent>,
  "side" | "sideOffset"
>

/** Positions editor tooltips below the horizontal editor header. */
export function EditorSidebarTooltipContent(props: EditorSidebarTooltipContentProps) {
  return <TooltipContent side="bottom" sideOffset={EDITOR_HEADER_TOOLTIP_OFFSET} {...props} />
}
