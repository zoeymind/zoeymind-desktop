// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { useState } from 'react'
import { RotateCcw, Trash2, Loader2, Info } from 'lucide-react'
import { Button } from '@zoeymind/ui'
import { trpc, useOrganization, toast } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'
import { DeleteDialog } from './dialogs'

interface TrashListProps {
  searchText: string
  onChanged?: () => void
}

/** 与后端 trash-purge.service.ts 的 TRASH_RETENTION_DAYS 保持一致。 */
const TRASH_RETENTION_DAYS = 30

/**
 * 回收站：列出当前组织内自己软删除的思维导图，支持还原 / 彻底删除。
 * 超过保留期由后台定时任务自动永久删除。
 */
export function TrashList({ searchText, onChanged }: TrashListProps) {
  const { t } = useTranslation()
  const { currentOrg } = useOrganization()
  const utils = trpc.useUtils()
  const orgId = currentOrg?.id ?? ''

  const listQuery = trpc.mindmap.listTrash.useQuery({ organizationId: orgId }, { enabled: !!orgId })
  const restoreMutation = trpc.mindmap.restore.useMutation()
  const purgeMutation = trpc.mindmap.purge.useMutation()
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; title: string } | null>(null)

  const items = listQuery.data?.data ?? []
  const filtered = searchText
    ? items.filter(m => m.title.toLowerCase().includes(searchText.toLowerCase()))
    : items

  const refresh = () => {
    void utils.mindmap.listTrash.invalidate()
    // restore 会把项目放回活动列表; purge 从 trash 移除, 活动列表不受影响 —— 但一起 invalidate
    // 不会引入 bug (活动列表的 stale 判定会命中缓存), 收益是消灭 "怎么恢复了还看不到" 的困惑
    void utils.mindmap.list.invalidate()
    void utils.mindmap.listSharedWithMe.invalidate()
    onChanged?.()
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreMutation.mutateAsync({ mindmapId: id })
      toast({ description: t('projects.home.restoreSuccess'), variant: 'success' })
      refresh()
    } catch (e) {
      toast({
        title: t('projects.home.restore'),
        description: e instanceof Error ? e.message : '',
        variant: 'destructive'
      })
    }
  }

  const handlePurge = async () => {
    if (!purgeTarget) return
    await purgeMutation.mutateAsync({ mindmapId: purgeTarget.id })
    setPurgeTarget(null)
    refresh()
  }

  if (listQuery.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" />
        {t('projects.home.trashNotice', { days: TRASH_RETENTION_DAYS })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {t('projects.home.trashEmpty')}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.title}</div>
                {m.deletedAt && (
                  <div className="text-xs text-muted-foreground">
                    {t('projects.home.deletedAtLabel', {
                      date: new Date(m.deletedAt).toLocaleString()
                    })}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                disabled={restoreMutation.isPending}
                onClick={() => handleRestore(m.id)}
              >
                <RotateCcw className="size-4" />
                {t('projects.home.restore')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setPurgeTarget({ id: m.id, title: m.title })}
              >
                <Trash2 className="size-4" />
                {t('projects.home.purge')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <DeleteDialog
        open={!!purgeTarget}
        onOpenChange={open => !open && setPurgeTarget(null)}
        itemName={purgeTarget?.title ?? ''}
        title={t('projects.home.purgeTitle', { itemName: purgeTarget?.title ?? '' })}
        description={t('projects.home.purgeDesc')}
        destructiveText={t('projects.home.purge')}
        onConfirm={handlePurge}
        loading={purgeMutation.isPending}
      />
    </div>
  )
}