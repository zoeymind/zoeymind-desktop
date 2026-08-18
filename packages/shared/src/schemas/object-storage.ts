import { z } from 'zod'

/**
 * 对象存储资源类型 — 决定 object key 前缀与业务归属（参考 ADR 0004）。
 *
 * 单一事实源（AGENTS 红线 #8）：所有引用该常量，不写字符串字面量。
 * key 形如 `{resourceType}/{resourceId}/{uuid}.{ext}`。
 */
export const ResourceTypes = {
  MINDMAP_COVER: 'mindmap_cover',
  ATTACHMENT: 'attachment',
  BUG_ATTACHMENT: 'bug_attachment',
  BUG_COMMENT_ATTACHMENT: 'bug_comment_attachment',
  REPORT_EXPORT: 'report_export'
} as const

export type ResourceType = (typeof ResourceTypes)[keyof typeof ResourceTypes]

export const resourceTypeEnum = z.enum([
  ResourceTypes.MINDMAP_COVER,
  ResourceTypes.ATTACHMENT,
  ResourceTypes.BUG_ATTACHMENT,
  ResourceTypes.BUG_COMMENT_ATTACHMENT,
  ResourceTypes.REPORT_EXPORT
])

/** 上传单个文件（写走 API 代理）。文件体走 multipart，本 schema 描述元数据字段。 */
export const uploadObjectSchema = z.object({
  resourceType: resourceTypeEnum.describe('资源类型，决定 key 前缀与归属'),
  resourceId: z.string().min(1).describe('关联业务实体 ID（导图 ID / 缺陷 ID 等）'),
  fileName: z.string().min(1).describe('原始文件名，用于推导扩展名'),
  mimeType: z.string().min(1).describe('文件 MIME 类型'),
  /** base64 文件内容（三段式过渡期走 API 代理，前端直传后续再上）。 */
  data: z.string().min(1).describe('base64 编码的文件内容'),
  organizationId: z.string().optional().describe('归属组织 ID（可空，个人资源）')
})

export type UploadObjectInput = z.infer<typeof uploadObjectSchema>

/** 上传成功后返回的 File 记录标识。 */
export const uploadObjectResponseSchema = z.object({
  id: z.string().describe('File 记录 ID'),
  key: z.string().describe('对象存储 key'),
  url: z.string().describe('可直接读取的 presigned GET URL')
})

export type UploadObjectResponse = z.infer<typeof uploadObjectResponseSchema>

/** 按 File 记录 ID 取临时读取 URL。 */
export const getFileUrlSchema = z.object({
  id: z.string().min(1).describe('File 记录 ID'),
  expiresSec: z.number().int().positive().max(86400).optional().describe('URL 有效秒数')
})

export type GetFileUrlInput = z.infer<typeof getFileUrlSchema>

/**
 * 大文件直传上限（几百MB 级；presigned 直传字节不过 API 进程，参考 ADR 0004 + #98）。
 * 断点续传/分片超大文件（2G+）另拆卡，本轮不做。
 */
export const MAX_DIRECT_UPLOAD_SIZE = 500 * 1024 * 1024

/**
 * 请求 presigned PUT 上传 URL（第 1 步）。浏览器拿 URL 直传 MinIO，字节不过 API 进程。
 */
export const requestUploadUrlSchema = z.object({
  resourceType: resourceTypeEnum.describe('资源类型，决定 key 前缀与归属'),
  resourceId: z.string().min(1).describe('关联业务实体 ID（缺陷 ID 等）'),
  fileName: z.string().min(1).describe('原始文件名，用于推导扩展名'),
  mimeType: z.string().min(1).describe('文件 MIME 类型'),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_DIRECT_UPLOAD_SIZE, '文件超过直传大小上限')
    .describe('文件字节数，签发前校验上限'),
  organizationId: z.string().optional().describe('归属组织 ID（可空）')
})

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>

export const requestUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().describe('presigned PUT URL，浏览器直传目标'),
  key: z.string().describe('对象 key，直传完回传给 confirmUpload'),
  expiresSec: z.number().describe('URL 有效秒数')
})

export type RequestUploadUrlResponse = z.infer<typeof requestUploadUrlResponseSchema>

/**
 * 直传完成后登记 File 元数据（第 3 步）。
 */
export const confirmUploadSchema = z.object({
  key: z.string().min(1).describe('requestUploadUrl 返回的对象 key'),
  resourceType: resourceTypeEnum.describe('资源类型'),
  resourceId: z.string().min(1).describe('关联业务实体 ID'),
  fileName: z.string().optional().describe('原始文件名（展示用，可空兼容旧调用点）'),
  mimeType: z.string().min(1).describe('文件 MIME 类型'),
  size: z.number().int().positive().max(MAX_DIRECT_UPLOAD_SIZE).describe('文件字节数'),
  organizationId: z.string().optional().describe('归属组织 ID（可空）')
})

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>
