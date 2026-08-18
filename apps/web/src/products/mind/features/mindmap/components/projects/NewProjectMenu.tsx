/**
 * 侧栏「新项目」按钮 + 下拉：
 *   - 新建   → pendingProjects.stash + 跳编辑器
 *   - 打开   → tauri open 对话框选 .zmind → registerProject + 跳编辑器
 *   - 导入 xmind             → parseXMindFile
 *   - 导入 metersphere xmind → parseZMXmindFile
 *
 * 一体按钮（整块可点击），点击直接展开菜单；没有再拆成"主按钮 + chevron"。
 */
import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDownIcon,
  FileUpIcon,
  FolderOpenIcon,
  PlusIcon,
  SparklesIcon
} from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { logger } from '@zoeymind/logger'
import { toast } from '@/shared/app-shared'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

import { useCreateProject } from './hooks/useCreateProject'
import {
  createUUID,
  findByPath,
  readBundle,
  registerProject
} from '@/shared/native'

interface NewProjectMenuProps {
  onCreated?: (newId: string) => void
}

export function NewProjectMenu({ onCreated }: NewProjectMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const stdXmindInputRef = useRef<HTMLInputElement>(null)
  const zmXmindInputRef = useRef<HTMLInputElement>(null)
  const { creating, createBlank, createFromImport } = useCreateProject({ onCreated })

  const handleOpenExisting = useCallback(async () => {
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: 'ZoeyMind', extensions: ['zmind'] }]
      })
      if (!picked || typeof picked !== 'string') return
      // 已登记就直接跳; 否则读文件 + 落索引.
      const existing = await findByPath(picked)
      let id = existing?.id
      if (!id) {
        const bundle = await readBundle(picked)
        id = createUUID()
        await registerProject({
          id,
          path: picked,
          name: bundle.meta?.name || picked.split(/[\\/]/).pop()!.replace(/\.zmind$/i, ''),
          nodeCount: 0
        })
      }
      onCreated?.(id)
      navigate(`/editor/${id}`)
    } catch (error) {
      logger.error('打开 .zmind 失败', error)
      toast.error(t('mindmap.editor.openFailed', '打开文件失败'))
    }
  }, [navigate, onCreated, t])

  const handleImportClick = useCallback((format: 'standard' | 'zm') => {
    const ref = format === 'zm' ? zmXmindInputRef : stdXmindInputRef
    ref.current?.click()
  }, [])

  const handleFile =
    (format: 'standard' | 'zm') =>
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      await createFromImport(file, format)
    }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton
          render={
            <Button
              disabled={creating}
              className="w-full justify-between"
              data-testid="new-mindmap"
              data-tour="new-project-menu"
            >
              <span className="flex items-center">
                <PlusIcon className="mr-1.5 size-4" />
                {t('projects.newMenu.trigger', '新项目')}
              </span>
              <ChevronDownIcon className="size-4 opacity-80" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-[240px]">
          <DropdownMenuItem onClick={() => createBlank()}>
            <SparklesIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>{t('projects.newMenu.blank', '新建')}</span>
              <span className="text-xs text-muted-foreground">
                {t('projects.newMenu.blankDesc', '创建一个空白思维导图')}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleOpenExisting()}>
            <FolderOpenIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>{t('projects.newMenu.open', '打开')}</span>
              <span className="text-xs text-muted-foreground">
                {t('projects.newMenu.openDesc', '从磁盘选择一个 .zmind 文件')}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleImportClick('standard')}>
            <FileUpIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>{t('projects.newMenu.importXmind', '导入 XMind')}</span>
              <span className="text-xs text-muted-foreground">
                {t('projects.newMenu.importXmindDesc', '导入标准 XMind 文件')}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleImportClick('zm')}>
            <FileUpIcon className="mr-2 size-4" />
            <div className="flex flex-col">
              <span>
                {t('projects.newMenu.importMsXmind', '导入 MeterSphere XMind')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('projects.newMenu.importMsXmindDesc', '导入 MeterSphere 用例格式')}
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 隐藏的文件选择器 */}
      <input
        ref={stdXmindInputRef}
        type="file"
        accept=".xmind"
        className="hidden"
        onChange={handleFile('standard')}
        aria-label={t('projects.newMenu.importXmind', '导入 XMind')}
      />
      <input
        ref={zmXmindInputRef}
        type="file"
        accept=".xmind"
        className="hidden"
        onChange={handleFile('zm')}
        aria-label={t('projects.newMenu.importMsXmind', '导入 MeterSphere XMind')}
      />

      {/* 创建中 Dialog */}
      <Dialog
        open={creating}
        onOpenChange={(_, details) => {
          if (details.reason === 'outside-press' || details.reason === 'escape-key') {
            details.cancel()
          }
        }}
      >
        <DialogContent className="sm:max-w-[380px] [&>button]:hidden">
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="relative flex size-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
                style={{ animationDuration: '900ms' }}
              />
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 transition-transform duration-500 ease-out animate-in fade-in zoom-in-50">
                <SparklesIcon className="size-4 text-primary" />
              </div>
            </div>
            <div className="space-y-1.5 text-center">
              <DialogTitle className="text-base font-semibold tracking-tight">
                {t('projects.actions.creatingTitle')}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t('projects.actions.creatingDesc')}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5" aria-hidden>
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="size-1.5 rounded-full bg-primary/60 animate-pulse"
                  style={{ animationDelay: `${i * 160}ms`, animationDuration: '1.2s' }}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
