/**
 * Header 保存快捷按钮 —— File 菜单右侧的固定入口。
 *
 * 消费 SaveFlowContext (由 EditorShell 挂 Provider), 与 useStorageManager 共享
 * 同一份 stateRef, 确保 registerBundleSource 写入的 tree 和这里的 save() 是同一份.
 *
 * 交互:
 *   - pending 新建 -> flow.save() 弹 native saveDialog 选 .zmind 落盘路径
 *   - 已入库    -> 直接写回原路径
 *   - dirty 或 pending 时按钮亮起, 否则淡化
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
  const highlight = isDirty || pending

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
      title="保存 (Cmd/Ctrl+S)"
      className={highlight ? '' : 'text-muted-foreground'}
      aria-label="save"
    >
      <Save className="size-4" />
    </Button>
  )
}
