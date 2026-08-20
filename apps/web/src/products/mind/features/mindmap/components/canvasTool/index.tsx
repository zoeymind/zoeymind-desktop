import { type FC } from "react"
import { Hand } from "lucide-react"
import { FloatingToolbar, FloatingToolbarGroup, FloatingToolbarButton } from "@zoeymind/ui"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@zoeymind/ui"
import { EditorSidebarTooltipContent } from "../EditorSidebarTooltipContent"
import { TestCaseStats } from "../StatusBar/TestCaseStats"
import { useMindMapModules } from "@/products/mind/features/mindmap/hooks/useMindMapModules"
import { usePanTool } from "@/products/mind/features/mindmap/components/hooks/usePanTool"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useTranslation } from "@zoeymind/i18n"

export const CanvasTool: FC = () => {
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()
  const panTool = usePanTool()
  const { getTestCasesCount } = useMindMapModules(mindMap)
  const testCasesCount = getTestCasesCount()

  return (
    <TooltipProvider>
      <FloatingToolbar position="custom">
        <FloatingToolbarGroup orientation="horizontal" className="gap-1">
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
          <TestCaseStats
            total={testCasesCount.total}
            p1={testCasesCount.p1}
            p2={testCasesCount.p2}
            p3={testCasesCount.p3}
          />
        </FloatingToolbarGroup>
      </FloatingToolbar>
    </TooltipProvider>
  )
}
