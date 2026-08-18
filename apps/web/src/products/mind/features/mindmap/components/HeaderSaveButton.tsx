/**
 * Header 保存快捷按钮 —— File 菜单右侧的固定入口, 带脏点 + 保存中 spinner.
 *
 * Dirty:
 *   - useMindMapStore.isDirty (画布改动未落盘)
 *   - pendingProjects.isPending(workspaceId) (新建未保存)
 * 命中任一 -> 按钮右上角显示 primary 色圆点.
 *
 * Saving:
 *   - 点击后 flow.save() 期间 icon 换成 Loader2 spin, 按钮禁用.
 */
import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@zoeymind/ui'
import { logger } from '@zoeymind/logger'
import { toast } from '@/shared/app-shared'
import { useSaveFlowContext, pendingProjects } from '@/shared/native'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'

export function HeaderSaveButton(): React.JSX.Element {
  const flow = useSaveFlowContext()
  const { workspaceId } = useProjectContext()
  const isDirty = useMindMapStore(s => s.isDirty)
  const pending = !!workspaceId && pendingProjects.isPending(workspaceId)
  const dirty = isDirty || pending
  const [saving, setSaving] = useState(false)

  const handleClick = async () => {
    if (saving) return
    setSaving(true)
    try {
      await flow.save()
    } catch (error) {
      logger.error('保存失败', error)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={saving}
      title={
        saving
          ? '保存中...'
          : dirty
            ? '保存 · 未保存的改动 (Cmd/Ctrl+S)'
            : '保存 (Cmd/Ctrl+S)'
      }
      className={`relative ${dirty ? '' : 'text-muted-foreground'}`}
      aria-label="save"
      data-dirty={dirty || undefined}
      data-saving={saving || undefined}
    >
      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      {dirty && !saving && (
        <span
          className="pointer-events-none absolute right-1 top-1 size-1.5 rounded-full bg-primary shadow-[0_0_0_2px_var(--background)]"
          aria-hidden
        />
      )}
    </Button>
  )
}
