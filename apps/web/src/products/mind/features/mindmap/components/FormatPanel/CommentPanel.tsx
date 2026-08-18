import { FC, useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { NodeCommentBlock } from './NodeCommentBlock'
import { PanelLayout } from './PanelLayout'
import { MessageCircle } from 'lucide-react'
import { logger } from '@zoeymind/logger'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { useCommentContext } from '@/products/mind/features/mindmap/contexts/CommentContext'

interface CommentPanelProps {
  isActive: boolean
  targetNodeUid?: string | null
  onClose?: () => void
}

export const CommentPanel: FC<CommentPanelProps> = ({ isActive, targetNodeUid, onClose }) => {
  const { t } = useTranslation()
  // 🎯 从 Context 获取 workspaceId (页面级作用域)
  const { workspaceId } = useProjectContext()
  // 从 stores 和 context 获取状态和数据
  const { mindMap } = useMindMapStore()
  const { stats, totalComments } = useCommentContext()

  // 确保评论数据连接已建立
  useEffect(() => {
    if (isActive) {
      logger.debug('评论面板已初始化，总评论数:', totalComments)
    }
  }, [totalComments, isActive])

  const [currentTargetNodeUid, setCurrentTargetNodeUid] = useState<string | null>(
    targetNodeUid || null
  )

  // 同步外部目标节点状态
  useEffect(() => {
    setCurrentTargetNodeUid(targetNodeUid || null)
  }, [targetNodeUid])

  // 获取需要显示的节点列表（有评论的节点 + 目标节点）
  const nodeUidsWithComments = stats ? Object.keys(stats).filter(uid => stats[uid].count > 0) : []
  const displayNodeUids = currentTargetNodeUid
    ? Array.from(new Set([...nodeUidsWithComments, currentTargetNodeUid])) // 确保目标节点也被显示
    : nodeUidsWithComments

  // 统一的激活方法 - 参考NodeManager实现
  const activateNode = useCallback(
    (nodeUid: string) => {
      // 更新面板中的激活状态
      setCurrentTargetNodeUid(nodeUid)

      // 激活思维导图中的节点 - 使用GO_TARGET_NODE命令，这会激活节点并移动到中心
      if (mindMap && nodeUid) {
        try {
          // ✅ GO_TARGET_NODE 支持 UID 字符串,会自动展开折叠的节点
          mindMap.execCommand('GO_TARGET_NODE', nodeUid)
        } catch (error) {
          logger.warn('激活节点失败:', error)
        }
      }
    },
    [mindMap]
  )

  // 处理导航到上一个评论 - 使用统一激活方法
  const handleNavigateToPrevUnified = useCallback(
    (currentNodeUid: string) => {
      const currentIndex = displayNodeUids.indexOf(currentNodeUid)
      if (currentIndex > 0) {
        const prevNodeUid = displayNodeUids[currentIndex - 1]
        activateNode(prevNodeUid)
      }
    },
    [displayNodeUids, activateNode]
  )

  // 处理导航到下一个评论 - 使用统一激活方法
  const handleNavigateToNextUnified = useCallback(
    (currentNodeUid: string) => {
      const currentIndex = displayNodeUids.indexOf(currentNodeUid)
      if (currentIndex < displayNodeUids.length - 1) {
        const nextNodeUid = displayNodeUids[currentIndex + 1]
        activateNode(nextNodeUid)
      }
    },
    [displayNodeUids, activateNode]
  )

  if (!isActive) return null

  if (!workspaceId) {
    return (
      <PanelLayout
        title={t('mindmap.formatPanel.comment.panelTitle')}
        icon={<MessageCircle className="size-5 text-primary" />}
        isActive={isActive}
        onClose={onClose}
      >
        <div className="p-4 text-center text-muted-foreground">
          <MessageCircle className="size-8 mx-auto mb-2 opacity-50" />
          <p>{t('mindmap.formatPanel.comment.requireProject')}</p>
        </div>
      </PanelLayout>
    )
  }

  return (
    <PanelLayout
      title={t('mindmap.formatPanel.comment.panelTitleWithCount', { count: totalComments })}
      icon={<MessageCircle className="size-5 text-primary" />}
      isActive={isActive}
      onClose={onClose}
    >
      {displayNodeUids.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          <MessageCircle className="size-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">{t('mindmap.formatPanel.comment.emptyTitle')}</div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            {t('mindmap.formatPanel.comment.emptyHint')}
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {displayNodeUids.map(nodeUid => (
            <NodeCommentBlock
              key={nodeUid}
              nodeUid={nodeUid}
              stats={stats?.[nodeUid]}
              isTarget={currentTargetNodeUid === nodeUid}
              onNavigateToNext={handleNavigateToNextUnified}
              onNavigateToPrev={handleNavigateToPrevUnified}
              onCardClick={activateNode}
            />
          ))}
        </div>
      )}
    </PanelLayout>
  )
}
