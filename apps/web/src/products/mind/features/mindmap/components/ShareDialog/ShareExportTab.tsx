import { Button, TabsContent } from "@zoeymind/ui"
import { toast } from "@/shared/app-shared"
import { logger } from "@zoeymind/logger"
import { FileImage, FileText, FileCode, FileType, Network } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_I18N_KEYS,
  exportMindMapToFile,
  type ExportFormat,
} from "@/products/mind/features/mindmap/utils/fileFormats"

/**
 * ShareDialog - 导出 Tab。
 * 自包含：只依赖当前 mindMap 实例与各导出器，负责把导图导出为 png/svg/pdf/md/json/txt/xmind。
 */
export function ShareExportTab() {
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()

  const handleExport = async (type: ExportFormat): Promise<void> => {
    if (!mindMap) return
    try {
      await exportMindMapToFile(mindMap, type)
    } catch (error) {
      logger.error("导出失败:", error)
      toast({
        title: t("mindmap.shareDialog.exportFailedTitle"),
        description: t("mindmap.shareDialog.exportFailedDescription"),
        variant: "destructive",
      })
    }
  }

  const exportItems: { type: ExportFormat; label: string; icon: typeof FileImage }[] =
    EXPORT_FORMATS.map(type => ({
      type,
      label: t(EXPORT_FORMAT_I18N_KEYS[type]),
      icon:
        type === "png" || type === "svg"
          ? FileImage
          : type === "json"
            ? FileCode
            : type === "txt"
              ? FileType
              : type === "xmind" || type === "zmxmind"
                ? Network
                : FileText,
    }))

  return (
    <TabsContent value="export" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="grid grid-cols-3 gap-2.5">
        {exportItems.map(item => {
          const Icon = item.icon
          return (
            <Button
              key={item.type}
              variant="outline"
              className="h-auto flex-col gap-1.5 py-4"
              disabled={!mindMap}
              onClick={() => handleExport(item.type)}
            >
              <Icon className="size-5 text-muted-foreground" />
              {item.label}
            </Button>
          )
        })}
      </div>
    </TabsContent>
  )
}
