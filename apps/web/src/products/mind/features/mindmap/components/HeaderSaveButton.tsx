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
import { Loader2, Save } from "lucide-react"
import { Button } from "@zoeymind/ui"
import { saveWithToast, useSaveFlowContext, pendingProjects } from "@/shared/native"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useProjectContext } from "@/products/mind/features/mindmap/contexts/ProjectContext"
import { useTabs } from "@/shared/tabs/store"

export function HeaderSaveButton(): React.JSX.Element {
  const flow = useSaveFlowContext()
  const { workspaceId } = useProjectContext()
  const isDirty = useMindMapStore(s => s.isDirty)
  // pending 语义: '真正的 draft', 与 TabBar.requestClose 对齐. draft 保存后 tab.kind
  // 已翻 'file' 但 pendingProjects stash 仍保留 (给 useCanvasManager 用 workspaceId
  // 读 tree), 若只看 pendingProjects 会把已保存 tab 误判为 pending.
  const isDraftTab = useTabs(
    s => !!workspaceId && s.tabs.find(t => t.id === workspaceId)?.kind === "draft"
  )
  const pending = isDraftTab && !!workspaceId && pendingProjects.isPending(workspaceId)
  const dirty = isDirty || pending
  const saving = flow.savePhase !== "idle" && flow.savePhase !== "failed"

  const handleClick = async () => {
    if (saving) return
    await saveWithToast(flow.save, workspaceId)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={saving}
      title={
        saving ? "保存中..." : dirty ? "保存 · 未保存的改动 (Cmd/Ctrl+S)" : "保存 (Cmd/Ctrl+S)"
      }
      className={`relative rounded-full ${dirty ? "" : "text-muted-foreground"}`}
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
