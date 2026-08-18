import { STORAGE_KEYS } from '@/shared/app-shared'
/**
 * 分享链接访问路由 - /mindmap/shared/:linkId
 * 公开路由，无需登录即可访问
 *
 * 只读分享链接：未登录用户直接查看思维导图（匿名只读）
 * 可编辑分享链接：需要登录后 join 获取权限
 */

import { useParams, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/shared/auth'
import { useOrganization } from '@/shared/app-shared'
import { useCurrentUser } from '@/shared/app-shared'
import { trpcClient } from '@/shared/app-shared'
import { useEffect, useState, useRef } from 'react'
import { Button } from '@zoeymind/ui'
import { Eye, Edit3, Share2, User, LogIn } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@zoeymind/ui'
import { Badge } from '@zoeymind/ui'
import { UnauthorizedPage } from '@zoeymind/ui'
import { logger } from '@zoeymind/logger'
import { MindmapRoles, canWriteMindmap, type MindmapRole } from '@zoeymind/shared'
import { ProtectedMindMapCanvas } from '@/products/mind/features/mindmap/components/ProtectedMindMapCanvas'
import { useTranslation } from '@zoeymind/i18n'

type UserState =
  | 'checking'
  | 'anonymous_readonly'
  | 'no_permission'
  | 'has_permission'
  | 'need_login'

interface ShareData {
  mindmap?: { id: string; title: string; createdBy?: string }
  creator?: { name: string | null; email?: string | null }
  role?: MindmapRole | null
  loading: boolean
  error?: string
}

export function SharedMindMapPage() {
  const { t } = useTranslation()
  const { linkId } = useParams({ strict: false })
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { currentOrg } = useOrganization()
  const { data: currentUser } = useCurrentUser()

  const [shareData, setShareData] = useState<ShareData>({ loading: true })
  const [currentUserRole, setCurrentUserRole] = useState<MindmapRole | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [userState, setUserState] = useState<UserState>('checking')
  const hasRedirectedRef = useRef(false)

  // 获取分享链接数据
  useEffect(() => {
    if (!linkId) return

    const fetchShareData = async () => {
      try {
        const result = await trpcClient.mindmap.permission.shareLink.access.query({ linkId })
        if (result.success) {
          setShareData({
            mindmap: result.mindmap,
            creator: result.shareLink.creator,
            role: result.role,
            loading: false
          })

          if (result.mindmap?.title) {
            document.title = t('mindmap.canvas.sharedDocumentTitlePrefix', {
              title: result.mindmap.title
            })
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('mindmap.canvas.fetchShareInfoFailed')
        setShareData({ loading: false, error: errorMessage })
      }
    }

    fetchShareData()

    return () => {
      document.title = 'ZOEY - Mind Map AI Agent Assistant for TestCase Writing'
    }
  }, [linkId, t])

  // 确定用户状态
  useEffect(() => {
    if (shareData.loading) return

    // 未登录用户
    if (!isAuthenticated || !currentUser) {
      if (shareData.role && !canWriteMindmap(shareData.role)) {
        // 只读分享链接：未登录用户可以直接查看（匿名只读）
        setUserState('anonymous_readonly')
      } else {
        // 可编辑分享链接：需要登录
        setUserState('need_login')
      }
      return
    }

    // 已登录：检查是否是创建者
    if (shareData.mindmap?.createdBy === currentUser.id) {
      setCurrentUserRole(MindmapRoles.OWNER)
      setUserState('has_permission')
      return
    }

    // 已登录：检查是否已有权限
    const checkExistingPermission = async () => {
      if (!shareData.mindmap?.id) return
      try {
        const result = await trpcClient.mindmap.permission.check.query({
          mindmapId: shareData.mindmap.id,
          action: 'read'
        })
        if (result.hasPermission) {
          setCurrentUserRole(result.role)
          setUserState('has_permission')
        } else {
          setUserState('no_permission')
        }
      } catch {
        setUserState('no_permission')
      }
    }
    checkExistingPermission()
  }, [isAuthenticated, currentUser, shareData.loading, shareData.mindmap, shareData.role])

  // 自动跳转：已有权限的已登录用户
  useEffect(() => {
    if (hasRedirectedRef.current) return

    if (userState === 'has_permission' && shareData.mindmap?.id && currentOrg) {
      hasRedirectedRef.current = true
      navigate({
        to: '/org/$orgId/zoeymind/editor/$id',
        params: { orgId: currentOrg.id, id: shareData.mindmap.id }
      })
    }
  }, [userState, shareData.mindmap?.id, navigate, currentOrg])

  // 处理登录重定向
  const handleLogin = () => {
    if (linkId) {
      localStorage.setItem(STORAGE_KEYS.redirectAfterLogin, `/mindmap/shared/${linkId}`)
    }
    navigate({ to: '/login' })
  }

  // 处理用户确认加入
  const handleConfirmJoin = async () => {
    if (!linkId || !shareData.mindmap?.id) return

    setIsConfirming(true)
    try {
      const result = await trpcClient.mindmap.permission.shareLink.join.mutate({ linkId })

      if (result.success && currentOrg) {
        navigate({
          to: '/org/$orgId/zoeymind/editor/$id',
          params: { orgId: currentOrg.id, id: shareData.mindmap!.id }
        })
      } else if (!currentOrg) {
        logger.error('加入项目失败: 当前没有选择组织')
      } else {
        logger.error('加入项目失败: 后端未返回成功状态')
      }
    } catch (error) {
      logger.error('加入项目失败:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  // ── 匿名只读预览 ──────────────────────────────────
  if (userState === 'anonymous_readonly' && shareData.mindmap?.id) {
    return (
      <AnonymousReadonlyView
        mindmapId={shareData.mindmap.id}
        mindmapTitle={shareData.mindmap.title}
        onLogin={handleLogin}
      />
    )
  }

  // ── 加载状态 ─────────────────────────────────────
  if (shareData.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full size-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('mindmap.canvas.verifyingShareLink')}</p>
        </div>
      </div>
    )
  }

  if (shareData.error) {
    return (
      <UnauthorizedPage
        title={t('mindmap.canvas.shareAccessRestricted')}
        description={shareData.error || t('mindmap.canvas.shareLinkInvalid')}
        showBackButton={true}
        showLoginButton={false}
        backButtonText={t('common.backHome')}
        onBack={() => (window.location.href = '/')}
      />
    )
  }

  if (!linkId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">{t('mindmap.canvas.mindmapLoading')}</p>
        </div>
      </div>
    )
  }

  // ── 交互式分享页面（需要登录/加入）──────────────
  const inviterName = shareData.creator?.name || t('mindmap.canvas.unknownInviter')
  const mindmapTitle = shareData.mindmap?.title || t('mindmap.canvas.defaultMindmapTitle')

  const displayRole = userState === 'has_permission' ? currentUserRole : (shareData.role ?? null)
  const isReadOnly = !canWriteMindmap(displayRole)

  const getUIConfig = () => {
    switch (userState) {
      case 'need_login':
        return {
          title: t('mindmap.canvas.mindmapInvitationTitle'),
          actionText: t('mindmap.canvas.invitesYou'),
          buttonText: t('mindmap.canvas.loginAndAccess'),
          statusText: t('mindmap.canvas.loginToAccessStatus'),
          helpText: t('mindmap.canvas.loginRedirectHelp'),
          onButtonClick: handleLogin,
          disabled: false
        }
      case 'no_permission':
        return {
          title: t('mindmap.canvas.joinMindmapTitle'),
          actionText: t('mindmap.canvas.invitesYouToJoin'),
          buttonText: isConfirming ? t('mindmap.canvas.joining') : t('mindmap.canvas.confirmJoin'),
          statusText: t('mindmap.canvas.confirmJoinStatus'),
          helpText: t('mindmap.canvas.confirmJoinHelp'),
          onButtonClick: handleConfirmJoin,
          disabled: isConfirming
        }
      case 'has_permission':
        return {
          title: t('mindmap.canvas.accessMindmapTitle'),
          actionText: t('mindmap.canvas.sharedAction'),
          buttonText: t('mindmap.canvas.openMindmap'),
          statusText: t('mindmap.canvas.alreadyHavePermission'),
          helpText: t('mindmap.canvas.mindmapInProjectList'),
          onButtonClick: () =>
            currentOrg &&
            navigate({
              to: '/org/$orgId/zoeymind/editor/$id',
              params: { orgId: currentOrg.id, id: shareData.mindmap!.id }
            }),
          disabled: false
        }
      default:
        return null
    }
  }

  const config = getUIConfig()
  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full size-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('mindmap.canvas.checkingAccess')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto size-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Share2 className="size-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">{config.title}</CardTitle>
          <div className="text-sm text-muted-foreground mt-2">
            <div className="flex items-center justify-center gap-1 flex-wrap">
              <User className="size-4" />
              <span className="font-medium">{inviterName}</span>
              <span>{config.actionText}</span>
              {isReadOnly ? (
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-4" />
                  <span>
                    {userState === 'has_permission'
                      ? t('mindmap.canvas.readOnly')
                      : t('mindmap.canvas.view')}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Edit3 className="size-4" />
                  <span>
                    {userState === 'has_permission'
                      ? t('mindmap.canvas.editable')
                      : t('common.edit')}
                  </span>
                </span>
              )}
              <span>{t('mindmap.canvas.mindmap')}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center">
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-foreground mb-2">{mindmapTitle}</h3>
            <p className="text-sm text-muted-foreground mb-2">{config.statusText}</p>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {userState === 'has_permission'
                  ? t('mindmap.canvas.currentPermission')
                  : t('mindmap.canvas.willGetPermission')}
              </span>
              <Badge variant={isReadOnly ? 'warning' : 'success'} className="gap-1">
                {isReadOnly ? (
                  <>
                    <Eye />
                    <span>{t('mindmap.canvas.readOnlyPermission')}</span>
                  </>
                ) : (
                  <>
                    <Edit3 />
                    <span>{t('mindmap.canvas.editPermission')}</span>
                  </>
                )}
              </Badge>
            </div>
          </div>
          <Button
            onClick={config.onButtonClick}
            disabled={config.disabled}
            className="w-full"
            size="lg"
          >
            {config.buttonText}
          </Button>
          <p className="text-xs text-muted-foreground mt-4">{config.helpText}</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 匿名只读视图（集成 MindMap 渲染）────────────

interface AnonymousReadonlyViewProps {
  mindmapId: string
  mindmapTitle: string
  onLogin: () => void
}

/**
 * 匿名只读视图
 *
 * 集成只读 MindMap 渲染：
 * - 使用 ProtectedMindMapCanvas 渲染思维导图
 * - 设置 skipPermissionCheck 跳过登录检查
 * - 设置 forceReadOnly 强制只读模式
 */
export function AnonymousReadonlyView({
  mindmapId,
  mindmapTitle,
  onLogin
}: AnonymousReadonlyViewProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部信息栏 */}
      <div className="flex-shrink-0 bg-background border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{mindmapTitle}</span>
          <Badge variant="warning">{t('mindmap.canvas.readOnlyModeBadge')}</Badge>
        </div>
        <Button onClick={onLogin} variant="outline" size="sm" className="h-8 text-xs">
          <LogIn className="size-3 mr-1" />
          {t('mindmap.canvas.loginButton')}
        </Button>
      </div>

      {/* MindMap 画布 - 只读模式 */}
      <div className="flex-1 relative overflow-hidden">
        <ProtectedMindMapCanvas
          cloudMode={true}
          skipPermissionCheck={true}
          forceReadOnly={true}
          mindmapId={mindmapId}
        />
      </div>
    </div>
  )
}
