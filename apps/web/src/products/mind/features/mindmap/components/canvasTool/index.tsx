import { type FC } from "react"
import { Hand } from "lucide-react"
import { FloatingToolbar, FloatingToolbarGroup, FloatingToolbarButton } from "@zoeymind/ui"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@zoeymind/ui"
import { EditorSidebarTooltipContent } from "../EditorSidebarTooltipContent"
import { usePanTool } from "@/products/mind/features/mindmap/components/hooks/usePanTool"
import { useMindMapStore } from "@/products/mind/features/mindmap/stores/mindmap-store"
import { useTranslation } from "@zoeymind/i18n"

export const CanvasTool: FC = () => {
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()
  const panTool = usePanTool()

  return (
    <TooltipProvider>
      <FloatingToolbar position="custom" className="contents">
        <FloatingToolbarGroup orientation="vertical" className="gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingToolbarButton
                  onClick={panTool.togglePanMode}
                  disabled={!mindMap}
                  active={panTool.isActive}
                >
                  <Hand className="size-5" />
                </FloatingToolbarButton>
              }
            />
            <EditorSidebarTooltipContent>
              {t("mindmap.canvasTool.panTool")}
              <br />
              {t("mindmap.canvasTool.panToolShortcut")}
            </EditorSidebarTooltipContent>
          </Tooltip>
        </FloatingToolbarGroup>
      </FloatingToolbar>
    </TooltipProvider>
  )
}
