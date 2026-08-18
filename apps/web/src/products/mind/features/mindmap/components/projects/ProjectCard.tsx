// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import React, { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  GitBranch,
  History,
  Star,
  StarOff,
  Edit,
  Trash2,
  MoreHorizontal,
  Eye,
  Users,
  Share2,
  FolderInput,
  BrainCircuit
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@zoeymind/ui'
import { Button } from '@zoeymind/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@zoeymind/ui'
import { UserAvatarWithCard } from '@/shared/app-shared'
import type { ProjectWithStats } from '@/shared/mindmap-bridge'
import { canWriteMindmap, type MindmapRole } from '@zoeymind/shared'
import { motion } from 'motion/react'
import useProjectStar from './hooks/useProjectStar.ts'
import useProjectUtils from './hooks/useProjectUtils.ts'
import useProjectPreview from './hooks/useProjectPreview.ts'
import { useProjectManager } from '@/shared/mindmap-bridge'
import { useTranslation } from '@zoeymind/i18n'
import { ShareDialog } from '@/products/mind/features/mindmap/components/ShareDialog/ShareDialog'

interface ProjectCardProps {
  project: ProjectWithStats
  onRename?: (project: ProjectWithStats) => void
  onDelete?: (project: ProjectWithStats) => void
  onToggleFavorite?: (project: ProjectWithStats) => void // 新增收藏切换处理
  onUpdate?: () => void
  onProjectClick?: (project: ProjectWithStats) => void // 新增自定义点击处理
  onMove?: (project: ProjectWithStats) => void
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onRename,
  onDelete,
  onToggleFavorite,
  onUpdate,
  onProjectClick,
  onMove
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isHovering, setIsHovering] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)

  // 检测是否为云项目（云项目会有 isFavorited 属性）
  const isCloudProject = 'isFavorited' in project

  // 类型守卫函数，用于安全访问云项目的 isFavorited 属性
  const getCloudProjectFavoriteStatus = (proj: ProjectWithStats): boolean => {
    return 'isFavorited' in proj
      ? (proj as ProjectWithStats & { isFavorited: boolean }).isFavorited
      : false
  }

  // 权限相关的类型守卫和信息提取 (与后端 mindmap.list.userRole 字段名一致)
  const getProjectPermissionInfo = (proj: ProjectWithStats) => {
    if ('userRole' in proj && 'isOwner' in proj) {
      const cloudProj = proj as ProjectWithStats & {
        userRole: MindmapRole | null
        isOwner: boolean
        sharedAt?: Date | null
      }
      return {
        userRole: cloudProj.userRole,
        isOwner: cloudProj.isOwner,
        sharedAt: cloudProj.sharedAt,
        isShared: !cloudProj.isOwner && cloudProj.userRole !== null
      }
    }
    return {
      userRole: null as MindmapRole | null,
      isOwner: true, // 本地项目默认为拥有者
      sharedAt: null,
      isShared: false
    }
  }

  // 类型守卫: 是否含跨 org 协作者/匿名链接 (来自 mindmap.list 后端计算)
  const getHasExternalAccess = (proj: ProjectWithStats): boolean => {
    if ('hasExternalAccess' in proj) {
      const cast = proj as ProjectWithStats & { hasExternalAccess?: unknown }
      return cast.hasExternalAccess === true
    }
    return false
  }

  // 获取云项目的 creator 信息 (仅云项目携带此字段)
  const getProjectCreator = (
    proj: ProjectWithStats
  ): { id: string; name: string; email?: string | null; avatar?: string | null } | null => {
    if (!('creator' in proj) || !proj.creator) return null
    const c = proj.creator
    if (typeof c !== 'object' || c === null) return null
    if (!('id' in c) || !('name' in c)) return null
    if (typeof c.id !== 'string' || typeof c.name !== 'string') return null
    const email =
      'email' in c && (typeof c.email === 'string' || c.email === null) ? c.email : undefined
    const avatar =
      'avatar' in c && (typeof c.avatar === 'string' || c.avatar === null) ? c.avatar : undefined
    return { id: c.id, name: c.name, email, avatar }
  }

  const permissionInfo = getProjectPermissionInfo(project)
  const creator = getProjectCreator(project)

  // 使用hooks替代内联逻辑
  const { isStarred, toggleStar } = useProjectStar({ project, onUpdate })
  const { getRelativeTime, getProjectColor } = useProjectUtils()
  const { previewImage, handleImageError } = useProjectPreview(project)

  // 使用全局项目管理器
  const { getProjectStats } = useProjectManager()
  // 获取项目统计信息
  const stats = getProjectStats(project.id)

  // 初始加载和刷新时更新统计
  useEffect(() => {
    // 这里不需要手动更新统计，因为 getProjectStats 会自动处理
  }, [project.id, getProjectStats])

  // 处理事件阻止传播 - 使用useCallback优化
  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  // 处理卡片点击：使用自定义处理或默认跳转到首页
  const handleClick = useCallback(() => {
    if (onProjectClick) {
      onProjectClick(project)
    } else {
      // 如果没有自定义处理，跳转到首页
      navigate({ to: '/' })
    }
  }, [project, onProjectClick, navigate])

  // 优化星标切换，添加防抖，支持云项目和本地项目
  const handleStarToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      requestAnimationFrame(() => {
        if (isCloudProject && onToggleFavorite) {
          // 云项目使用传入的收藏处理函数
          onToggleFavorite(project)
        } else {
          // 本地项目使用原有的 toggleStar
          toggleStar()
        }
      })
    },
    [isCloudProject, onToggleFavorite, project, toggleStar]
  )

  // 处理重命名和删除 - 使用useCallback优化
  const handleRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRename?.(project)
    },
    [onRename, project]
  )

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onMove?.(project)
    },
    [onMove, project]
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete?.(project)
    },
    [onDelete, project]
  )

  // 处理分享 - 只在云项目且是拥有者时显示
  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isCloudProject && permissionInfo.isOwner) {
        setShowShareDialog(true)
      }
    },
    [isCloudProject, permissionInfo.isOwner]
  )

  // 悬停状态处理 - 使用useCallback优化
  const handleMouseEnter = useCallback(() => setIsHovering(true), [])
  const handleMouseLeave = useCallback(() => setIsHovering(false), [])

  // 项目统计数据 - 使用useMemo缓存计算结果
  const statsItems = React.useMemo(
    () => [
      {
        icon: MessageSquare,
        value: stats.messageCount || 0,
        tooltip: t('projects.card.messageCount')
      },
      {
        icon: GitBranch,
        value: project.nodeCount || (project.metadata?.nodeCount as number) || 0,
        tooltip: t('projects.card.testCaseCount')
      },
      {
        icon: History,
        value: getRelativeTime(project.updatedAt),
        tooltip: t('projects.card.lastUpdated')
      }
    ],
    [stats.messageCount, project, getRelativeTime, t]
  )

  // 卡片动画变体 - 移到组件外部避免重复创建
  const cardVariants = React.useMemo(
    () => ({
      initial: { scale: 1 },
      hover: {
        scale: 1.02,
        transition: {
          type: 'spring' as const,
          bounce: 0.3,
          duration: 0.3,
          stiffness: 1100,
          damping: 10
        }
      }
    }),
    []
  )

  return (
    <motion.div
      initial="initial"
      whileHover="hover"
      animate="initial"
      variants={cardVariants}
      data-tour="project-card"
      data-testid="project-card"
      data-project-id={project.id}
      data-favorited={
        (isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred) ? 'true' : 'false'
      }
      className="cursor-pointer"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="bg-card rounded-lg overflow-hidden h-full transition-shadow duration-300 hover:shadow-lg border border-border">
        <div className="aspect-[4/3] relative block overflow-hidden">
          {/* Owner 信息和权限标识 */}
          {isCloudProject && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
              {/* Owner 头像和名字 */}
              {creator && (
                <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-full border border-border">
                  <UserAvatarWithCard user={creator} size="xs" />
                  <span className="text-xs font-medium text-muted-foreground truncate max-w-[100px]">
                    {creator.name ?? '—'}
                  </span>
                </div>
              )}
              {/* 权限标签 - 只在非拥有者时显示 */}
              {!permissionInfo.isOwner && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            canWriteMindmap(permissionInfo.userRole)
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {canWriteMindmap(permissionInfo.userRole) ? (
                            <>
                              <Users className="size-3" />
                              <span>{t('projects.card.permWrite')}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="size-3" />
                              <span>{t('projects.card.permRead')}</span>
                            </>
                          )}
                        </div>
                      }
                    />
                    <TooltipContent>
                      {permissionInfo.isShared && permissionInfo.sharedAt
                        ? canWriteMindmap(permissionInfo.userRole)
                          ? t('projects.card.permTooltipSharedWrite', {
                              when: getRelativeTime(permissionInfo.sharedAt)
                            })
                          : t('projects.card.permTooltipSharedRead', {
                              when: getRelativeTime(permissionInfo.sharedAt)
                            })
                        : canWriteMindmap(permissionInfo.userRole)
                          ? t('projects.card.permTooltipOwnedWrite')
                          : t('projects.card.permTooltipOwnedRead')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* 外部协作者标识 */}
              {getHasExternalAccess(project) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                          <Users className="size-3" />
                          <span>{t('projects.card.externalBadge')}</span>
                        </div>
                      }
                    />
                    <TooltipContent>{t('projects.card.externalTooltip')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}

          {/* 星标图标 */}
          <div
            className={`absolute top-3 right-3 z-20 transition-opacity duration-200 ${
              (isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred)
                ? 'opacity-100'
                : isHovering
                  ? 'opacity-90'
                  : 'opacity-0'
            }`}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="project-favorite-toggle"
                      onClick={handleStarToggle}
                      className={`size-8 flex items-center justify-center ${
                        (isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred)
                          ? 'bg-card/90 shadow-sm'
                          : 'bg-foreground/40 hover:bg-foreground/50'
                      }`}
                    >
                      {(isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred) ? (
                        <Star className="h-[18px] w-[18px] text-warning" />
                      ) : (
                        <StarOff className="h-[18px] w-[18px] text-white" />
                      )}
                    </Button>
                  }
                />
                <TooltipContent>
                  {(isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred)
                    ? t('projects.card.starRemove')
                    : t('projects.card.starAdd')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* 预览区 */}
          <div className="h-[calc(100%-80px)] w-full bg-muted flex items-center justify-center overflow-hidden">
            {previewImage ? (
              <img
                src={previewImage}
                alt={project.name}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center relative"
                style={{ backgroundColor: getProjectColor(project.id) }}
              >
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                  }}
                />
                <BrainCircuit className="size-16 text-white/40" strokeWidth={1.2} />
              </div>
            )}
          </div>

          {/* 带操作按钮的项目信息区 */}
          <div className="h-[80px] p-4 absolute bottom-0 left-0 right-0 bg-card">
            {/* 右上角操作按钮 */}
            <div className="absolute top-3 right-3 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      data-testid="project-card-menu"
                      onClick={handleStopPropagation}
                    >
                      <MoreHorizontal className="size-5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleStarToggle} data-testid="project-favorite">
                    {isStarred ? (
                      <Star className="mr-2 size-4 text-warning" />
                    ) : (
                      <StarOff className="mr-2 size-4" />
                    )}
                    <span>
                      {isStarred ? t('projects.card.starRemove') : t('projects.card.starAdd')}
                    </span>
                  </DropdownMenuItem>
                  {isCloudProject && permissionInfo.isOwner && (
                    <DropdownMenuItem onClick={handleShare}>
                      <Share2 className="mr-2 size-4" />
                      <span>{t('projects.card.share')}</span>
                    </DropdownMenuItem>
                  )}
                  {permissionInfo.isOwner && (
                    <>
                      <DropdownMenuItem onClick={handleRename} data-testid="project-rename">
                        <Edit className="mr-2 size-4" />
                        <span>{t('projects.card.rename')}</span>
                      </DropdownMenuItem>
                      {onMove && (
                        <DropdownMenuItem onClick={handleMove}>
                          <FolderInput className="mr-2 size-4" />
                          <span>{t('projects.home.moveTo')}</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={handleDelete}
                        data-testid="project-delete"
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        <span>{t('common.delete')}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 项目名称 */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      className="text-lg font-medium truncate pr-8"
                      data-testid="project-card-title"
                    >
                      {project.name}
                    </div>
                  }
                />
                <TooltipContent>{project.name}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 项目统计 */}
            <div className="flex gap-4 mt-2 text-muted-foreground">
              {statsItems.map((stat, index) => (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div className="flex items-center">
                          <stat.icon className="size-4 mr-1" />
                          <span className="text-sm">{stat.value}</span>
                        </div>
                      }
                    />
                    <TooltipContent>{stat.tooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 分享对话框 - 只在云项目且是拥有者时显示 */}
      {/* Dialog 组件已经使用 Portal 渲染到 body，不会触发项目卡片点击事件 */}
      {isCloudProject && permissionInfo.isOwner && (
        <ShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          workspaceId={project.id}
          projectTitle={project.name}
        />
      )}
    </motion.div>
  )
}

export default ProjectCard