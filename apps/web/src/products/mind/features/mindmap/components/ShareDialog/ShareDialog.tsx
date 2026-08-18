import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagsInput,
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemActions,
  ItemDescription,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription
} from '@zoeymind/ui'
import { toast, trpc, UserAvatarWithCard } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'
import { Globe, Lock, Folder, Copy, Trash2, Mail, Users, Link as LinkIcon } from 'lucide-react'
import {
  MindmapRoles,
  MindmapVisibilities,
  type MindmapRole,
  type MindmapVisibility
} from '@zoeymind/shared'
import { useTranslation } from '@zoeymind/i18n'
import { ShareExportTab } from './ShareExportTab'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectTitle: string
}

const ASSIGNABLE_ROLES: MindmapRole[] = [MindmapRoles.VIEWER, MindmapRoles.EDITOR]

export function ShareDialog({ open, onOpenChange, workspaceId }: ShareDialogProps) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const params = useParams({ strict: false }) as { orgId?: string }
  const mindmapId = workspaceId
  const enabled = open && !!mindmapId

  const roleLabel = (role: MindmapRole): string =>
    ({
      VIEWER: t('mindmap.shareDialog.roleViewer'),
      EDITOR: t('mindmap.shareDialog.roleEditor'),
      OWNER: t('mindmap.shareDialog.roleOwner')
    })[role]

  // ─── queries ───────────────────────────────────────
  // 是否为思维导图所有者：决定能否管理协作者（check 对无权限优雅返回，不抛）
  const checkQuery = trpc.mindmap.permission.check.useQuery({ mindmapId }, { enabled })
  const isOwner = checkQuery.data?.isOwner ?? false

  // 管理类查询仅所有者运行，避免非所有者触发 write 门报 PERMISSION_DENIED
  const quotaQuery = trpc.mindmap.permission.invitation.quota.useQuery(
    { mindmapId },
    { enabled: enabled && isOwner }
  )
  const collaboratorsQuery = trpc.mindmap.permission.listCollaborators.useQuery(
    { mindmapId },
    { enabled }
  )
  const invitationsQuery = trpc.mindmap.permission.invitation.list.useQuery(
    { mindmapId },
    { enabled: enabled && isOwner }
  )
  const shareLinksQuery = trpc.mindmap.permission.shareLink.list.useQuery(
    { mindmapId },
    { enabled }
  )
  // 当前可见性作用域 + 归属 project — 仅 owner 关心
  const mindmapMetaQuery = trpc.mindmap.getById.useQuery({ mindmapId }, { enabled })
  const currentVisibility: MindmapVisibility =
    (mindmapMetaQuery.data?.mindmap as { visibility?: MindmapVisibility } | undefined)
      ?.visibility ?? MindmapVisibilities.PRIVATE
  const currentProjectId: string | null =
    (mindmapMetaQuery.data?.mindmap as { workspaceId?: string | null } | undefined)?.workspaceId ??
    null

  // Org 内的项目列表 — 用于"发布到项目"下拉
  const projectListQuery = trpc.project.list.useQuery(
    { organizationId: params.orgId ?? '' },
    { enabled: enabled && isOwner && !!params.orgId }
  )
  const projectList: Array<{ id: string; name: string }> = projectListQuery.data ?? []

  const refresh = (): void => {
    void utils.mindmap.permission.invitation.quota.invalidate({ mindmapId })
    void utils.mindmap.permission.listCollaborators.invalidate({ mindmapId })
    void utils.mindmap.permission.invitation.list.invalidate({ mindmapId })
    void utils.mindmap.permission.shareLink.list.invalidate({ mindmapId })
    void utils.mindmap.getById.invalidate({ mindmapId })
  }

  // ─── state + mutations ─────────────────────────────
  const [emails, setEmails] = useState<string[]>([])
  const [inviteRole, setInviteRole] = useState<MindmapRole>(MindmapRoles.EDITOR)
  const [inviteView, setInviteView] = useState<'entry' | 'invite' | 'manage'>('entry')
  const [inviting, setInviting] = useState(false)

  const inviteMut = trpc.mindmap.permission.invitation.create.useMutation()

  const revokeMut = trpc.mindmap.permission.invitation.revoke.useMutation({
    onSuccess: () => {
      toast({ description: t('mindmap.shareDialog.revokeSuccess') })
      refresh()
    },
    onError: error => {
      logger.error('撤销邀请失败:', error)
      toast({
        title: t('mindmap.shareDialog.revokeFailed'),
        description: t('mindmap.shareDialog.revokeFailedDescription'),
        variant: 'destructive'
      })
    }
  })

  const removeMut = trpc.mindmap.permission.removeCollaborator.useMutation({
    onSuccess: () => {
      toast({ description: t('mindmap.shareDialog.removeSuccess') })
      refresh()
    },
    onError: error => {
      logger.error('移除协作者失败:', error)
      toast({
        title: t('mindmap.shareDialog.removeFailed'),
        description: t('mindmap.shareDialog.removeFailedDescription'),
        variant: 'destructive'
      })
    }
  })

  const updateRoleMut = trpc.mindmap.permission.updateCollaboratorRole.useMutation({
    onSuccess: () => {
      toast({ description: t('mindmap.shareDialog.updateRoleSuccess') })
      refresh()
    },
    onError: error => {
      logger.error('更新协作者角色失败:', error)
      toast({
        title: t('mindmap.shareDialog.updateRoleFailed'),
        description: t('mindmap.shareDialog.updateRoleFailedDescription'),
        variant: 'destructive'
      })
    }
  })

  const createLinkMut = trpc.mindmap.permission.shareLink.create.useMutation()
  const deleteLinkMut = trpc.mindmap.permission.shareLink.delete.useMutation()

  const setPublishMut = trpc.mindmap.permission.setPublish.useMutation({
    onSuccess: () => {
      toast({ description: t('mindmap.shareDialog.publish.updateSuccess') })
      refresh()
    },
    onError: error => {
      logger.error('更新发布状态失败:', error)
      toast({
        title: t('mindmap.shareDialog.publish.updateFailed'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive'
      })
    }
  })

  // ─── derived ───────────────────────────────────────
  const quota = quotaQuery.data?.data
  const canInvite = !quota || quota.allowed
  const collaborators = collaboratorsQuery.data?.data ?? []
  const invitations = invitationsQuery.data?.data ?? []
  const shareLinks = shareLinksQuery.data?.success ? shareLinksQuery.data.shareLinks : []
  const viewerLink = shareLinks.find(l => l.role === MindmapRoles.VIEWER && l.isActive)

  const linkUrl = (linkId: string): string => `${window.location.origin}/mindmap/shared/${linkId}`

  // ─── handlers ──────────────────────────────────────
  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const handleInviteAll = async (): Promise<void> => {
    if (emails.length === 0) {
      toast({
        title: t('mindmap.shareDialog.emailRequired'),
        description: t('mindmap.shareDialog.emailRequiredDescription'),
        variant: 'destructive'
      })
      return
    }
    setInviting(true)
    const succeeded: string[] = []
    const failed: string[] = []
    for (const e of emails) {
      try {
        await inviteMut.mutateAsync({ mindmapId, email: e, role: inviteRole })
        succeeded.push(e)
      } catch (err) {
        logger.error('邀请协作者失败:', err)
        failed.push(e)
      }
    }
    setInviting(false)
    if (succeeded.length > 0) {
      toast({
        title: t('mindmap.shareDialog.invitationSuccess'),
        description: t('mindmap.shareDialog.invitationSuccessDescription', {
          email: succeeded.join(', ')
        })
      })
    }
    if (failed.length > 0) {
      toast({
        title: t('mindmap.shareDialog.invitationFailed'),
        description: failed.join(', '),
        variant: 'destructive'
      })
    }
    setEmails([])
    refresh()
    if (failed.length === 0) setInviteView('entry')
  }

  const copyText = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ description: t('mindmap.shareDialog.copySuccessTitle') })
    } catch (error) {
      logger.error('复制失败:', error)
      toast({
        title: t('mindmap.shareDialog.copyFailedTitle'),
        description: t('mindmap.shareDialog.copyFailedDescription'),
        variant: 'destructive'
      })
    }
  }

  const handleCopyViewerLink = async (): Promise<void> => {
    if (viewerLink) {
      await copyText(linkUrl(viewerLink.linkId))
      return
    }
    const created = await createLinkMut.mutateAsync({ mindmapId, role: MindmapRoles.VIEWER })
    if (created.success) {
      await copyText(linkUrl(created.shareLink.linkId))
      refresh()
    }
  }

  const handlePublish = async (): Promise<void> => {
    try {
      const created = await createLinkMut.mutateAsync({ mindmapId, role: MindmapRoles.VIEWER })
      if (created.success) {
        toast({
          description: t('mindmap.shareDialog.publishSuccessDescription')
        })
        refresh()
      }
    } catch (error) {
      logger.error('发布失败:', error)
      toast({
        title: t('mindmap.shareDialog.publishFailedTitle'),
        description: t('mindmap.shareDialog.publishFailedDescription'),
        variant: 'destructive'
      })
    }
  }

  const handleUnpublish = async (): Promise<void> => {
    if (!viewerLink) return
    try {
      await deleteLinkMut.mutateAsync({ linkId: viewerLink.linkId })
      refresh()
    } catch (error) {
      logger.error('取消发布失败:', error)
      toast({
        title: t('mindmap.shareDialog.publishFailedTitle'),
        description: t('mindmap.shareDialog.publishFailedDescription'),
        variant: 'destructive'
      })
    }
  }

  // 统一渲染协作成员列表（管理视图可编辑角色/移除；只读视图仅展示角色 Badge）
  const renderMembers = (editable: boolean) =>
    collaborators.length === 0 ? (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{t('mindmap.shareDialog.noMembersTitle')}</EmptyTitle>
          <EmptyDescription>{t('mindmap.shareDialog.noMembersDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div className="divide-y divide-border overflow-hidden rounded-lg border">
        {collaborators.map(c => (
          <Item key={c.userId} className="gap-3 px-3 py-2.5">
            <ItemMedia>
              <UserAvatarWithCard
                user={{ name: c.name, email: c.email, avatar: c.avatar }}
                size="md"
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="truncate">
                {c.name?.trim() || c.email?.trim() || t('common.anonymousUser')}
              </ItemTitle>
              {c.name?.trim() && c.email && (
                <span className="truncate text-xs text-muted-foreground">{c.email}</span>
              )}
            </ItemContent>
            <ItemActions className="flex items-center gap-2">
              {c.isOwner ? (
                <Badge variant="secondary">{roleLabel(MindmapRoles.OWNER)}</Badge>
              ) : editable ? (
                <>
                  <Select
                    value={c.role}
                    onValueChange={v =>
                      updateRoleMut.mutate({ mindmapId, userId: c.userId, role: v as MindmapRole })
                    }
                  >
                    <SelectTrigger size="sm" className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map(r => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => removeMut.mutate({ mindmapId, userId: c.userId })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">{roleLabel(c.role)}</Badge>
              )}
            </ItemActions>
          </Item>
        ))}
      </div>
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[560px] max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-xl">{t('mindmap.shareDialog.title')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="invite" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="px-6 pt-3">
            <TabsList variant="line" className="w-full justify-start gap-4 border-b">
              <TabsTrigger value="invite">{t('mindmap.shareDialog.inviteTab')}</TabsTrigger>
              <TabsTrigger value="publish">{t('mindmap.shareDialog.publishTab')}</TabsTrigger>
              <TabsTrigger value="export">{t('mindmap.shareDialog.exportTab')}</TabsTrigger>
            </TabsList>
          </div>

          {/* ───────────── 邀请 ───────────── */}
          <TabsContent value="invite" className="flex min-h-0 flex-1 flex-col">
            {/* —— 主视图 —— */}
            {isOwner && inviteView === 'entry' && (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  {/*
                   * 谁能访问 (合并 publish + visibility 单一 Select).
                   *
                   * 编码:
                   *   - value='private'         → visibility=PRIVATE
                   *   - value='project:<id>'    → visibility=WORKSPACE, workspaceId=<id>
                   *   - value='org'             → visibility=ORG
                   * 后端 setPublish 原子写两字段, 避免中间态.
                   * personal org: WORKSPACE / ORG 选项禁用 (语义无效).
                   */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">{t('mindmap.shareDialog.access.label')}</p>
                    <Select
                      value={
                        currentVisibility === 'PRIVATE'
                          ? 'private'
                          : currentVisibility === 'ORG'
                            ? 'org'
                            : currentVisibility === 'WORKSPACE' && currentProjectId
                              ? `project:${currentProjectId}`
                              : 'private'
                      }
                      onValueChange={v => {
                        if (v == null) return
                        if (v === 'private') {
                          setPublishMut.mutate({ mindmapId, visibility: 'PRIVATE' })
                        } else if (v === 'org') {
                          setPublishMut.mutate({ mindmapId, visibility: 'ORG' })
                        } else if ((v as string).startsWith('project:')) {
                          const pid = (v as string).slice('project:'.length)
                          setPublishMut.mutate({
                            mindmapId,
                            visibility: 'WORKSPACE',
                            workspaceId: pid
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="h-auto min-h-10 py-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">
                          <span className="inline-flex items-center gap-2">
                            <Lock className="size-3.5 text-muted-foreground" />
                            {t('mindmap.shareDialog.access.private')}
                          </span>
                        </SelectItem>
                        {projectList.map(p => (
                          <SelectItem key={p.id} value={`project:${p.id}`}>
                            <span className="inline-flex items-center gap-2">
                              <Folder className="size-3.5 text-muted-foreground" />
                              {t('mindmap.shareDialog.access.projectMembers', { name: p.name })}
                            </span>
                          </SelectItem>
                        ))}
                        <SelectItem value="org">
                          <span className="inline-flex items-center gap-2">
                            <Globe className="size-3.5 text-muted-foreground" />
                            {t('mindmap.shareDialog.access.org')}
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('mindmap.shareDialog.access.description')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInviteView('invite')}
                    className="flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-accent/40"
                  >
                    <Mail className="size-4 shrink-0" />
                    {t('mindmap.shareDialog.emailPlaceholder')}
                  </button>

                  {invitations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {t('mindmap.shareDialog.pendingInvitationsTitle')}
                      </p>
                      <div className="divide-y divide-border overflow-hidden rounded-lg border">
                        {invitations.map(inv => (
                          <Item key={inv.id} className="gap-3 px-3 py-2.5">
                            <ItemMedia className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Mail className="size-4" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="font-normal">{inv.email}</ItemTitle>
                              <ItemDescription>
                                {t('mindmap.shareDialog.pendingBadge')}
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions className="flex items-center gap-2">
                              <Badge variant="secondary">{roleLabel(inv.role)}</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground"
                                onClick={() =>
                                  revokeMut.mutate({ mindmapId, invitationId: inv.id })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </ItemActions>
                          </Item>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t px-6 py-4">
                  <Button variant="ghost" onClick={() => setInviteView('manage')}>
                    <Users className="size-4" />
                    {t('mindmap.shareDialog.manageButton')}
                  </Button>
                  <Button variant="outline" onClick={handleCopyViewerLink}>
                    <LinkIcon className="size-4" />
                    {t('mindmap.shareDialog.copyViewerLink')}
                  </Button>
                </div>
              </>
            )}

            {/* —— 二级：填邮箱邀请 —— */}
            {isOwner && inviteView === 'invite' && (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t('mindmap.shareDialog.inviteCollaboratorsTitle')}
                  </h3>
                  <div className="relative">
                    <TagsInput
                      value={emails}
                      onChange={setEmails}
                      validate={isValidEmail}
                      disabled={!canInvite}
                      placeholder={t('mindmap.shareDialog.emailPlaceholder')}
                      aria-label={t('mindmap.shareDialog.inviteCollaboratorsTitle')}
                      className="min-h-[120px] items-start pr-28"
                    />
                    <div className="absolute top-1.5 right-1.5">
                      <Select
                        value={inviteRole}
                        onValueChange={v => setInviteRole(v as MindmapRole)}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-auto gap-1 border-0 bg-transparent text-muted-foreground shadow-none"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map(r => (
                            <SelectItem key={r} value={r}>
                              {roleLabel(r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t px-6 py-4">
                  <Button variant="outline" onClick={() => setInviteView('entry')}>
                    {t('common.back')}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button onClick={handleInviteAll} disabled={!canInvite || inviting}>
                      {t('mindmap.shareDialog.inviteButton')}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* —— 管理协作者 —— */}
            {isOwner && inviteView === 'manage' && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {t('mindmap.shareDialog.manageTitle')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('mindmap.shareDialog.manageSubtitle')}
                    </p>
                  </div>
                  {renderMembers(true)}
                </div>
                <div className="flex items-center border-t px-6 py-4">
                  <Button variant="outline" onClick={() => setInviteView('entry')}>
                    {t('common.back')}
                  </Button>
                </div>
              </>
            )}

            {/* —— 非所有者：只读「拥有访问权限的人员」 —— */}
            {!isOwner && (
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t('mindmap.shareDialog.manageTitle')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('mindmap.shareDialog.manageSubtitle')}
                  </p>
                </div>
                {renderMembers(false)}
              </div>
            )}
          </TabsContent>

          {/* ───────────── 发布 ───────────── */}
          <TabsContent value="publish" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {viewerLink ? (
              <div className="space-y-4">
                <Item className="items-start gap-3 rounded-lg border p-4">
                  <ItemMedia className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Globe className="size-5" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{t('mindmap.shareDialog.publishedTitle')}</ItemTitle>
                    <ItemDescription>
                      {t('mindmap.shareDialog.publishedDescription')}
                    </ItemDescription>
                  </ItemContent>
                </Item>
                <InputGroup>
                  <InputGroupAddon>
                    <LinkIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    readOnly
                    value={linkUrl(viewerLink.linkId)}
                    className="text-xs"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => copyText(linkUrl(viewerLink.linkId))}
                    >
                      <Copy />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="outline">
                          {t('mindmap.shareDialog.unpublishButton')}
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('mindmap.shareDialog.confirmUnpublishTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('mindmap.shareDialog.confirmUnpublishDesc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnpublish}>
                          {t('mindmap.shareDialog.unpublishButton')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ) : (
              <Empty className="border border-dashed py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Globe className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>{t('mindmap.shareDialog.publishPromptTitle')}</EmptyTitle>
                  <EmptyDescription>
                    {t('mindmap.shareDialog.publishPromptDescription')}
                  </EmptyDescription>
                </EmptyHeader>
                {isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button className="mt-4" disabled={createLinkMut.isPending}>
                          {t('mindmap.shareDialog.publishButton')}
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('mindmap.shareDialog.confirmPublishTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('mindmap.shareDialog.confirmPublishDesc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePublish}>
                          {t('mindmap.shareDialog.publishButton')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </Empty>
            )}
          </TabsContent>

          {/* ───────────── 导出 ───────────── */}
          <ShareExportTab />
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
