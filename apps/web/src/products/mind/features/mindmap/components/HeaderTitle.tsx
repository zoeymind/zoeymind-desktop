/**
 * Header 中间的项目标题 —— 双击进入编辑 mode, blur / Enter 提交.
 *
 * 标题来源:
 *   - pending 新建: pendingProjects.read.title
 *   - 已入库    : SqlProjectRepo.getProject.name
 *
 * 提交:
 *   - pending: pendingProjects.rename
 *   - 已入库: refreshProjectIndex + 立刻反映到 useMindMapStore 里
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { logger } from '@zoeymind/logger'
import {
  getProject,
  pendingProjects,
  refreshProjectIndex
} from '@/shared/native'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'

export function HeaderTitle(): React.JSX.Element {
  const { t } = useTranslation()
  const { workspaceId } = useProjectContext()
  const canEdit = usePermissionStore(s => s.canEdit)
  const [title, setTitle] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function loadTitle() {
      if (!workspaceId) {
        setTitle('')
        return
      }
      if (pendingProjects.isPending(workspaceId)) {
        const p = pendingProjects.read(workspaceId)
        if (!cancelled) setTitle(p?.title ?? t('mindmap.editor.newProjectTitle'))
        return
      }
      try {
        const row = await getProject(workspaceId)
        if (!cancelled) setTitle(row?.name ?? '')
      } catch (error) {
        logger.error('读取项目标题失败', error)
      }
    }
    void loadTitle()
    return () => {
      cancelled = true
    }
  }, [workspaceId, t])

  const startEdit = useCallback(() => {
    if (!canEdit) return
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }, [canEdit])

  const commit = useCallback(async () => {
    const next = inputRef.current?.value.trim() || t('mindmap.editor.newProjectTitle')
    setIsEditing(false)
    if (next === title) return
    setTitle(next)
    if (!workspaceId) return
    if (pendingProjects.isPending(workspaceId)) {
      pendingProjects.rename(workspaceId, next)
      return
    }
    try {
      await refreshProjectIndex(workspaceId, { name: next })
    } catch (error) {
      logger.error('重命名项目失败', error)
    }
  }, [t, title, workspaceId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={title}
        onBlur={() => void commit()}
        onKeyDown={handleKeyDown}
        className="min-w-0 max-w-[280px] bg-transparent border-b border-primary/60 text-center text-sm font-medium text-foreground outline-none"
        placeholder={t('mindmap.topbar.title.placeholder')}
        aria-label={t('mindmap.topbar.title.editTitle')}
      />
    )
  }
  return (
    <span
      onDoubleClick={startEdit}
      className={cn(
        'max-w-[280px] truncate text-sm font-medium text-foreground',
        canEdit ? 'cursor-text' : 'cursor-default'
      )}
      title={
        canEdit
          ? t('mindmap.topbar.title.doubleClickHint', { value: title })
          : title
      }
    >
      {title || t('mindmap.editor.newProjectTitle')}
    </span>
  )
}
