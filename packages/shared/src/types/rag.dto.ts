/**
 * RAG 数据传输对象（DTO）
 * 统一的 RAG 信息返回格式（前后端共享）
 */

/**
 * 文档类型
 */
export type RAGDocumentType = 'feishu_document' | 'test_case_project' | 'local_file'

/**
 * Embedding 状态
 */
export type EmbeddingStatus = 'processing' | 'completed' | 'failed'

/**
 * RAG 知识库 DTO
 */
export interface RAGKnowledgeBaseDTO {
  id: string
  name: string
  description: string | null
  tags: string[]
  organizationId: string
  createdBy: string
  isPublic: boolean
  embeddingModelId?: string | null
  embeddingDimension: number
  topK: number
  threshold: number
  returnValues: boolean
  returnMetadata: 'none' | 'all' | 'partial'
  documentCount: number
  wordCount: number
  createdAt: string
  updatedAt: string
  creatorName?: string
  creatorAvatar?: string | null
  isOwner?: boolean
  permission?: 'READ' | 'WRITE' | null
}

/**
 * RAG 文档 DTO
 */
export interface RAGDocumentDTO {
  id: string
  knowledgeBaseId: string
  userId: string
  type: RAGDocumentType
  sourceId: string
  name: string
  enabled: boolean
  embeddingStatus: EmbeddingStatus
  embeddingError?: string | null
  chunkCount: number
  tokenCount: number
  totalChunks?: number | null // 总分段数（用于进度显示）
  processedChunks?: number // 已处理的分段数（用于进度显示）
  lastEmbeddedAt?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * RAG 配置 DTO（全局配置，保留向后兼容）
 */
export interface RAGConfigDTO {
  id: string
  userId: string
  embeddingModel: string
  topK: number
  threshold: number
  returnValues: boolean
  returnMetadata: 'none' | 'all' | 'partial'
  createdAt: string
  updatedAt: string
}

/**
 * 段落元数据
 */
export interface ChunkMetadata {
  type: string
  caseId?: string
  caseName?: string
  moduleId?: string
  moduleName?: string
  priority?: number
  feishuDocumentId?: string
  feishuDocumentName?: string
  blockId?: string
  offset?: number
  pageNumber?: number
  keywords?: string
  parentChunkId?: string
  question?: string
  answer?: string
}

/**
 * RAG 向量块 DTO
 */
export interface RAGVectorChunkDTO {
  id: string
  documentId: string
  userId: string
  content: string
  chunkIndex: number
  type: string
  metadata: ChunkMetadata
  createdAt: string
  updatedAt: string
}

/**
 * 检索资源 DTO（用于 retriever_resources）
 */
export interface RetrieverResourceDTO {
  position: number
  chunk_id: string
  knowledge_base_id: string
  knowledge_base_name: string
  document_id: string
  document_name: string
  document_type: RAGDocumentType
  content: string
  score: number
  metadata?: ChunkMetadata
}

/**
 * 测试检索结果 DTO
 */
export interface TestRetrievalResultDTO {
  query: string
  retriever_resources: RetrieverResourceDTO[]
  total_chunks: number
  topK?: number
  threshold?: number
}

/**
 * RAG 上下文 DTO
 */
export interface RAGContextDTO {
  context: string
  retriever_resources: RetrieverResourceDTO[]
  topK?: number
  threshold?: number
}
