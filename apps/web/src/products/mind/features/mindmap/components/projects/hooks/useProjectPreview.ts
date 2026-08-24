/**
 * 项目预览图 hook —— 桌面端从 .zmind bundle 里的 preview.png 直接读.
 *
 * 云版本走 tRPC + Express 静态资源, 桌面端不接网络 —— 直接 readBundle 拿字节
 * 转 dataURL 显示. bundle 里没 preview.png (刚新建 / 老文件缺预览) 时返 null,
 * 卡片显示纯色占位.
 */
import { useCallback, useEffect, useState } from "react"
import { readBundle } from "@/shared/native"
import { logger } from "@zoeymind/logger"

function bytesToDataUrl(bytes: Uint8Array | null): string | null {
  if (!bytes || bytes.length === 0) return null
  let bin = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(bytes.length, i + chunk)))
    )
  }
  return `data:image/png;base64,${btoa(bin)}`
}

interface ProjectLike {
  id: string
  path?: string
  exists?: boolean
}

export function useProjectPreview(project: ProjectLike) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      setImageError(false)
      if (!project.path || project.exists === false) {
        setPreviewImage(null)
        return
      }
      void readBundle(project.path)
        .then(bundle => {
          if (!cancelled) setPreviewImage(bytesToDataUrl(bundle.previewPng ?? null))
        })
        .catch(error => {
          logger.warn("读取项目预览失败", error)
          if (!cancelled) setPreviewImage(null)
        })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [project.id, project.path, project.exists])

  const handleImageError = useCallback(() => setImageError(true), [])
  const togglePreview = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation?.()
    setPreviewVisible(v => !v)
  }, [])

  return {
    previewImage: imageError ? null : previewImage,
    handleImageError,
    togglePreview,
    previewVisible,
    setPreviewVisible,
  }
}

export default useProjectPreview
