import React from "react"
import { Eye, X } from "lucide-react"
import { Button } from "@zoeymind/ui"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useTranslation } from "@zoeymind/i18n"

export const PreviewIndicator: React.FC = () => {
  const { t } = useTranslation()
  const { isPreviewMode, exitPreview } = useMindMapStore()

  // 处理退出预览
  const handleExit = () => {
    exitPreview()
  }
  if (!isPreviewMode) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-warning/10 border border-warning rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-warning" />
          <span className="text-sm font-medium text-warning">
            {t("mindmap.canvas.previewModeText")}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-3 text-xs bg-white hover:bg-muted"
          onClick={handleExit}
        >
          <X className="size-3 mr-1" />
          {t("mindmap.canvas.exitPreview")}
        </Button>
      </div>
    </div>
  )
}
