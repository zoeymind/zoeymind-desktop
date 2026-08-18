import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { toast, trpc, useLoading, useOrganization } from '@/shared/app-shared'
import { NotFoundPage, RequestAccessPage } from '@zoeymind/ui'
import { MindmapRoles } from '@zoeymind/shared'
import { useTranslation } from '@zoeymind/i18n'
import { logger } from '@zoeymind/logger'

interface PermissionGuardProps {
  skipPermissionCheck?: boolean
  forceReadOnly?: boolean
  children: ReactNode
  onPermissionDenied?: () => void
}

/**
 * 权限守卫组件
 * 负责在渲染子组件之前检查用户权限
 */
export function PermissionGuard({
  skipPermissionCheck = false,
  forceReadOnly = false,
  children,
  onPermissionDenied
}: PermissionGuardProps) {
  const { t } = useTranslation()
  // 🎯 从 Context 获取项目信息 (页面级作用域)
  const { workspaceId, cloudMode } = useProjectContext()
  const {
    hasPermission,
    requestable,
    deniedCard,
    loading,
    checkCompleted,
    error,
    setProjectContext,
    checkPermission,
    setOwnerPermissions,
    resetPermissions
  } = usePermissionStore()

  const [requested, setRequested] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const { currentOrg } = useOrganization()
  const navigate = useNavigate()
  const requestMut = trpc.mindmap.accessRequest.create.useMutation({
    onSuccess: () => {
      setRequested(true)
      toast({ description: t('mindmap.canvas.requestAccess.requestSuccess') })
    },
    onError: err => {
      logger.error('访问申请失败', err)
      toast({
        title: t('mindmap.canvas.requestAccess.requestFailed'),
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const { showLoading, hideLoading } = useLoading()

  // 权限检查逻辑
  useEffect(() => {
    if (!workspaceId) return

    // 重置权限状态
    resetPermissions()

    // 设置项目上下文
    setProjectContext(workspaceId, cloudMode)

    // 如果跳过权限检查（如分享链接），设置owner权限
    if (skipPermissionCheck) {
      // 强制只读模式：设置只读权限
      if (forceReadOnly) {
        setOwnerPermissions(MindmapRoles.VIEWER)
      } else {
        // 否则设置 owner 权限（可编辑）
        setOwnerPermissions()
      }
      return
    }

    // 如果是云模式，执行权限检查
    if (cloudMode) {
      checkPermission(workspaceId, 'read')
    } else {
      // 非云模式，设置owner权限
      setOwnerPermissions()
    }
  }, [
    workspaceId,
    cloudMode,
    skipPermissionCheck,
    forceReadOnly,
    setProjectContext,
    checkPermission,
    setOwnerPermissions,
    resetPermissions
  ])

  // 权限检查状态管理
  useEffect(() => {
    if (loading && !checkCompleted) {
      showLoading(t('mindmap.canvas.checkingAccess'), 10)
    }
    // ✅ 不要在权限检查完成后关闭loading，让MindMapCanvas的加载逻辑接管
  }, [loading, checkCompleted, showLoading, t])

  // 权限检查失败: 按 requestable 分支; 无请求资格 → 404 掩盖 (不区分不存在 / 无权).
  if (checkCompleted && !hasPermission) {
    hideLoading()

    // 返回主页: 优先自定义回调 → 组织 zoeymind 首页 → 站点根
    const goHome = () => {
      if (onPermissionDenied) {
        onPermissionDenied()
        return
      }
      if (currentOrg?.id) {
        navigate({
          to: '/org/$orgId/zoeymind/projects',
          params: { orgId: currentOrg.id }
        }).catch(() => {
          window.location.href = `/org/${currentOrg.id}/zoeymind/projects`
        })
        return
      }
      window.location.href = '/'
    }

    if (requestable && workspaceId && deniedCard) {
      return (
        <RequestAccessPage
          card={{
            title: deniedCard.title,
            workspaceName: deniedCard.workspace.name,
            creator: deniedCard.creator
          }}
          message={requestMessage}
          onMessageChange={setRequestMessage}
          title={t('mindmap.canvas.requestAccess.title')}
          description={t('mindmap.canvas.requestAccess.description')}
          creatorLabel={t('mindmap.canvas.requestAccess.creatorLabel')}
          workspaceLabel={t('mindmap.canvas.requestAccess.workspaceLabel')}
          messageLabel={t('mindmap.canvas.requestAccess.messageLabel')}
          messagePlaceholder={t('mindmap.canvas.requestAccess.messagePlaceholder')}
          requestButtonText={t('mindmap.canvas.requestAccess.requestButton')}
          backButtonText={t('common.backHome')}
          requestedHint={t('mindmap.canvas.requestAccess.requestedHint')}
          anonymousName={t('common.anonymousUser')}
          requesting={requestMut.isPending}
          requested={requested}
          onRequest={() =>
            requestMut.mutate({
              mindmapId: workspaceId,
              message: requestMessage.trim() || undefined
            })
          }
          onBack={goHome}
        />
      )
    }

    // 非 org 成员或资源不存在 → 一律 404 掩盖存在性
    return (
      <NotFoundPage
        title={t('mindmap.canvas.mindmapNotFoundTitle')}
        description={error || t('mindmap.canvas.mindmapNotFoundDescription')}
        showBackButton={true}
        showHomeButton={true}
        onBack={goHome}
      />
    )
  }

  // ✅ 始终渲染children，让MindMapCanvas处理loading状态
  // 这样组件不会因为权限检查而重新挂载
  return <>{children}</>
}
