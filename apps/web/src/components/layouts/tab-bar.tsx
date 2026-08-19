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
 * 挂载, MorphingTabs 只做 tab strip. classNames.content='hidden' 隐藏其自带面板;
 * classNames.activeTab='!text-background' 让液态 SVG 的 fill 用主题 background 色,
 * 视觉上和下面画布连成一片.
 */
import { Home, Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn
} from '@zoeymind/ui'
import { useTabs, type OpenTab } from '@/shared/tabs/store'
import { pendingProjects } from '@/shared/native'
import { tabDirty, tabSaveFns } from '@/shared/tabs/instances'
import { useTabLoading } from '@/shared/tabs/loading'
import { logger } from '@zoeymind/logger'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { defaultMindmapData } from '@zoeymind/shared'
import { i18next } from '@zoeymind/i18n'
import { MorphingTabs, type MorphingTabsItem } from '@/components/motion/morphing-tabs'

export function TabBar() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const setActive = useTabs(s => s.setActive)
  const closeTab = useTabs(s => s.closeTab)
  const reorderTabs = useTabs(s => s.reorderTabs)
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)
  const liveDirty = useMindMapStore(s => s.isDirty)
  const tabLoading = useTabLoading(s => s.loading)

  const onPlus = () => {
    const title = i18next.t('mindmap.editor.newProjectTitle', '未命名思维导图')
    const id = pendingProjects.stash({ title, tree: defaultMindmapData })
    useTabs.getState().openTab({ id, kind: 'draft', title })
  }

  const requestClose = (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (!tab) return
    const isActiveTab = activeId === tab.id
    const dirty = isActiveTab && useMindMapStore.getState().isDirty
    const pending = tab.kind === 'draft' && pendingProjects.isPending(tab.id)
    if (dirty || pending) {
      setPendingCloseId(tab.id)
    } else {
      closeTab(tab.id)
    }
  }

  const pendingTab = pendingCloseId ? tabs.find(t => t.id === pendingCloseId) ?? null : null

  // MorphingTabs items: 每个 tab 的 label = 文件名 (或"加载中…"), content=null.
  const morphItems: MorphingTabsItem[] = useMemo(
    () =>
      tabs.map(tab => {
        const loading = tabLoading[tab.id] === true
        const isActiveTab = activeId === tab.id
        const dirty =
          tab.kind === 'draft' ||
          (isActiveTab ? liveDirty : tabDirty.get(tab.id))
        return {
          id: tab.id,
          label: loading ? '加载中…' : tab.title || '无标题',
          icon: loading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : dirty ? (
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-foreground/70"
            />
          ) : null,
          content: null
        }
      }),
    [tabs, tabLoading, activeId, liveDirty]
  )

  return (
    <>
      <div className="flex h-full w-full min-w-0 items-stretch">
        <HomeChip active={activeId === 'home'} onClick={() => setActive('home')} />

        <div className="flex min-w-0 flex-1 items-stretch" data-tauri-drag-region>
          {tabs.length > 0 && (
            <MorphingTabs
              items={morphItems}
              value={activeId === 'home' ? null : (activeId ?? null)}
              onValueChange={id => {
                if (id) setActive(id)
              }}
              onOrderChange={ids => reorderTabs(ids)}
              onClose={requestClose}
              ariaLabel="项目 tabs"
              className="!rounded-none !bg-transparent !overflow-visible !text-foreground shrink-0 min-w-0 flex-1"
              classNames={{
                root: '!rounded-none !bg-transparent !overflow-visible !text-foreground',
                rail: 'items-stretch',
                tab: '!text-foreground',
                activeTab: '!text-background',
                label: '!text-foreground',
                content: 'hidden'
              }}
            />
          )}
        </div>

        <PlusChip onClick={onPlus} />
      </div>

      {pendingTab && (
        <CloseConfirmDialog
          tab={pendingTab}
          onCancel={() => setPendingCloseId(null)}
          onDiscard={() => {
            if (pendingTab.kind === 'draft') pendingProjects.clear(pendingTab.id)
            useMindMapStore.getState().setDirty(false)
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
              logger.error('close-save failed', error)
              return
            }
            if (useMindMapStore.getState().isDirty) {
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

// Home chip: 独立于 MorphingTabs, 对齐它的 tab 视觉:
// MorphingTabs 内部 tab 有 marginTop=12, height=44 -> Home 用 mt-3 (12px) h-11 (44px).
function HomeChip({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tauri-drag-region="false"
      aria-label="Home"
      title="Home"
      className={cn(
        'group relative mt-3 h-11 shrink-0 inline-flex items-center px-3 text-xs rounded-xl transition-colors',
        active
          ? 'bg-background text-foreground z-20'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
      )}
    >
      <Home className="size-4" />
    </button>
  )
}

function PlusChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="New tab"
      title="新项目"
      data-tauri-drag-region="false"
      className="mt-3 h-11 shrink-0 inline-flex items-center justify-center px-2.5 rounded-xl text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
    >
      <Plus className="size-4" />
    </button>
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
