// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
import { useCallback, useState } from 'react'
import { logger } from '@zoeymind/logger'
import { compressImages } from '@/products/mind/utils/imageUtils'
import type { Attachment } from '../../../ai-chat/types'

type SetAttachments = (
  attachments: Attachment[] | ((previous: Attachment[]) => Attachment[])
) => void

interface UseImageAttachmentManagerParams {
  supportsVision: boolean
  setAttachments: SetAttachments
  logPrefix: string
}

const MAX_IMAGE_SIZE_MB = 2
const COMPRESSION_QUALITY = 0.8

const readFileAsAttachment = (file: File, index: number): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'image',
        name: file.name,
        dataUrl: String(reader.result || '')
      })
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read image file'))
    }
    reader.readAsDataURL(file)
  })
}

export const useImageAttachmentManager = ({
  supportsVision,
  setAttachments,
  logPrefix
}: UseImageAttachmentManagerParams) => {
  const [isCompressing, setIsCompressing] = useState(false)

  const addImageFiles = useCallback(
    async (files: File[]) => {
      if (!supportsVision) return

      const imageFiles = files.filter(file => file.type.startsWith('image/'))
      if (imageFiles.length === 0) return

      const hasLargeImages = imageFiles.some(file => file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024)
      let filesToAttach = imageFiles

      try {
        if (hasLargeImages) {
          setIsCompressing(true)
        }

        filesToAttach = await compressImages(imageFiles, MAX_IMAGE_SIZE_MB, COMPRESSION_QUALITY)

        if (hasLargeImages) {
          const totalOriginalSize = imageFiles.reduce((sum, file) => sum + file.size, 0)
          const totalCompressedSize = filesToAttach.reduce((sum, file) => sum + file.size, 0)
          logger.info(`${logPrefix} 图片压缩完成`, {
            originalMB: (totalOriginalSize / 1024 / 1024).toFixed(2),
            compressedMB: (totalCompressedSize / 1024 / 1024).toFixed(2)
          })
        }
      } catch (error) {
        logger.error(`${logPrefix} 压缩图片失败，使用原图作为附件`, { error })
        filesToAttach = imageFiles
      } finally {
        setIsCompressing(false)
      }

      try {
        const nextAttachments = await Promise.all(filesToAttach.map(readFileAsAttachment))
        setAttachments(previousAttachments => [...previousAttachments, ...nextAttachments])
      } catch (error) {
        logger.error(`${logPrefix} 读取图片附件失败`, { error })
      }
    },
    [logPrefix, setAttachments, supportsVision]
  )

  return {
    isCompressing,
    addImageFiles
  }
}