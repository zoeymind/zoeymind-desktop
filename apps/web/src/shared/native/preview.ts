/**
 * 缩略图合成 —— .zmind 里 preview.png 的生成入口。
 *
 * 由 editor 保存流程调用：
 *   1. 让 simple-mind-map 引擎导出当前画布 PNG（Uint8Array）
 *   2. 用 canvas 把 mindmap PNG 与品牌 logo 侧贴合，右下角 20px 边距
 *   3. 输出合成后的 PNG bytes，写入 bundle 的 preview.png
 *
 * 结果同一份 bytes 会被 (a) 打包进 bundle，(b) 展示在列表卡片。
 */

/** 品牌 logo asset URL；桌面端打包资源，import.meta.url 相对解析。 */
import logoUrl from '@/assets/logo.svg?url'

const LOGO_SIZE = 56 // px, 缩略图右下角
const LOGO_MARGIN = 20

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>()
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = url
  return promise
}

async function loadImageFromBytes(bytes: Uint8Array): Promise<HTMLImageElement> {
  const blob = new Blob([bytes], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  try {
    return await loadImageFromUrl(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function composePreviewWithLogo(mindmapPng: Uint8Array): Promise<Uint8Array> {
  const mindImg = await loadImageFromBytes(mindmapPng)
  const logoImg = await loadImageFromUrl(logoUrl)

  const canvas = document.createElement('canvas')
  canvas.width = mindImg.width
  canvas.height = mindImg.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('preview compose: no 2d context')

  ctx.drawImage(mindImg, 0, 0)

  // 右下角半透明白底 + logo
  const badgeX = canvas.width - LOGO_SIZE - LOGO_MARGIN
  const badgeY = canvas.height - LOGO_SIZE - LOGO_MARGIN
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fillRect(badgeX - 6, badgeY - 6, LOGO_SIZE + 12, LOGO_SIZE + 12)
  ctx.drawImage(logoImg, badgeX, badgeY, LOGO_SIZE, LOGO_SIZE)

  const { promise, resolve } = Promise.withResolvers<Blob | null>()
  canvas.toBlob(resolve, 'image/png')
  const blob = await promise
  if (!blob) throw new Error('preview compose: canvas toBlob failed')
  return new Uint8Array(await blob.arrayBuffer())
}
