/**
 * TabBar —— 浏览器 / VS Code 风格文档 tab 条.
 *
 * 布局:
 *   [Home] [tab · x] [tab · x] ... [+]
 * 每个元素撑满整个 titlebar 高度 (h-full = 40px), 内部 items-center 竖向居中.
 * 活动 tab 用底部一条 primary 色下划线 + 背景色区分.
 *
 * 溢出策略:
 *   - overflow-x-auto, 滚动条隐藏.
 *   - 鼠标滚轮 (垂直) 转横向滚动.
 */
import { Home, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
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
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { defaultMindmapData } from '@zoeymind/shared'
import { i18next } from '@zoeymind/i18n'

export function TabBar() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const setActive = useTabs(s => s.setActive)
  const closeTab = useTabs(s => s.closeTab)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)

  const onPlus = () => {
    const title = i18next.t('mindmap.editor.newProjectTitle', '未命名思维导图')
    const id = pendingProjects.stash({ title, tree: defaultMindmapData })
    useTabs.getState().openTab({ id, kind: 'draft', title })
  }

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el) return
    const dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    if (dy === 0) return
    el.scrollLeft += dy
  }

  const requestClose = (tab: OpenTab) => {
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

  return (
    <>
      <div
        ref={scrollerRef}
        onWheel={onWheel}
        data-tauri-drag-region
        className="flex h-full min-w-0 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <HomeChip active={activeId === 'home'} onClick={() => setActive('home')} />
        {tabs.map(tab => (
          <TabChip
            key={tab.id}
            tab={tab}
            active={activeId === tab.id}
            onSelect={() => setActive(tab.id)}
            onClose={e => {
              e.stopPropagation()
              requestClose(tab)
            }}
          />
        ))}
        <button
          type="button"
          onClick={onPlus}
          aria-label="New tab"
          title="新项目"
          data-tauri-drag-region="false"
          className="flex h-full items-center justify-center px-2.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
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
          onSave={() => {
            setActive(pendingTab.id)
            setPendingCloseId(null)
          }}
        />
      )}
    </>
  )
}

const chipBase =
  'group relative inline-flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-transparent px-3 text-xs transition-colors'

const chipActive =
  'bg-background text-foreground after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'

const chipInactive =
  'text-muted-foreground hover:bg-muted/60 hover:text-foreground'

function HomeChip({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tauri-drag-region="false"
      className={cn(chipBase, active ? chipActive : chipInactive, 'px-2.5')}
      aria-label="Home"
      title="Home"
    >
      <Home className="size-4" />
    </button>
  )
}

interface TabChipProps {
  tab: OpenTab
  active: boolean
  onSelect: () => void
  onClose: (e: React.MouseEvent) => void
}

function TabChip({ tab, active, onSelect, onClose }: TabChipProps) {
  return (
    <div
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      data-tauri-drag-region="false"
      className={cn(
        chipBase,
        active ? chipActive : chipInactive,
        'max-w-[220px] pr-1'
      )}
      title={tab.title}
    >
      <span className="truncate">{tab.title}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close tab"
        className={cn(
          'inline-flex size-5 items-center justify-center rounded hover:bg-muted',
          !active && 'opacity-0 group-hover:opacity-100'
        )}
      >
        <X className="size-3" />
      </button>
    </div>
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
          此 tab 有未保存的改动. 关闭后未保存内容会丢失.
        </p>
        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button variant="outline" onClick={onDiscard}>
            不保存
          </Button>
          <Button onClick={() => void onSave()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
