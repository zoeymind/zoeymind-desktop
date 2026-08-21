/**
 * TabBar —— beUI MorphingTabs + Home 独立 chip + '+' 按钮.
 *
 * 布局 (titlebar 高 80px):
 *   [Home][MorphingTabs (项目 tabs)][+]
 *
 * Home / '+' 独立于 MorphingTabs, 不参与拖拽重排; MorphingTabs 只装项目 tabs,
 * 提供液态过渡 (active tab 底部弧形融进画布) + spring 拖拽重排 + 自适应宽度.
 *
 * items[i].content 一律 null: 真正 content 由 WorkspaceShell 的 EditorPane 在下方
 * 挂载, MorphingTabs 只做 tab strip. classNames.content='hidden' 隐藏其自带面板；
 * 激活 Tab 的液态表面与下方工作区统一使用 editor-shell 语义 token。
 */
import { Home, Loader2, Plus } from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoeymind/ui"
import { useTabs, type OpenTab } from "@/shared/tabs/store"
import { pendingProjects } from "@/shared/native"
import { tabSaveFns } from "@/shared/tabs/instances"
import { useTabLoading } from "@/shared/tabs/loading"
import { logger } from "@zoeymind/logger"
import { projectSessionRegistry } from "@/products/mind/editor-session"
import { defaultMindmapData } from "@zoeymind/shared"
import { i18next } from "@zoeymind/i18n"
import { MorphingTabs, type MorphingTabsItem } from "@/components/motion/morphing-tabs"

export function TabBar({ isMac = true }: { isMac?: boolean } = {}) {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const setActive = useTabs(s => s.setActive)
  const closeTab = useTabs(s => s.closeTab)
  const reorderTabs = useTabs(s => s.reorderTabs)
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)
  const sessionRevision = useSyncExternalStore(
    projectSessionRegistry.subscribe,
    projectSessionRegistry.getRevision,
    projectSessionRegistry.getRevision
  )
  const tabLoading = useTabLoading(s => s.loading)

  const onPlus = () => {
    const title = i18next.t("mindmap.editor.newProjectTitle", "未命名思维导图")
    const id = pendingProjects.stash({ title, tree: defaultMindmapData })
    useTabs.getState().openTab({ id, kind: "draft", title })
  }

  const requestClose = (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (!tab) return
    const dirty = projectSessionRegistry.get(tab.id)?.getState().dirty ?? false
    const pending = tab.kind !== "file" && pendingProjects.isPending(tab.id)
    if (dirty || pending) {
      setPendingCloseId(tab.id)
    } else {
      closeTab(tab.id)
    }
  }

  const pendingTab = pendingCloseId ? (tabs.find(t => t.id === pendingCloseId) ?? null) : null

  // MorphingTabs items: 每个 tab 的 label = 文件名 (或"加载中…"), content=null.
  const morphItems: MorphingTabsItem[] = [
    {
      id: "home",
      label: "",
      icon: <Home className="size-3.5" />,
      content: null,
      pinned: true,
    },
    ...tabs.map(tab => {
      const loading = tabLoading[tab.id] === true
      const dirty =
        tab.kind !== "file" || (projectSessionRegistry.get(tab.id)?.getState().dirty ?? false)
      const title =
        tab.kind === "recovery"
          ? i18next.t("recovery.recoveredTabTitle", {
              name: tab.title || "无标题",
            })
          : tab.title || "无标题"
      return {
        id: tab.id,
        label: loading ? "加载中…" : title,
        icon: loading ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : dirty ? (
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-foreground/70" />
        ) : null,
        content: null,
      }
    }),
  ]
  void sessionRevision

  return (
    <>
      {/*
        MorphingTabs 铺满整个 titlebar。startInset 给 macOS 红绿灯让位，
        endInset 只约束 tab 与 '+' 的可用区域，并给右侧设置/窗口按钮留位；
        液态 panel SVG 仍使用完整 surfaceWidth，从 x=0 铺到窗口最右端。
       */}
      <div className="relative flex h-full w-full min-w-0 items-stretch">
        <MorphingTabs
          items={morphItems}
          value={activeId ?? "home"}
          onValueChange={id => setActive(id === "home" ? "home" : (id ?? "home"))}
          onOrderChange={ids => {
            const projectIds = ids.filter(id => id !== "home")
            reorderTabs(projectIds)
          }}
          onClose={requestClose}
          ariaLabel="项目 tabs"
          startInset={isMac ? 88 : 8}
          endInset={isMac ? 80 : 192}
          trailing={<PlusChip onClick={onPlus} />}
          className="min-w-0 flex-1"
          classNames={{
            activeTab: "text-editor-shell",
            content: "hidden",
          }}
        />
      </div>

      {pendingTab && (
        <CloseConfirmDialog
          tab={pendingTab}
          onCancel={() => setPendingCloseId(null)}
          onDiscard={() => {
            if (pendingTab.kind !== "file") pendingProjects.clear(pendingTab.id)
            projectSessionRegistry.get(pendingTab.id)?.getState().setDirty(false)
            closeTab(pendingTab.id)
            setPendingCloseId(null)
          }}
          onSave={async () => {
            setActive(pendingTab.id)
            const handle = tabSaveFns.get(pendingTab.id)
            if (!handle) return
            try {
              await handle.save()
            } catch (error) {
              logger.error("close-save failed", error)
              return
            }
            if (projectSessionRegistry.get(pendingTab.id)?.getState().dirty) {
              setPendingCloseId(null)
              return
            }
            closeTab(pendingTab.id)
            setPendingCloseId(null)
          }}
        />
      )}
    </>
  )
}

// '+' 按钮：紧贴最后一个 tab，使用通用圆形图标按钮。
function PlusChip({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label="New tab"
      title="新项目"
      data-tauri-drag-region="false"
      className="ml-1 shrink-0 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
    >
      <Plus className="size-3.5" />
    </Button>
  )
}
interface CloseConfirmProps {
  tab: OpenTab
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void | Promise<void>
}

function CloseConfirmDialog({ tab, onCancel, onDiscard, onSave }: CloseConfirmProps) {
  return (
    <Dialog open onOpenChange={next => (!next ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>关闭 “{tab.title}” 前保存吗?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          未保存的改动会丢失. 保存后再关闭, 或直接放弃.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            不保存
          </Button>
          <Button onClick={() => void onSave()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
