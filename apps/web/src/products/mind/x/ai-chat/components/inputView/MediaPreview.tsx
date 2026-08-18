// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * MediaPreview - 媒体文件预览组件
 */

import React, { useRef, useEffect } from 'react'
import { PreviewMedia } from '@zoeymind/ui'
import { logger } from '@zoeymind/logger'
import type { Attachment } from '../../../ai-chat/types'

interface MediaPreviewProps {
  attachments: Attachment[]
  onRemove: (index: number) => void
  disabled?: boolean
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  attachments,
  onRemove,
  disabled = false
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 添加滚轮事件监听
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (scrollContainerRef.current) {
        e.preventDefault()
        scrollContainerRef.current.scrollBy({
          left: e.deltaY > 0 ? 40 : -40,
          behavior: 'smooth'
        })
      }
    }

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel)
      }
    }
  }, [])

  // 确保 attachments 是数组
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null
  }

  // 将 attachments 转换为 MediaItem 格式
  const mediaItems = attachments.map((att, index) => {
    const item = {
      id: att.id || `attachment-${index}`,
      name: att.name || 'image',
      url: att.dataUrl,
      type: att.type === 'image' ? ('image' as const) : ('file' as const)
    }
    logger.debug('[MediaPreview] 转换附件', { index, item })
    return item
  })

  logger.debug('[MediaPreview] 渲染预览', {
    attachmentsCount: attachments.length,
    mediaItemsCount: mediaItems.length,
    hasDataUrl: mediaItems.some(item => item.url)
  })

  return (
    <div ref={scrollContainerRef} className="w-full overflow-hidden">
      <PreviewMedia
        items={mediaItems}
        onRemove={onRemove}
        size="sm"
        disabled={disabled}
        scrollable
      />
    </div>
  )
}