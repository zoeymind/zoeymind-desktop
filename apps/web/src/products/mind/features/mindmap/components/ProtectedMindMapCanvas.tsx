// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { useMemo, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { MindMapCanvas } from './MindMapCanvas'
import { PermissionGuard } from './PermissionGuard'
import { ProjectProvider } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { useOrganization } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useTranslation } from '@zoeymind/i18n'

interface ProtectedMindMapCanvasProps {
  cloudMode?: boolean
  skipPermissionCheck?: boolean
  forceReadOnly?: boolean
  mindmapId?: string
}

/**
 * 受权限保护的思维导图画布组件
 *
 * 🎯 核心改进:使用 ProjectProvider 提供页面级作用域
 * - 从URL获取 workspaceId
 * - 通过 Context 注入到页面范围
 * - workspaceId 变化时,Provider 重新挂载(key={workspaceId})
 * - 所有子组件自动重新初始化,状态自然隔离
 */
export function ProtectedMindMapCanvas({
  cloudMode = false,
  skipPermissionCheck = false,
  forceReadOnly = false,
  mindmapId
}: ProtectedMindMapCanvasProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const worksStore = useMindMapStore()
  const { currentOrg } = useOrganization()

  // 🎯 从路由参数获取 workspaceId，或从 props 传入（分享页面使用）
  // TanStack Router 中，使用 useSearch 获取 query 参数，或从路由参数获取
  const searchParams = useSearch({ strict: false }) as { id?: string; workspaceId?: string }
  const workspaceId = useMemo(() => {
    // 优先使用传入的 mindmapId（分享页面场景）
    if (mindmapId) return mindmapId
    return cloudMode ? searchParams.id : searchParams.workspaceId
  }, [searchParams.id, searchParams.workspaceId, cloudMode, mindmapId])

  // 只在 workspaceId 或 cloudMode 变化时输出日志
  useEffect(() => {
    logger.info(`🔗 URL变化 - workspaceId: ${workspaceId}, cloudMode: ${cloudMode}`)
  }, [workspaceId, cloudMode])

  // 🎯 响应式同步项目名称到浏览器 Tab
  useEffect(() => {
    const title = worksStore.title
    const defaultTitle = t('mindmap.canvas.defaultDocumentTitle')
    if (title) {
      document.title = `${title} - Zoey Mind`
    } else {
      document.title = defaultTitle
    }

    return () => {
      document.title = defaultTitle
    }
  }, [worksStore.title, t])

  // 防御性：如果 workspaceId 仍是 'new' 走到这里（旧链接/书签等），重定向回项目列表。
  // 创建流程已迁到列表层；本组件只负责加载已有项目。
  useEffect(() => {
    if (cloudMode && workspaceId === 'new') {
      logger.warn('ProtectedMindMapCanvas 收到 id=new — 创建流程已迁移至列表页，重定向回列表')
      if (currentOrg) {
        navigate({
          to: '/org/$orgId/zoeymind/projects',
          params: { orgId: currentOrg.id },
          replace: true
        })
      } else {
        navigate({ to: '/', replace: true })
      }
    }
  }, [cloudMode, workspaceId, currentOrg, navigate])

  // 如果没有 workspaceId 或者还在 'new' 中转态，不渲染内容
  if (!workspaceId) {
    logger.warn('ProtectedMindMapCanvas: 缺少 workspaceId')
    return null
  }
  if (workspaceId === 'new' && cloudMode) {
    return null
  }

  // 🎯 关键:使用 key={workspaceId} 强制重新挂载
  // 当 workspaceId 变化时,整个 Provider 树会重新挂载
  // 所有子组件的状态会自然重置,不需要手动清理
  return (
    <ProjectProvider key={workspaceId} workspaceId={workspaceId} cloudMode={cloudMode}>
      <PermissionGuard skipPermissionCheck={skipPermissionCheck} forceReadOnly={forceReadOnly}>
        <MindMapCanvas />
      </PermissionGuard>
    </ProjectProvider>
  )
}