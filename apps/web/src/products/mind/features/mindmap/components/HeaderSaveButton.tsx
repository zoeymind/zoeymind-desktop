/**
 * Header 保存快捷按钮 —— File 菜单右侧的固定入口, 带"未保存"红点.
 *
 * Dirty 判定 (对标 VS Code / Xmind / Photoshop):
 *   - `useMindMapStore.isDirty` = true         → 画布改动未落盘
 *   - `pendingProjects.isPending(workspaceId)` → 新建项目还没首次保存
 * 命中任一即视为脏, 按钮右上角显示一个 primary 色小圆点.
 *
 * 消费 SaveFlowContext (由 EditorShell 挂 Provider), 与 useStorageManager
 * 共享同一份 stateRef, 确保 registerBundleSource 写入的 tree 和这里的
 * save() 是同一份.
 */
import { Save } from 'lucide-react'
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

  const handleClick = async () => {
    try {
      await flow.save()
    } catch (error) {
      logger.error('保存失败', error)
      toast.error('保存失败')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      title={dirty ? '保存 · 未保存的改动 (Cmd/Ctrl+S)' : '保存 (Cmd/Ctrl+S)'}
      className={`relative ${dirty ? '' : 'text-muted-foreground'}`}
      aria-label="save"
      data-dirty={dirty || undefined}
    >
      <Save className="size-4" />
      {dirty && (
        <span
          className="pointer-events-none absolute right-1 top-1 size-1.5 rounded-full bg-primary shadow-[0_0_0_2px_var(--background)]"
          aria-hidden
        />
      )}
    </Button>
  )
}
