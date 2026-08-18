/**
 * RAG 类型转换工具函数
 * 用于在服务层（Date）和 DTO（string）之间转换
 */

import type { RAGKnowledgeBaseDTO, RAGDocumentDTO } from './rag.dto'

/**
 * 将服务层的知识库对象转换为 DTO（Date → string）
 */
export function knowledgeBaseToDTO(kb: {
  id: string
  organizationId: string
  createdBy: string
  creatorName?: string | null
  creatorEmail?: string | null
  creatorAvatar?: string | null
  name: string
  description?: string | null
  tags: string[]
  isPublic: boolean
  embeddingModelId?: string | null
  embeddingDimension: number
  topK: number
  threshold: number
  returnValues: boolean
  returnMetadata: 'none' | 'all' | 'partial'
  documentCount: number
  wordCount: number
  createdAt: Date
  updatedAt: Date
  isOwner?: boolean
  permission?: 'READ' | 'WRITE' | null
}): RAGKnowledgeBaseDTO {
  return {
    id: kb.id,
    name: kb.name,
    description: kb.description ?? null,
    tags: kb.tags,
    organizationId: kb.organizationId,
    createdBy: kb.createdBy,
    isPublic: kb.isPublic,
    embeddingModelId: kb.embeddingModelId,
    embeddingDimension: kb.embeddingDimension,
    topK: kb.topK,
    threshold: kb.threshold,
    returnValues: kb.returnValues,
    returnMetadata: kb.returnMetadata,
    documentCount: kb.documentCount,
    wordCount: kb.wordCount,
    createdAt: kb.createdAt.toISOString(),
    updatedAt: kb.updatedAt.toISOString(),
    creatorName: kb.creatorName ?? undefined,
    creatorAvatar: kb.creatorAvatar ?? undefined,
    isOwner: kb.isOwner,
    permission: kb.permission
  }
}

/**
 * 将服务层的文档对象转换为 DTO（Date → string）
 */
export function documentToDTO(doc: {
  id: string
  knowledgeBaseId: string
  userId: string
  type: 'feishu_document' | 'test_case_project'
  sourceId: string
  name: string
  enabled: boolean
  embeddingStatus: 'processing' | 'completed' | 'failed'
  embeddingError?: string | null
  chunkCount: number
  tokenCount: number
  totalChunks?: number | null
  processedChunks?: number
  lastEmbeddedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}): RAGDocumentDTO {
  return {
    ...doc,
    lastEmbeddedAt: doc.lastEmbeddedAt?.toISOString() || null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  }
}
