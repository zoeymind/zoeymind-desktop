/**
 * 工作区 TabBar —— 浏览器 / VS Code 风格的文档 tab 条.
 *
 * 结构 (从左到右):
 *   [Home (固定, home icon)] [tab1 · x] [tab2 · x] ... [+ 新 tab]
 *
 * 布局约束:
 *   - 外壳 flex-1 min-w-0, 里面 overflow-x-auto: tab 数量超过宽度自动横向滚动.
 *   - 支持鼠标滚轮 (垂直 -> 横向) 快速滑动.
 *   - TitleBar 里给一段拖拽 gap, 由 title-bar 保证; TabBar 内部按钮都禁止 drag.
 */
import { Home, Plus, X } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '@zoeymind/ui'
import { useTabs, type OpenTab } from '@/shared/tabs/store'
import { pendingProjects } from '@/shared/native'
import { defaultMindmapData } from '@zoeymind/shared'
import { i18next } from '@zoeymind/i18n'

export function TabBar() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const setActive = useTabs(s => s.setActive)
  const closeTab = useTabs(s => s.closeTab)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const onPlus = () => {
    const title = i18next.t('mindmap.editor.newProjectTitle', '未命名思维导图')
    const id = pendingProjects.stash({ title, tree: defaultMindmapData })
    useTabs.getState().openTab({ id, kind: 'draft', title })
  }

  // 鼠标滚轮 (垂直) 转横向滚动.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el) return
    const dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    if (dy === 0) return
    el.scrollLeft += dy
  }

  return (
    <div
      ref={scrollerRef}
      onWheel={onWheel}
      className="flex h-full min-w-0 items-end gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            closeTab(tab.id)
          }}
        />
      ))}
      <button
        type="button"
        onClick={onPlus}
        aria-label="New tab"
        title="新项目"
        className="ml-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

function HomeChip({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-t-md border border-b-0 px-2 text-xs transition-colors',
        active
          ? 'border-border bg-background text-foreground'
          : 'border-transparent bg-transparent text-muted-foreground hover:text-foreground'
      )}
      aria-label="Home"
      title="Home"
    >
      <Home className="size-3.5" />
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
      className={cn(
        'group inline-flex h-7 max-w-[220px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 pl-2.5 pr-1 text-xs transition-colors',
        active
          ? 'border-border bg-background text-foreground'
          : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
      title={tab.title}
    >
      <span className="truncate">{tab.title}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close tab"
        className={cn(
          'inline-flex size-4 items-center justify-center rounded hover:bg-muted',
          !active && 'opacity-0 group-hover:opacity-100'
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
