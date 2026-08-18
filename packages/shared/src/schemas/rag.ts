/**
 * RAG 相关的 Zod Schema 定义（前后端共享）
 *
 * 使用 Zod 定义，确保前后端类型一致
 */

import { z } from 'zod'

/**
 * 文档类型
 */
export const RAGDocumentTypeSchema = z.enum(['feishu_document', 'test_case_project', 'local_file'])

/**
 * Embedding 状态
 */
export const EmbeddingStatusSchema = z.enum(['processing', 'completed', 'failed'])

/**
 * 创建知识库 Schema
 */
export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, '知识库名称不能为空'),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  embeddingModelId: z.string().min(1, '请选择 Embedding 模型'),
  embeddingDimension: z.number().int().positive('向量维度必须为正整数'),
  // Workspace 挂载 (可空,兼容 legacy 场景;新前端建议强制传)
  workspaceId: z.string().optional()
})

/**
 * 更新知识库 Schema
 */
export const updateKnowledgeBaseSchema = z.object({
  id: z.string().cuid('无效的知识库ID'),
  name: z.string().min(1, '知识库名称不能为空').optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  embeddingModelId: z.string().optional(),
  topK: z.number().int().min(1).max(100).optional(),
  threshold: z.number().min(0).max(1).optional(),
  returnValues: z.boolean().optional(),
  returnMetadata: z.enum(['none', 'all', 'partial']).optional()
})

/**
 * 删除知识库 Schema
 */
export const deleteKnowledgeBaseSchema = z.object({
  id: z.string().cuid('无效的知识库ID')
})

/**
 * 添加文档 Schema
 */
export const addDocumentSchema = z.object({
  knowledgeBaseId: z.string().cuid('无效的知识库ID'),
  type: RAGDocumentTypeSchema,
  sourceId: z.string().min(1, '文档ID不能为空'),
  name: z.string().min(1, '名称不能为空'),
  // 前端分段后的内容数组（必须提供）
  chunks: z.array(z.string().min(1)).min(1, '必须提供至少一个分段')
})

/**
 * 删除文档 Schema
 */
export const removeDocumentSchema = z.object({
  id: z.string().cuid('无效的文档ID')
})

/**
 * 生成 Embedding Schema
 */
export const generateEmbeddingSchema = z.object({
  documentId: z.string().cuid('无效的文档ID')
})

/**
 * 更新 RAG 配置 Schema（保留用于全局配置）
 */
export const updateRAGConfigSchema = z.object({
  embeddingModel: z.string().optional(),
  topK: z.number().int().min(1).max(100).optional(),
  threshold: z.number().min(0).max(1).optional(),
  returnValues: z.boolean().optional(),
  returnMetadata: z.enum(['none', 'all', 'partial']).optional()
})

/**
 * 测试检索 Schema
 */
export const testRetrievalSchema = z.object({
  query: z.string().min(1, '查询内容不能为空'),
  knowledgeBaseIds: z.array(z.string().cuid('无效的知识库ID')).min(1, '至少选择一个知识库')
})

/**
 * 获取知识库详情 Schema
 */
export const getKnowledgeBaseDetailSchema = z.object({
  knowledgeBaseId: z.string().cuid('无效的知识库ID')
})

/**
 * 获取文档详情 Schema
 */
export const getDocumentDetailSchema = z.object({
  documentId: z.string().cuid('无效的文档ID')
})

/**
 * 获取文档分段列表 Schema
 */
export const getDocumentChunksSchema = z.object({
  documentId: z.string().cuid('无效的文档ID'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50)
})

/**
 * 获取段落列表 Schema
 */
export const getChunksSchema = z.object({
  documentId: z.string().cuid('无效的文档ID'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['chunkIndex']).default('chunkIndex'),
  order: z.enum(['asc', 'desc']).default('asc')
})

/**
 * 知识库权限管理 Schema
 */

// 知识库访问级别（粒度比 mindmap 粗：仅 READ/WRITE）
export const KBAccessLevelSchema = z.enum(['READ', 'WRITE'])
export const KBAccessLevels = KBAccessLevelSchema.enum
export type KBAccessLevel = z.infer<typeof KBAccessLevelSchema>

export const createKnowledgeBasePermissionSchema = z.object({
  knowledgeBaseId: z.string().cuid('无效的知识库ID'),
  userId: z.string().cuid('无效的用户ID'),
  permission: KBAccessLevelSchema
})

export const updateKnowledgeBasePermissionSchema = z.object({
  knowledgeBaseId: z.string().cuid('无效的知识库ID'),
  userId: z.string().cuid('无效的用户ID'),
  permission: KBAccessLevelSchema
})

export const deleteKnowledgeBasePermissionSchema = z.object({
  knowledgeBaseId: z.string().cuid('无效的知识库ID'),
  userId: z.string().cuid('无效的用户ID')
})

export const getKnowledgeBasePermissionsSchema = z.object({
  knowledgeBaseId: z.string().cuid('无效的知识库ID')
})

export const checkKnowledgeBasePermissionSchema = z.object({
  knowledgeBaseId: z.string().cuid('无效的知识库ID'),
  action: z.enum(['read', 'write', 'delete']).default('read')
})
