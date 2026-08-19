// @ts-nocheck
/**
 * TopMoreDropDown —— 编辑器顶部 File 菜单.
 *
 * 结构 (VS Code / macOS 编辑器通用):
 *   新建 / 打开 / 打开最近 ▸ (10)
 *   ─────
 *   保存 / 另存为
 *   ─────
 *   搜索 / 快捷键 / 设置 / 导入 ▸ / 导出 ▸ / 清空
 */
import { logger } from '@zoeymind/logger'
import { type FC, useCallback } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import {
  FileUp,
  FilePlus,
  FolderOpen,
  History,
  Import,
  Keyboard,
  Save,
  SaveAll,
  Search,
  Settings,
  Trash2,
  Upload
} from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@zoeymind/ui'
import { open as openDialog, save as saveNativeDialog } from '@tauri-apps/plugin-dialog'
import { XMindExporter } from '@/products/mind/features/mindmap/utils/XMindExporter'
import { ZMXMindExporter } from '@/products/mind/features/mindmap/utils/ZMXMindExporter'
import { convertMindMapNodeTreeToMarkdownWithIcons } from '@/products/mind/features/mindmap/utils/markdownParser'
import { exportToZipNested } from '@/products/mind/features/mindmap/utils/zipNestedExporter'
import { useProjectMindMapStore as useMindMapStore } from '@/products/mind/editor-session'
import {
  bumpProjects,
  createUUID,
  findByPath,
  registerProject,
  useSaveFlowContext
} from '@/shared/native'
import { useTabs } from '@/shared/tabs/store'
import { pendingProjects } from '@/shared/native'
import { defaultMindmapData } from '@zoeymind/shared'
import { toast } from '@/shared/app-shared'
import { useRecentProjects } from '@/products/mind/features/mindmap/hooks/useRecentProjects'

const EXPORT_FORMATS = ['png', 'svg', 'pdf', 'md', 'json', 'txt', 'xmind', 'zmxmind', 'zip'] as const
type ExportFormat = (typeof EXPORT_FORMATS)[number]

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

interface TopMoreDropDownProps {
  isActive: boolean
  onShowSearch: () => void
  onShowSettings: () => void
  onShowShortcuts: () => void
  onClose: () => void
  onImport: () => void
  onClear: () => void
  onExport?: (type: string) => Promise<boolean | void>
  cloudMode?: boolean
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
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()
  const flow = useSaveFlowContext()
  const recents = useRecentProjects(10)

  // --- File 菜单核心 ---
  const handleNew = useCallback(() => {
    const title = '未命名思维导图'
    const id = pendingProjects.stash({ title, tree: defaultMindmapData })
    useTabs.getState().openTab({ id, kind: 'draft', title })
    onClose()
  }, [onClose])

  const handleOpen = useCallback(async () => {
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: 'ZoeyMind', extensions: ['zmind'] }]
      })
      if (!picked || typeof picked !== 'string') return
      const existing = await findByPath(picked)
      let id = existing?.id
      // 名字权威源: 文件名 (foo.zmind -> foo), 不看 DB row.name 也不看 bundle.meta.name.
      const title = picked.split(/[\\/]/).pop()!.replace(/\.zmind$/i, '') || 'Untitled'
      if (!id) {
        id = createUUID()
        await registerProject({ id, path: picked, name: title, nodeCount: 0 })
        bumpProjects()
      }
      useTabs.getState().openTab({ id, kind: 'file', title, projectId: id })
    } catch (error) {
      logger.error('打开 .zmind 失败', error)
      toast.error('打开文件失败')
    } finally {
      onClose()
    }
  }, [onClose])

  const handleOpenRecent = useCallback(
    (id: string, name: string) => {
      useTabs.getState().openTab({ id, kind: 'file', title: name, projectId: id })
      onClose()
    },
    [onClose]
  )

  const handleSave = useCallback(async () => {
    try {
      await flow.save()
    } catch (error) {
      logger.error('保存失败', error)
      toast.error('保存失败')
    } finally {
      onClose()
    }
  }, [flow, onClose])

  const handleSaveAs = useCallback(async () => {
    try {
      const picked = await saveNativeDialog({
        filters: [{ name: 'ZoeyMind', extensions: ['zmind'] }]
      })
      if (!picked) return
      await flow.saveAs(picked)
    } catch (error) {
      logger.error('另存为失败', error)
      toast.error('另存为失败')
    } finally {
      onClose()
    }
  }, [flow, onClose])

  // --- 导出 (原有逻辑) ---
  const handleExport = async (type: string) => {
    if (onExport) {
      await onExport(type)
      return
    }
    if (!mindMap) return
    try {
      const fileName = (mindMap.getData() as { data: { text: string } }).data.text
      const map = {
        png: () => mindMap.doExport?.png(fileName, false),
        svg: () => mindMap.doExport?.svg(fileName),
        pdf: () => mindMap.doExport?.pdf(fileName, false),
        md: async () => {
          const content = await convertMindMapNodeTreeToMarkdownWithIcons(mindMap.getData())
          return new Blob([content], { type: 'text/markdown' })
        },
        json: () => mindMap.doExport?.json('', true),
        txt: () => mindMap.doExport?.txt(),
        xmind: async () => {
          await new XMindExporter(mindMap).export()
          return new Blob([''])
        },
        zmxmind: async () => {
          await new ZMXMindExporter(mindMap).export()
          return new Blob([''])
        },
        zip: async () => {
          await exportToZipNested(mindMap)
          return new Blob([''])
        }
      }
      const fn = map[type as keyof typeof map]
      if (!fn) return
      const data = await fn()
      if (type === 'xmind' || type === 'zmxmind' || type === 'zip') return
      const a = document.createElement('a')
      a.href = data instanceof Blob ? URL.createObjectURL(data) : (data as string) || ''
      a.download = `${fileName}.${type}`
      a.click()
      if (data instanceof Blob) URL.revokeObjectURL(a.href)
    } catch (error) {
      logger.error('导出失败:', error)
    }
  }

  if (!isActive) return null

  return (
    <>
      {/* File */}
      <DropdownMenuItem onClick={handleNew} className="flex items-center gap-2">
        <FilePlus className="size-4" />
        <span>新建</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void handleOpen()} className="flex items-center gap-2">
        <FolderOpen className="size-4" />
        <span>打开...</span>
      </DropdownMenuItem>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="flex items-center gap-2">
          <History className="size-4" />
          <span>打开最近</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-72 w-64 overflow-y-auto">
          {recents.length === 0 ? (
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              还没有最近项目
            </DropdownMenuLabel>
          ) : (
            recents.map(r => (
              <DropdownMenuItem
                key={r.id}
                onClick={() => handleOpenRecent(r.id, r.name)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="truncate w-full">{r.name}</span>
                <span className="truncate w-full text-xs text-muted-foreground">{r.path}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={() => void handleSave()} className="flex items-center gap-2">
        <Save className="size-4" />
        <span>保存</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void handleSaveAs()} className="flex items-center gap-2">
        <SaveAll className="size-4" />
        <span>另存为...</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* 其他工具 */}
      <DropdownMenuItem onClick={onShowSearch} className="flex items-center gap-2">
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
          {EXPORT_FORMATS.map(fmt => (
            <DropdownMenuItem
              key={fmt}
              onClick={() => {
                void handleExport(fmt)
                onClose()
              }}
              className="flex items-center gap-2"
            >
              <FileUp className="size-4" />
              <span>{t(EXPORT_FORMAT_I18N_KEYS[fmt])}</span>
            </DropdownMenuItem>
          ))}
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
