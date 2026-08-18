// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
/**
 * Workspace 全局搜索弹框 — shadcn CommandDialog.
 *
 * 触发: sidebar 搜索按钮 / 快捷键 ⌘K (Ctrl+K).
 * 数据源: 当前组织下的所有用户可见 mindmap (trpc.mindmap.list).
 *
 * 展示分组:
 *   - 空 query: 按 workspace 分组, 每组内按 updatedAt desc
 *   - 有 query: 平铺 (cmdk 按相关度排序), 每条右侧显示所属 workspace 徽章
 *
 * 结果点击 → navigate 到目标 mindmap.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@zoeymind/ui'
import { WorkspaceAvatar } from '@/shared/auth'
import { UserAvatarWithCard } from '@/shared/app-shared'
import { trpc } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'
import { useMindmapCover } from './hooks/useMindmapCover'

interface WorkspaceSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  /** 未传 → 搜索用户在该组织内可见的全部 mindmap (跨 workspace). */
  workspaceId?: string | null
}

interface MindmapProjectRef {
  id: string
  name: string
  avatar: string | null
}

interface MindmapSearchRow {
  id: string
  title: string
  description?: string | null
  nodeCount?: number
  creator?: { id: string; name: string | null; avatar: string | null } | null
  workspace?: MindmapProjectRef | null
}

export function WorkspaceSearchDialog({
  open,
  onOpenChange,
  organizationId,
  workspaceId
}: WorkspaceSearchDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const listQuery = trpc.mindmap.list.useQuery(
    {
      organizationId,
      workspaceId: workspaceId ?? undefined,
      page: 1,
      limit: 200
    },
    { enabled: open && !!organizationId }
  )

  const mindmaps = useMemo<MindmapSearchRow[]>(
    () => (listQuery.data?.success ? (listQuery.data.data as MindmapSearchRow[]) : []),
    [listQuery.data]
  )

  // 按 workspace 分组 (空 query 时用)
  const grouped = useMemo(() => {
    const map = new Map<string, { workspace: MindmapProjectRef; items: MindmapSearchRow[] }>()
    const orphan: MindmapSearchRow[] = []
    for (const m of mindmaps) {
      if (m.workspace) {
        const bucket = map.get(m.workspace.id) ?? { workspace: m.workspace, items: [] }
        bucket.items.push(m)
        map.set(m.workspace.id, bucket)
      } else {
        orphan.push(m)
      }
    }
    return { groups: [...map.values()], orphan }
  }, [mindmaps])

  const handleSelect = (mindmapId: string) => {
    navigate({
      to: '/org/$orgId/zoeymind/editor/$id',
      params: { orgId: organizationId, id: mindmapId }
    })
    onOpenChange(false)
  }

  const showGrouped = query.trim().length === 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('projects.search.title', '搜索思维导图')}
      description={t('projects.search.desc', '搜索你可访问的所有思维导图')}
    >
      <CommandInput
        placeholder={t('projects.search.placeholder', '输入名称或描述…')}
        value={query}
        onValueChange={setQuery}
        autoFocus
      />
      <CommandList>
        <CommandEmpty>
          {listQuery.isLoading
            ? t('common.loading')
            : t('projects.search.empty', '没有匹配的思维导图')}
        </CommandEmpty>

        {showGrouped &&
          grouped.groups.map((g, i) => (
            <div key={g.workspace.id}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup value={g.workspace.id} heading={g.workspace.name}>
                {g.items.map(m => (
                  <MindmapCommandItem
                    key={m.id}
                    m={m}
                    onSelect={handleSelect}
                    showProjectBadge={false}
                  />
                ))}
              </CommandGroup>
            </div>
          ))}
        {showGrouped && grouped.orphan.length > 0 && (
          <>
            {grouped.groups.length > 0 && <CommandSeparator />}
            <CommandGroup value="__orphan__" heading={t('projects.search.other', '其它')}>
              {grouped.orphan.map(m => (
                <MindmapCommandItem
                  key={m.id}
                  m={m}
                  onSelect={handleSelect}
                  showProjectBadge={false}
                />
              ))}
            </CommandGroup>
          </>
        )}

        {/* 有 query: 平铺 + 徽章 */}
        {!showGrouped && mindmaps.length > 0 && (
          <CommandGroup value="__matches__" heading={t('projects.search.matches', '匹配结果')}>
            {mindmaps.map(m => (
              <MindmapCommandItem key={m.id} m={m} onSelect={handleSelect} showProjectBadge />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

function MindmapCommandItem({
  m,
  onSelect,
  showProjectBadge
}: {
  m: MindmapSearchRow
  onSelect: (mindmapId: string) => void
  showProjectBadge: boolean
}) {
  const { t } = useTranslation()
  const creatorName = m.creator?.name ?? ''
  const projectName = m.workspace?.name ?? ''
  const { dataUrl } = useMindmapCover(m.id)
  return (
    <CommandItem
      value={m.id}
      keywords={[m.title, m.description ?? '', creatorName, projectName]}
      onSelect={() => onSelect(m.id)}
    >
      {/* 左侧: 缩略图 or 文档图标 (shadcn 默认 icon size-4, size-6 稍大保留缩略图辨识度) */}
      {dataUrl ? (
        <div className="size-6 shrink-0 overflow-hidden rounded-sm border bg-muted">
          <img src={dataUrl} alt="" className="size-full object-cover" />
        </div>
      ) : (
        <FileText className="text-muted-foreground" />
      )}

      {/* 中间: 标题 (单行, 描述省略, 保持 command 一行紧凑) */}
      <span className="truncate">{m.title}</span>

      {/* 右侧: workspace 徽章 + 用例数 + 创建者头像 */}
      <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {showProjectBadge && m.workspace && (
          <div className="flex items-center gap-1">
            <WorkspaceAvatar workspace={m.workspace} size="xs" />
            <span className="max-w-24 truncate">{m.workspace.name}</span>
          </div>
        )}
        {typeof m.nodeCount === 'number' && m.nodeCount > 0 && (
          <span className="tabular-nums">
            {t('projects.search.nodeCount', '{{n}} 用例', { n: m.nodeCount })}
          </span>
        )}
        {m.creator && (
          <UserAvatarWithCard
            user={{ name: m.creator.name, avatar: m.creator.avatar }}
            size="xs"
            showCard={false}
          />
        )}
      </div>
    </CommandItem>
  )
}

/** 全局快捷键 ⌘K / Ctrl+K 触发 hook. */
export function useSearchShortcut(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])
}

/** 供 sidebar 触发按钮显示当前平台的快捷键提示 (mac 显示 ⌘K, 其它显示 Ctrl K). */
export function SearchShortcutHint() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {isMac ? '⌘' : 'Ctrl'}
      <span className="text-[8px]">+</span>K
    </kbd>
  )
}