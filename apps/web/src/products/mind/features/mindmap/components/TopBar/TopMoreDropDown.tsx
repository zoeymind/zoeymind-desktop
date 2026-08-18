import { logger } from '@zoeymind/logger'
import { type FC } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { Search, Import, Upload, Trash2, ArrowLeft, Settings, Keyboard } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '@zoeymind/ui'
import { XMindExporter } from '@/products/mind/features/mindmap/utils/XMindExporter'
import { ZMXMindExporter } from '@/products/mind/features/mindmap/utils/ZMXMindExporter'
import { convertMindMapNodeTreeToMarkdownWithIcons } from '@/products/mind/features/mindmap/utils/markdownParser'
import { exportToZipNested } from '@/products/mind/features/mindmap/utils/zipNestedExporter'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'

// 支持的导出格式 (UI 层直接声明; 无按 plan 过滤逻辑).
const EXPORT_FORMATS = [
  'png',
  'svg',
  'pdf',
  'md',
  'json',
  'txt',
  'xmind',
  'zmxmind',
  'zip'
] as const
type ExportFormat = (typeof EXPORT_FORMATS)[number]

interface TopMoreDropDownProps {
  isActive: boolean
  cloudMode?: boolean // 是否为云模式
  onShowSearch: () => void
  onShowSettings: () => void
  onShowShortcuts: () => void
  onClose: () => void
  onImport: () => void
  onClear: () => void
  onExport?: (type: string) => Promise<boolean> | void
}

/**
 * 导出格式对应的多语言 key。
 *
 * 不从展示文案反推 key，避免 `exportPNG` / `exportPng` 这类大小写差异导致 i18n 回退显示 key 本身。
 */
const EXPORT_FORMAT_I18N_KEYS: Record<ExportFormat, string> = {
  png: 'mindmap.topbar.more.exportPng',
  svg: 'mindmap.topbar.more.exportSvg',
  pdf: 'mindmap.topbar.more.exportPdf',
  md: 'mindmap.topbar.more.exportMd',
  json: 'mindmap.topbar.more.exportJson',
  txt: 'mindmap.topbar.more.exportTxt',
  xmind: 'mindmap.topbar.more.exportXmind',
  zmxmind: 'mindmap.topbar.more.exportZmxmind',
  zip: 'mindmap.topbar.more.exportZip'
}

export const TopMoreDropDown: FC<TopMoreDropDownProps> = ({
  isActive,
  onShowSearch,
  onShowSettings,
  onShowShortcuts,
  onClose,
  onImport,
  onClear,
  onExport
}) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // 用路由 params 拿 orgId
  const params = useParams({ strict: false }) as { orgId?: string }
  const orgId = params.orgId

  // 从store获取mindMap实例
  const { mindMap } = useMindMapStore()

  // 处理导出
  const handleExport = async (type: string) => {
    if (onExport) {
      // 使用传入的导出函数
      await onExport(type)
    } else if (mindMap) {
      try {
        // 获取当前思维导图的名称
        const currentMapData = mindMap.getData()
        const fileName = currentMapData.data.text

        const exportMap = {
          png: () => mindMap.doExport?.png(fileName, false),
          svg: () => mindMap.doExport?.svg(fileName),
          pdf: () => mindMap.doExport?.pdf(fileName, false),
          md: async () => {
            // 使用增强的markdown导出功能，包含图标信息
            const mindMapData = mindMap.getData()
            const markdownContent = await convertMindMapNodeTreeToMarkdownWithIcons(mindMapData)
            return new Blob([markdownContent], { type: 'text/markdown' })
          },
          json: () => mindMap.doExport?.json('', true),
          txt: () => mindMap.doExport?.txt(),
          xmind: async () => {
            const exporter = new XMindExporter(mindMap)
            await exporter.export()
            return new Blob([''], { type: 'application/vnd.xmind.workbook' })
          },
          zmxmind: async () => {
            const exporter = new ZMXMindExporter(mindMap)
            await exporter.export()
            return new Blob([''], { type: 'application/vnd.xmind.workbook' })
          },
          zip: async () => {
            await exportToZipNested(mindMap)
            return new Blob([''], { type: 'application/zip' })
          }
        }

        const exportFn = exportMap[type as keyof typeof exportMap]
        if (!exportFn) return

        const data = await exportFn()

        // 如果是xmind、zmxmind或zip格式，导出函数已经处理了下载，直接返回
        if (type === 'xmind' || type === 'zmxmind' || type === 'zip') return

        // 创建下载链接
        const a = document.createElement('a')
        if (data instanceof Blob) {
          a.href = URL.createObjectURL(data)
        } else {
          a.href = data || ''
        }
        a.download = `${fileName}.${type}`
        a.click()
        if (data instanceof Blob) {
          URL.revokeObjectURL(a.href)
        }
      } catch (error) {
        logger.error('导出失败:', error)
        throw error
      }
    }
  }

  if (!isActive) {
    return null
  }

  return (
    <>
      <DropdownMenuItem
        onClick={() => {
          if (orgId) {
            navigate({ to: '/org/$orgId/zoeymind/projects', params: { orgId } })
          } else {
            navigate({ to: '/' })
          }
          onClose()
        }}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="size-4" />
        <span>{t('mindmap.topbar.more.backToProjects')}</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => {
          onClose()
          onShowSearch()
        }}
        className="flex items-center gap-2"
      >
        <Search className="size-4" />
        <span>{t('common.search')}</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => {
          onShowShortcuts()
          onClose()
        }}
        className="flex items-center gap-2"
      >
        <Keyboard className="size-4" />
        <span>{t('mindmap.topbar.more.shortcuts')}</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => {
          onImport()
          onClose()
        }}
        className="flex items-center gap-2"
      >
        <Import className="size-4" />
        <span>{t('mindmap.topbar.more.import')}</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => {
          onShowSettings()
          onClose()
        }}
        className="flex items-center gap-2"
      >
        <Settings className="size-4" />
        <span>{t('common.settings')}</span>
      </DropdownMenuItem>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="flex items-center gap-2">
          <Upload className="size-4" />
          <span>{t('mindmap.topbar.more.export')}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {EXPORT_FORMATS.map(format => {
            const i18nKey = EXPORT_FORMAT_I18N_KEYS[format]
            return (
              <DropdownMenuItem
                key={format}
                onClick={() => {
                  handleExport(format)
                  onClose()
                }}
                className="flex items-center gap-2"
              >
                <span>{t(i18nKey)}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        onClick={() => {
          onClear()
          onClose()
        }}
        className="flex items-center gap-2 text-destructive"
      >
        <Trash2 className="size-4" />
        <span>{t('mindmap.topbar.more.clearAll')}</span>
      </DropdownMenuItem>
    </>
  )
}
