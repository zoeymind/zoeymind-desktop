import { logger } from "@zoeymind/logger"

/**
 * 图片处理工具函数
 */

/**
 * 压缩图片到指定大小以下
 * @param file 原始图片文件
 * @param maxSizeInMB 最大文件大小（MB）
 * @param quality 压缩质量（0-1）
 * @returns Promise<File> 压缩后的图片文件
 */
export async function compressImage(
  file: File,
  maxSizeInMB: number = 2,
  quality: number = 0.8
): Promise<File> {
  // 如果文件已经小于目标大小，直接返回
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024
  if (file.size <= maxSizeInBytes) {
    return file
  }

  // 如果不是图片文件，直接返回
  if (!file.type.startsWith("image/")) {
    return file
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      try {
        // 计算压缩后的尺寸
        const { width, height } = calculateCompressedSize(
          img.width,
          img.height,
          file.size,
          maxSizeInBytes
        )

        canvas.width = width
        canvas.height = height

        if (!ctx) {
          reject(new Error("无法获取canvas context"))
          return
        }

        // 绘制压缩后的图片
        ctx.drawImage(img, 0, 0, width, height)

        // 转换为blob，并尝试不同的质量级别
        compressWithQuality(canvas, file.name, file.type, maxSizeInBytes, quality)
          .then(resolve)
          .catch(reject)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error("图片加载失败"))
    }

    // 创建图片URL
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 计算压缩后的尺寸
 */
function calculateCompressedSize(
  originalWidth: number,
  originalHeight: number,
  originalSize: number,
  targetSize: number
): { width: number; height: number } {
  // 计算压缩比例
  const ratio = Math.sqrt(targetSize / originalSize)

  // 确保压缩比例不超过1（不放大图片）
  const finalRatio = Math.min(ratio, 1)

  return {
    width: Math.floor(originalWidth * finalRatio),
    height: Math.floor(originalHeight * finalRatio),
  }
}

/**
 * 使用不同质量级别压缩图片
 */
async function compressWithQuality(
  canvas: HTMLCanvasElement,
  fileName: string,
  fileType: string,
  maxSize: number,
  initialQuality: number
): Promise<File> {
  let quality = initialQuality
  const minQuality = 0.1
  const qualityStep = 0.1

  while (quality >= minQuality) {
    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, fileType, quality)
    })

    if (!blob) {
      throw new Error("图片压缩失败")
    }

    // 如果压缩后的大小符合要求，返回结果
    if (blob.size <= maxSize) {
      return new File([blob], fileName, { type: fileType })
    }

    // 降低质量继续尝试
    quality -= qualityStep
  }

  // 如果最低质量仍然过大，进一步缩小尺寸
  const currentWidth = canvas.width
  const currentHeight = canvas.height
  const scaleRatio = 0.8

  canvas.width = Math.floor(currentWidth * scaleRatio)
  canvas.height = Math.floor(currentHeight * scaleRatio)

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("无法获取canvas context")
  }

  // 重新绘制更小的图片
  const img = new Image()
  return new Promise((resolve, reject) => {
    img.onload = async () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      try {
        const result = await compressWithQuality(
          canvas,
          fileName,
          fileType,
          maxSize,
          initialQuality
        )
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error("图片重新加载失败"))
    img.src = canvas.toDataURL(fileType, minQuality)
  })
}

/**
 * 批量压缩图片
 * @param files 图片文件数组
 * @param maxSizeInMB 最大文件大小（MB）
 * @param quality 压缩质量（0-1）
 * @returns Promise<File[]> 压缩后的图片文件数组
 */
export async function compressImages(
  files: File[],
  maxSizeInMB: number = 2,
  quality: number = 0.8
): Promise<File[]> {
  const compressedFiles: File[] = []

  for (const file of files) {
    try {
      const compressedFile = await compressImage(file, maxSizeInMB, quality)
      compressedFiles.push(compressedFile)
    } catch (error) {
      logger.error(`压缩图片 ${file.name} 失败:`, error)
      // 如果压缩失败，使用原文件
      compressedFiles.push(file)
    }
  }

  return compressedFiles
}
