import { z } from 'zod'

/**
 * 上传服务相关的 Schema 定义
 * 前后端共享，确保类型一致性
 */

// 支持的图片类型
export const imageTypeEnum = z.enum(
  ['avatar', 'preview', 'attachment', 'cover', 'thumbnail', 'announcement'],
  {
    error: '不支持的图片类型'
  }
)

// 支持的业务分类
export const categoryEnum = z.enum(['user', 'mindmap', 'document', 'project', 'announcement'], {
  error: '不支持的业务分类'
})

// 支持的文件格式
export const fileFormatEnum = z.enum(['png', 'jpg', 'jpeg', 'webp'], {
  error: '不支持的文件格式，仅支持 png, jpg, jpeg, webp'
})

// 图片上传输入 Schema (仅支持base64格式)
export const uploadImageSchema = z.object({
  category: categoryEnum.describe('业务分类'),
  type: imageTypeEnum.describe('图片类型'),
  imageData: z
    .string()
    .min(1, '图片数据不能为空')
    .regex(/^data:image\/[a-z]+;base64,/, '必须是有效的base64图片数据')
    .describe('base64格式的图片数据'),
  imageFormat: fileFormatEnum.default('png').describe('图片格式'),
  relatedId: z.string().optional().describe('关联的业务ID（如项目ID、用户ID等）'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('额外的元数据信息')
})

// 新增：直接文件上传 Schema
export const uploadFileSchema = z.object({
  category: categoryEnum.describe('业务分类'),
  type: imageTypeEnum.describe('图片类型'),
  relatedId: z.string().optional().describe('关联的业务ID（如项目ID、用户ID等）'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('额外的元数据信息')
})

// 删除图片输入 Schema
export const deleteImageSchema = z.object({
  objectKey: z.string().min(1, '对象键不能为空').describe('要删除的文件对象键')
})

// 图片上传响应 Schema（用于类型推导）
export const uploadImageResponseSchema = z.object({
  success: z.boolean(),
  objectKey: z.string(),
  url: z.string(),
  fileSize: z.number(),
  contentType: z.string(),
  uploadInfo: z.object({
    objectKey: z.string(),
    category: categoryEnum,
    type: imageTypeEnum,
    userId: z.string(),
    relatedId: z.string().optional(),
    fileSize: z.number(),
    contentType: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    uploadedAt: z.string()
  }),
  message: z.string()
})

// 删除图片响应 Schema
export const deleteImageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

// Schema已在上面定义时直接导出

// 导出类型（供 TypeScript 使用）
export type ImageType = z.infer<typeof imageTypeEnum>
export type Category = z.infer<typeof categoryEnum>
export type FileFormat = z.infer<typeof fileFormatEnum>
export type UploadImageInput = z.infer<typeof uploadImageSchema>
export type UploadFileInput = z.infer<typeof uploadFileSchema>
export type DeleteImageInput = z.infer<typeof deleteImageSchema>

/**
 * 获取预签名URL
 */
export const getPresignedUrlSchema = z.object({
  objectKey: z.string().min(1, '对象键不能为空'),
  expiryHours: z.number().min(1).max(168).default(24).describe('有效期（小时），最大7天')
})

export type GetPresignedUrlInput = z.infer<typeof getPresignedUrlSchema>
export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>
export type DeleteImageResponse = z.infer<typeof deleteImageResponseSchema>
