// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { Button, TabsContent } from '@zoeymind/ui'
import { toast } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'
import { FileImage, FileText, FileCode, FileType, Network } from 'lucide-react'
import { useTranslation } from '@zoeymind/i18n'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { XMindExporter } from '@/products/mind/features/mindmap/utils/XMindExporter'
import { ZMXMindExporter } from '@/products/mind/features/mindmap/utils/ZMXMindExporter'
import { convertMindMapNodeTreeToMarkdownWithIcons } from '@/products/mind/features/mindmap/utils/markdownParser'
import { exportToZipNested } from '@/products/mind/features/mindmap/utils/zipNestedExporter'

/**
 * ShareDialog - 导出 Tab。
 * 自包含：只依赖当前 mindMap 实例与各导出器，负责把导图导出为 png/svg/pdf/md/json/txt/xmind。
 */
export function ShareExportTab() {
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()

  const handleExport = async (type: string): Promise<void> => {
    if (!mindMap) return
    try {
      const fileName = mindMap.getData().data.text
      const exportMap: Record<string, () => Promise<Blob | string | void> | Blob | string | void> =
        {
          png: () => mindMap.doExport?.png(fileName, false),
          svg: () => mindMap.doExport?.svg(fileName),
          pdf: () => mindMap.doExport?.pdf(fileName, false),
          json: () => mindMap.doExport?.json('', true),
          txt: () => mindMap.doExport?.txt(),
          md: async () => {
            const content = await convertMindMapNodeTreeToMarkdownWithIcons(mindMap.getData())
            return new Blob([content], { type: 'text/markdown' })
          },
          xmind: async () => {
            await new XMindExporter(mindMap).export()
          },
          zmxmind: async () => {
            await new ZMXMindExporter(mindMap).export()
          },
          zip: async () => {
            await exportToZipNested(mindMap)
          }
        }
      const fn = exportMap[type]
      if (!fn) return
      const data = await fn()
      if (type === 'xmind' || type === 'zmxmind' || type === 'zip') return
      const a = document.createElement('a')
      a.href = data instanceof Blob ? URL.createObjectURL(data) : data || ''
      a.download = `${fileName}.${type}`
      a.click()
      if (data instanceof Blob) URL.revokeObjectURL(a.href)
    } catch (error) {
      logger.error('导出失败:', error)
      toast({
        title: t('mindmap.shareDialog.exportFailedTitle'),
        description: t('mindmap.shareDialog.exportFailedDescription'),
        variant: 'destructive'
      })
    }
  }

  const exportItems: { type: string; label: string; icon: typeof FileImage }[] = [
    { type: 'png', label: t('mindmap.shareDialog.exportPNG'), icon: FileImage },
    { type: 'svg', label: t('mindmap.shareDialog.exportSVG'), icon: FileImage },
    { type: 'pdf', label: t('mindmap.shareDialog.exportPDF'), icon: FileText },
    { type: 'md', label: t('mindmap.shareDialog.exportMarkdown'), icon: FileText },
    { type: 'json', label: t('mindmap.shareDialog.exportJSON'), icon: FileCode },
    { type: 'txt', label: t('mindmap.shareDialog.exportTXT'), icon: FileType },
    { type: 'xmind', label: t('mindmap.shareDialog.exportXMind'), icon: Network }
  ]

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