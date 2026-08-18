// @ts-nocheck — legacy project card util, dormant
import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ProjectWithStats } from '@/shared/mindmap-bridge'
import { trpc } from '@/shared/app-shared'

/**
 * 项目预览图管理hook
 * 处理项目预览图的获取和错误处理
 *
 * @param project 项目数据
 * @returns 预览图相关状态和方法
 */
export function useProjectPreview(project: ProjectWithStats) {
  const [imageError, setImageError] = useState(false) // kept for handleImageError override
  const [previewVisible, setPreviewVisible] = useState(false)
  // 云项目判定 (与后端 mindmap.list.userRole 字段名一致)
  const isCloudProject = 'userRole' in project

  const appendAuthToken = useCallback((url: string | null): string | null => {
    if (!url) return null
    if (url.startsWith('data:')) {
      return url
    }
    return url
  }, [])

  const rawPreviewUrl = useMemo(() => {
    if ('previewUrl' in project && typeof project.previewUrl === 'string') {
      return project.previewUrl
    }
    const preview = project.metadata?.preview
    return typeof preview === 'string' ? preview : null
  }, [project])

  // 只有旧的 Express 封面地址才需要改用 tRPC 拉取 base64 封面
  // 如果没有预览URL，直接显示占位图，不请求后端
  const shouldFetchCover = useMemo(() => {
    if (imageError) return false
    if (!isCloudProject) return false
    // 只有当有预览URL且是旧的 Express 地址时，才请求新的 tRPC 接口
    // 如果没有预览URL，说明是新项目或没有封面，直接显示占位图
    if (!rawPreviewUrl) return false
    return rawPreviewUrl.startsWith('/api/mindmap/')
  }, [imageError, isCloudProject, rawPreviewUrl])

  const { data: trpcCover, error: trpcError } = trpc.files.getMindmapCover.useQuery(
    { mindmapId: project.id },
    {
      enabled: shouldFetchCover,
      retry: false, // 不重试，避免频繁请求
      staleTime: 5 * 60 * 1000, // 5分钟内不重新请求
      gcTime: 10 * 60 * 1000 // 10分钟后清理缓存
    }
  )

  useEffect(() => {
    // 如果返回 success: false 或发生错误，设置 imageError 阻止后续请求
    if (trpcError || (trpcCover && !trpcCover.success)) {
      setImageError(true)
    }
  }, [trpcError, trpcCover])

  const resolvedPreview = useMemo(() => {
    if (imageError) return null

    // 封面走对象存储 presigned URL（ADR 0004）
    if (trpcCover?.success && trpcCover?.url) {
      return trpcCover.url
    }

    if (rawPreviewUrl && !shouldFetchCover) {
      return appendAuthToken(rawPreviewUrl)
    }

    return null
  }, [appendAuthToken, imageError, rawPreviewUrl, shouldFetchCover, trpcCover])

  /**
   * 获取项目预览图
   * @returns 预览图URL或base64字符串或null
   */
  const getPreviewImage = useCallback((): string | null => {
    return resolvedPreview
  }, [resolvedPreview])

  /**
   * 处理图片加载错误
   */
  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  /**
   * 切换预览图显示状态
   * @param e 可选事件对象
   */
  const togglePreview = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
      }

      const preview = getPreviewImage()
      if (preview) {
        setPreviewVisible(prev => !prev)
      }
    },
    [getPreviewImage]
  )

  // 获取预览图
  const previewImage = getPreviewImage()

  return {
    previewImage,
    imageError,
    previewVisible,
    handleImageError,
    togglePreview,
    setPreviewVisible
  }
}

export default useProjectPreview