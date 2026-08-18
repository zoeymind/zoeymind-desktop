import React, { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  MoreHorizontal,
  MessageSquare,
  GitBranch,
  History,
  Star,
  StarOff,
  Edit,
  Trash2,
  ZoomIn,
  Calendar,
  Eye,
  Users,
  Crown,
  BrainCircuit,
  FolderInput
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@zoeymind/ui'
import type { ProjectWithStats } from '@/shared/mindmap-bridge'
import { canWriteMindmap, type MindmapRole } from '@zoeymind/shared'
import useProjectStar from './hooks/useProjectStar.ts'
import useProjectUtils from './hooks/useProjectUtils.ts'
import useProjectPreview from './hooks/useProjectPreview.ts'
import { useProjectManager } from '@/shared/mindmap-bridge'
import { useTranslation } from '@zoeymind/i18n'

interface ProjectListItemProps {
  project: ProjectWithStats
  onRename?: (project: ProjectWithStats) => void
  onDelete?: (project: ProjectWithStats) => void
  onToggleFavorite?: (project: ProjectWithStats) => void // 新增收藏切换处理
  onUpdate?: () => void
  onProjectClick?: (project: ProjectWithStats) => void // 新增自定义点击处理
  onMove?: (project: ProjectWithStats) => void
}

export const ProjectListItem: React.FC<ProjectListItemProps> = ({
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

  // 检测是否为云项目（云项目会有 isFavorited 属性）
  const isCloudProject = 'isFavorited' in project

  // 类型守卫函数，用于安全访问云项目的 isFavorited 属性
  const getCloudProjectFavoriteStatus = (proj: ProjectWithStats): boolean => {
    return 'isFavorited' in proj
      ? (proj as ProjectWithStats & { isFavorited: boolean }).isFavorited
      : false
  }

  // 权限相关的类型守卫和信息提取 (字段名与后端 mindmap.list.userRole 一致)
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

  const permissionInfo = getProjectPermissionInfo(project)

  const { isStarred, toggleStar } = useProjectStar({ project, onUpdate })
  const { getRelativeTime, getProjectColor } = useProjectUtils()
  const { previewImage, handleImageError, togglePreview } = useProjectPreview(project)

  // 使用统一的项目管理器
  const { getProjectStats } = useProjectManager()
  // 获取项目统计信息
  const stats = getProjectStats(project.id)

  // 点击处理：使用自定义处理或默认跳转到首页
  const handleClick = useCallback(() => {
    if (onProjectClick) {
      onProjectClick(project)
    } else {
      // 如果没有自定义处理，跳转到首页
      navigate({ to: '/' })
    }
  }, [project, onProjectClick, navigate])

  // 优化事件处理函数
  const handleMouseEnter = useCallback(() => setIsHovering(true), [])
  const handleMouseLeave = useCallback(() => setIsHovering(false), [])

  const handleStarToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      requestAnimationFrame(() => {
        if (isCloudProject && onToggleFavorite) {
          // 云项目使用传入的收藏处理函数
          onToggleFavorite(project)
        } else {
          // 本地项目使用原有的 toggleStar
          toggleStar(e)
        }
      })
    },
    [isCloudProject, onToggleFavorite, project, toggleStar]
  )

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      togglePreview(e)
    },
    [togglePreview]
  )

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

  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className={`cursor-pointer rounded-lg transition-all duration-200 ${
        isHovering ? 'border border-primary' : 'border border-transparent'
      }`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="grid grid-cols-12 gap-4 items-center p-4">
        {/* 项目图标/颜色 - 1列 */}
        <div
          className="col-span-1 size-10 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: getProjectColor(project.id) }}
        >
          {previewImage ? (
            <div className="relative w-full h-full group">
              <img
                src={previewImage}
                alt={project.name}
                onError={handleImageError}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={handleImageClick}
              />
              <div
                className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                onClick={handleImageClick}
              >
                <ZoomIn className="size-4 text-white" />
              </div>
            </div>
          ) : (
            <BrainCircuit className="size-5 text-white/70" strokeWidth={1.5} />
          )}
        </div>

        {/* 项目名称 - 4列 */}
        <div className="col-span-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-base font-medium truncate">{project.name}</div>

            {/* 权限标识 */}
            {isCloudProject && (
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  permissionInfo.isOwner
                    ? 'bg-primary/10 text-primary'
                    : canWriteMindmap(permissionInfo.userRole)
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {permissionInfo.isOwner ? (
                  <>
                    <Crown className="size-3" />
                    <span>{t('projects.card.permOwner')}</span>
                  </>
                ) : canWriteMindmap(permissionInfo.userRole) ? (
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
            )}

            {(isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred) && (
              <Star className="size-4 text-warning" />
            )}
          </div>
          {project.description && (
            <div className="text-xs text-muted-foreground truncate mt-1">{project.description}</div>
          )}
        </div>

        {/* 创建时间 - 2列 */}
        <div className="col-span-2">
          <div className="flex items-center text-muted-foreground">
            <Calendar className="size-4 mr-1" />
            <span className="text-sm">
              {new Date(project.createdAt).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              })}
            </span>
          </div>
        </div>

        {/* 测试用例数量 - 1列 */}
        <div className="col-span-1 text-center">
          <div
            className="flex items-center justify-center text-muted-foreground"
            title={t('projects.card.testCaseCount')}
          >
            <GitBranch className="size-4 mr-1" />
            <span className="text-sm">
              {project.nodeCount || (project.metadata?.nodeCount as number) || 0}
            </span>
          </div>
        </div>

        {/* 消息数量 - 1列 */}
        <div className="col-span-1 text-center">
          <div className="flex items-center justify-center text-muted-foreground">
            <MessageSquare className="size-4 mr-1" />
            <span className="text-sm">{stats.messageCount || 0}</span>
          </div>
        </div>

        {/* 最后修改 - 2列 */}
        <div className="col-span-2">
          <div className="flex items-center text-muted-foreground">
            <History className="size-4 mr-1" />
            <span className="text-sm">{getRelativeTime(project.updatedAt)}</span>
          </div>
        </div>

        {/* 操作按钮 - 1列 */}
        <div className="col-span-1 flex justify-between items-center w-full min-w-20">
          <div className="flex items-center gap-2">
            {isHovering || (isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred) ? (
              <div
                onClick={handleStarToggle}
                className="cursor-pointer size-5 flex items-center justify-center"
              >
                {(isCloudProject ? getCloudProjectFavoriteStatus(project) : isStarred) ? (
                  <Star className="text-warning hover:text-muted-foreground size-5" />
                ) : (
                  <StarOff className="text-muted-foreground hover:text-warning size-5" />
                )}
              </div>
            ) : (
              <div className="size-5" />
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton
                render={
                  <div
                    onClick={handleStopPropagation}
                    className="cursor-pointer size-5 flex items-center justify-center"
                  >
                    <MoreHorizontal className="text-muted-foreground hover:text-foreground size-5" />
                  </div>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleRename}>
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
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  <span>{t('common.delete')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectListItem
