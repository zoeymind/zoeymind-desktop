import { describe, it, expect } from 'vitest'
import { knowledgeBaseToDTO, documentToDTO } from '../types/rag.utils'

describe('RAG Utils', () => {
  describe('knowledgeBaseToDTO', () => {
    it('should convert knowledge base to DTO correctly', () => {
      const now = new Date()
      const kb = {
        id: 'kb-1',
        organizationId: 'org-1',
        createdBy: 'user-1',
        name: 'Test KB',
        description: 'Test Description',
        tags: ['test'],
        isPublic: false,
        embeddingDimension: 1536,
        topK: 3,
        threshold: 0.7,
        returnValues: true,
        returnMetadata: 'all' as const,
        documentCount: 5,
        wordCount: 1000,
        createdAt: now,
        updatedAt: now
      }

      const dto = knowledgeBaseToDTO(kb)

      expect(dto.id).toBe(kb.id)
      expect(dto.createdAt).toBe(now.toISOString())
      expect(dto.updatedAt).toBe(now.toISOString())
      expect(dto.description).toBe(kb.description)
      expect(dto.embeddingDimension).toBe(1536)
    })

    it('should handle null optional fields', () => {
      const now = new Date()
      const kb = {
        id: 'kb-1',
        organizationId: 'org-1',
        createdBy: 'user-1',
        name: 'Test KB',
        description: null,
        tags: [],
        isPublic: false,
        embeddingDimension: 1536,
        topK: 3,
        threshold: 0.7,
        returnValues: true,
        returnMetadata: 'none' as const,
        documentCount: 0,
        wordCount: 0,
        createdAt: now,
        updatedAt: now
      }

      const dto = knowledgeBaseToDTO(kb)
      expect(dto.description).toBeNull()
    })
  })

  describe('documentToDTO', () => {
    it('should convert document to DTO correctly', () => {
      const now = new Date()
      const doc = {
        id: 'doc-1',
        knowledgeBaseId: 'kb-1',
        userId: 'user-1',
        type: 'feishu_document' as const,
        sourceId: 'src-1',
        name: 'Test Doc',
        enabled: true,
        embeddingStatus: 'completed' as const,
        chunkCount: 10,
        tokenCount: 2000,
        createdAt: now,
        updatedAt: now
      }

      const dto = documentToDTO(doc)

      expect(dto.id).toBe(doc.id)
      expect(dto.createdAt).toBe(now.toISOString())
      expect(dto.lastEmbeddedAt).toBeNull()
    })
  })
})
