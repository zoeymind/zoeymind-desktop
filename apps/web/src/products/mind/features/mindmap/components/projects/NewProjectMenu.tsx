/**
 * 项目列表头部「新建项目」按钮 + 下拉菜单（新建空白 / 导入文件）。
 *
 * 这是项目创建的**主入口**，老的 CreateCard 已经删除。
 * "创建中" 视觉来自本组件内部的 Dialog（与全屏 Loading 区分）。
 *
 * 导入仅在前端解析：
 *   1. 选文件 → parseXMindFile / parseMarkdownFile
 *   2. mindmap.create 拿 newId
 *   3. sessionStorage 暂存解析结果（key 见 `useCreateProject` 中的常量）
 *   4. navigate /editor/<newId>
 *   5. editor 端的 `useCanvasData` 在画布 ready 后读取并 `mindMap.updateData(data)`，
 *      再清掉 sessionStorage。
 */
import { useCallback, useRef } from 'react'
import { ChevronDownIcon, FileUpIcon, PlusIcon, SparklesIcon } from 'lucide-react'
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

import { useCreateProject } from './hooks/useCreateProject'

interface NewProjectMenuProps {
  /** 触发 onCreated 回调，让父级（项目列表）刷新计数/数据。 */
  onCreated?: (newId: string) => void
  /** 当前项目空间; 新建 mindmap 会挂到此 workspace */
  workspaceId?: string | null
}

// 列表层导入仅支持 .xmind（标准）和 .md。zmxmind 留给 editor 内导入做格式选择。
const IMPORT_ACCEPT = '.xmind,.md'

export function NewProjectMenu({ onCreated, workspaceId }: NewProjectMenuProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { creating, createBlank, createFromImport } = useCreateProject({ onCreated, workspaceId })

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // 立刻清空 value，确保选同名文件第二次也能触发 change。
      event.target.value = ''
      if (!file) return
      await createFromImport(file)
    },
    [createFromImport]
  )

  return (
    <>
      <div className="flex w-full" data-tour="new-project-menu">
        <Button
          disabled={creating}
          className="flex-1 justify-center rounded-r-none"
          data-testid="new-mindmap"
          onClick={() => createBlank()}
        >
          <PlusIcon className="mr-1.5 size-4" />
          {t('projects.newMenu.trigger')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton
            render={
              <Button
                disabled={creating}
                className="rounded-l-none border-l border-primary-foreground/20 px-2"
                aria-label={t('projects.newMenu.trigger')}
              >
                <ChevronDownIcon className="size-4 opacity-80" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuItem onSelect={() => createBlank()}>
              <SparklesIcon className="mr-2 size-4" />
              <div className="flex flex-col">
                <span>{t('projects.newMenu.blank')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('projects.newMenu.blankDesc')}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleImportClick}>
              <FileUpIcon className="mr-2 size-4" />
              <div className="flex flex-col">
                <span>{t('projects.newMenu.import')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('projects.newMenu.importDesc')}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 隐藏的文件选择器，dropdown 里点"导入"时触发 click。 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
        aria-label={t('projects.newMenu.import')}
      />

      {/* 创建中 Dialog —— 与 editor 的全屏 Loading 在视觉上分开。 */}
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
            {/* 品牌化动画 — 旋转环 + 呼吸中心图标，替代单调 spinner */}
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

            {/* 进度暗示 — 三点跳动，告诉用户后台在推进 */}
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
