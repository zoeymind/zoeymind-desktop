// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { useState } from 'react'
import { Check, Folder as FolderIcon, FolderMinus } from 'lucide-react'
import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '@zoeymind/ui'
import { trpcClient, toast, useOrganization } from '@/shared/app-shared'
import { WorkspaceAvatar } from '@/shared/auth'
import { useCurrentWorkspace } from '@/shared/organization'
import { useTranslation } from '@zoeymind/i18n'
import { useFolders } from './hooks/useFolders'
import type { CloudProjectWithStats } from './hooks/useCloudProjects'

interface MoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: CloudProjectWithStats | null
  onMoved?: () => void
}

const rowClass =
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left transition-colors hover:bg-accent disabled:opacity-50'

/**
 * 思维导图「移动到…」弹框 — 两个 tab:
 *   - 移动到文件夹 (folder 组织级共享, 不跨 workspace 保留)
 *   - 移动到项目空间 (workspace/project, 同一组织内跨 workspace)
 *
 * 不支持跨组织 (team) 移动: 权限/协作者会失联, 用户如果需要请复制导出.
 */
export function MoveDialog({ open, onOpenChange, project, onMoved }: MoveDialogProps) {
  const { t } = useTranslation()
  const { folders } = useFolders()
  const { currentOrg } = useOrganization()
  const { list: workspaces } = useCurrentWorkspace(currentOrg?.id ?? null, currentOrg?.role)
  const [busy, setBusy] = useState(false)

  if (!project) return null

  const currentProjectId = project.workspaceId ?? null
  const otherWorkspaces = workspaces.filter(w => w.id !== currentProjectId)

  const moveToFolder = async (folderId: string | null) => {
    if (busy) return
    setBusy(true)
    try {
      await trpcClient.mindmap.moveToFolder.mutate({ mindmapId: project.id, folderId })
      toast({ description: t('projects.home.moveSuccess'), variant: 'success' })
      onMoved?.()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: t('projects.home.moveTo'),
        description: e instanceof Error ? e.message : '',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  const moveToProject = async (targetId: string, targetName: string) => {
    if (busy) return
    setBusy(true)
    try {
      await trpcClient.mindmap.moveToProject.mutate({
        mindmapId: project.id,
        workspaceId: targetId
      })
      toast({
        description: t('projects.home.moveProjectSuccess', { name: targetName }),
        variant: 'success'
      })
      onMoved?.()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: t('projects.home.moveTo'),
        description: e instanceof Error ? e.message : '',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('projects.home.moveTo')}</DialogTitle>
          <DialogDescription className="truncate">{project.title}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="folder">
          <TabsList className="w-full">
            <TabsTrigger value="folder" className="flex-1">
              {t('projects.home.moveToFolder')}
            </TabsTrigger>
            <TabsTrigger value="project" className="flex-1">
              {t('projects.home.moveToProject')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="folder" className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            <button
              type="button"
              disabled={busy}
              onClick={() => moveToFolder(null)}
              className={cn(rowClass, !project.folderId && 'bg-accent/60')}
            >
              <FolderMinus className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{t('projects.home.moveOutFolder')}</span>
              {!project.folderId && <Check className="size-4 shrink-0 text-primary" />}
            </button>
            {folders.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                {t('projects.home.noFolderToMove')}
              </p>
            ) : (
              folders.map(f => (
                <button
                  key={f.id}
                  type="button"
                  disabled={busy}
                  onClick={() => moveToFolder(f.id)}
                  className={cn(rowClass, project.folderId === f.id && 'bg-accent/60')}
                >
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  {project.folderId === f.id && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </TabsContent>

          <TabsContent value="project" className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {otherWorkspaces.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                {t('projects.home.noOtherProject')}
              </p>
            ) : (
              otherWorkspaces.map(w => {
                const canEdit = w.myRole !== 'VIEWER'
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={busy || !canEdit}
                    onClick={() => moveToProject(w.id, w.name)}
                    className={rowClass}
                    title={canEdit ? undefined : t('projects.home.noEditPermission', '无编辑权限')}
                  >
                    <WorkspaceAvatar workspace={w} size="sm" />
                    <span className="flex-1 truncate">{w.name}</span>
                  </button>
                )
              })
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}