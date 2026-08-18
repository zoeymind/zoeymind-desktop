/**
 * 思维导图邀请接受页面
 * 路由: /mindmap-invite/$token
 * 无需登录即可预览邀请信息，登录后可接受邀请
 */

import { useParams, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { UserPlus, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton
} from '@zoeymind/ui'
import { toast, trpc, useCurrentUser, UserAvatarWithCard } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'
import { useAuth } from '@/shared/auth'
import { useTranslation } from '@zoeymind/i18n'
import { MindmapRoles, type MindmapRole } from '@zoeymind/shared'
interface InvitationData {
  mindmapTitle: string
  inviterName: string
  inviterAvatar?: string
  role: MindmapRole
  email: string
  expiresAt: string
}

interface InvitationPreviewResponse {
  valid: boolean
  reason?: 'not_found' | 'expired' | 'error'
  invitation?: InvitationData
}

export function MindmapInvitePage() {
  const { token } = useParams({ from: '/mindmap-invite/$token' })
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  // 认证状态加载中
  if (authLoading) {
    return <LoadingSkeleton />
  }

  // 未登录：显示预览和登录/注册选项
  if (!isAuthenticated) {
    return <InvitePreviewSection token={token} />
  }

  // 已登录：显示完整邀请页面
  return <InviteAcceptSection token={token} />
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Skeleton className="size-16 rounded-xl mx-auto mb-4" />
          <Skeleton className="h-6 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 未登录时的邀请预览部分
 */
function InvitePreviewSection({ token }: { token: string }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'en-US' ? enUS : zhCN

  // 获取邀请预览（公开接口，无需登录）
  const { data: preview, isLoading: previewLoading } =
    trpc.mindmap.permission.invitation.preview.useQuery(
      { token: token ?? '' },
      { enabled: !!token }
    )

  if (previewLoading) {
    return <LoadingSkeleton />
  }

  const previewData = preview as InvitationPreviewResponse | undefined

  // 邀请无效或不存在
  if (!previewData?.valid) {
    let title = t('mindmap.invite.invalidTitle')
    let description = t('mindmap.invite.invalidDesc')

    if (previewData?.reason === 'not_found') {
      title = t('mindmap.invite.notFoundTitle')
      description = t('mindmap.invite.notFoundDesc')
    } else if (previewData?.reason === 'expired') {
      title = t('mindmap.invite.expiredTitle')
      description = t('mindmap.invite.expiredDesc')
    }

    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="size-16 text-destructive" />
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: '/' })} className="w-full">
              {t('common.backHome')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!previewData?.invitation) {
    return <LoadingSkeleton />
  }

  const invitation = previewData.invitation
  const isExpired = new Date(invitation.expiresAt) < new Date()

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <UserAvatarWithCard
              user={{ name: invitation.inviterName, avatar: invitation.inviterAvatar }}
              size="xl"
              showCard={false}
            />
          </div>
          <CardTitle>{invitation.inviterName}</CardTitle>
          <CardDescription className="mt-2">
            {t('mindmap.invite.invitationMessage', {
              name: invitation.inviterName,
              title: invitation.mindmapTitle
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 邀请信息卡片 */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{invitation.mindmapTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{t(getRoleTextKey(invitation.role))}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-4" />
              {t('mindmap.invite.expiresIn', {
                time: formatDistanceToNow(new Date(invitation.expiresAt), {
                  locale: dateLocale
                })
              })}
            </div>
          </div>

          {isExpired && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {t('mindmap.invite.expiredWarning')}
            </div>
          )}

          {/* 登录按钮 */}
          <Button
            onClick={() =>
              navigate({ to: '/login', search: { redirect: `/mindmap-invite/${token}` } })
            }
            className="w-full"
            disabled={isExpired}
          >
            {t('mindmap.invite.loginToAccept')}
          </Button>

          {/* 注册按钮 */}
          <Button
            variant="outline"
            onClick={() =>
              navigate({ to: '/register', search: { redirect: `/mindmap-invite/${token}` } })
            }
            className="w-full"
            disabled={isExpired}
          >
            {t('mindmap.invite.registerToAccept')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 已登录用户的邀请接受部分
 */
function InviteAcceptSection({ token }: { token: string }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'en-US' ? enUS : zhCN
  const [isAccepting, setIsAccepting] = useState(false)
  const { logout } = useAuth()
  const { data: currentUser } = useCurrentUser()

  // 获取邀请预览
  const { data: preview, isLoading: previewLoading } =
    trpc.mindmap.permission.invitation.preview.useQuery({ token }, { staleTime: 5000 })

  // 接受邀请
  // 接受邀请
  const acceptMutation = trpc.mindmap.permission.invitation.accept.useMutation({
    onSuccess: (data: unknown) => {
      const successData = data as { success: boolean; data?: { mindmapId: string } }
      if (successData.success && successData.data) {
        toast({
          description: t('mindmap.invite.acceptSuccessDescription')
        })
        // 导航到项目列表
        navigate({ to: '/' })
      }
    },
    onError: (error: unknown) => {
      logger.error('接受邀请失败:', error)
      toast({
        title: t('mindmap.invite.acceptFailed'),
        description: t('mindmap.invite.acceptFailedDescription'),
        variant: 'destructive'
      })
    }
  })

  // 拒绝邀请
  const declineMutation = trpc.mindmap.permission.invitation.decline.useMutation({
    onSuccess: () => {
      toast({ description: t('mindmap.invite.declineSuccess') })
      navigate({ to: '/' })
    },
    onError: (error: unknown) => {
      logger.error('拒绝邀请失败:', error)
      toast({
        description: error instanceof Error ? error.message : t('mindmap.invite.acceptFailed'),
        variant: 'destructive'
      })
    }
  })

  if (previewLoading) {
    return <LoadingSkeleton />
  }

  const previewData = preview as InvitationPreviewResponse | undefined

  if (!previewData?.valid || !previewData?.invitation) {
    let title = t('mindmap.invite.invalidTitle')
    let description = t('mindmap.invite.invalidDesc')

    if (previewData?.reason === 'not_found') {
      title = t('mindmap.invite.notFoundTitle')
      description = t('mindmap.invite.notFoundDesc')
    } else if (previewData?.reason === 'expired') {
      title = t('mindmap.invite.expiredTitle')
      description = t('mindmap.invite.expiredDesc')
    }

    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {previewData?.reason === 'expired' ? (
                <Clock className="size-16 text-warning" />
              ) : (
                <XCircle className="size-16 text-destructive" />
              )}
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: '/' })} className="w-full">
              {t('common.backHome')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const invitation = previewData.invitation
  const isExpired = new Date(invitation.expiresAt) < new Date()

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await acceptMutation.mutateAsync({ token })
    } finally {
      setIsAccepting(false)
    }
  }

  // 当前登录邮箱与被邀请邮箱不一致（如邀请人打开自己发给别人的链接）：
  // 点击前就给出明确提示，而不是接受时才抛 PERMISSION_DENIED
  const currentEmail = currentUser?.email ?? null
  const emailMismatch =
    !!currentEmail && currentEmail.toLowerCase() !== invitation.email.toLowerCase()

  if (emailMismatch) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <XCircle className="size-16 text-warning" />
            </div>
            <CardTitle>{t('mindmap.invite.emailMismatchTitle')}</CardTitle>
            <CardDescription className="mt-2">
              {t('mindmap.invite.emailMismatchDesc', {
                invited: invitation.email,
                current: currentEmail
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" onClick={() => void logout()} className="w-full">
              {t('mindmap.invite.switchAccount')}
            </Button>
            <Button onClick={() => navigate({ to: '/' })} className="w-full">
              {t('common.backHome')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <UserAvatarWithCard
              user={{ name: invitation.inviterName, avatar: invitation.inviterAvatar }}
              size="xl"
              showCard={false}
            />
          </div>
          <CardTitle>{invitation.inviterName}</CardTitle>
          <CardDescription className="mt-2">
            {t('mindmap.invite.invitationMessage', {
              name: invitation.inviterName,
              title: invitation.mindmapTitle
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 邀请信息卡片 */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{invitation.mindmapTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{t(getRoleTextKey(invitation.role))}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-4" />
              {t('mindmap.invite.expiresIn', {
                time: formatDistanceToNow(new Date(invitation.expiresAt), {
                  locale: dateLocale
                })
              })}
            </div>
          </div>

          {isExpired && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {t('mindmap.invite.expiredWarning')}
            </div>
          )}

          {/* 接受/拒绝按钮 */}
          <Button onClick={handleAccept} disabled={isExpired || isAccepting} className="w-full">
            {isAccepting && <CheckCircle2 className="size-4 mr-2 animate-spin" />}
            {t('mindmap.invite.acceptButton')}
          </Button>

          <Button
            variant="outline"
            onClick={() => declineMutation.mutate({ token })}
            disabled={isAccepting || declineMutation.isPending}
            className="w-full"
          >
            {t('common.decline')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 获取角色的展示文本
 */
function getRoleTextKey(role: MindmapRole): string {
  switch (role) {
    case MindmapRoles.VIEWER:
      return 'mindmap.shareDialog.roleViewer'
    case MindmapRoles.EDITOR:
      return 'mindmap.shareDialog.roleEditor'
    case MindmapRoles.OWNER:
      return 'mindmap.shareDialog.roleOwner'
    default:
      return role
  }
}
