import { describe, it, expect } from 'vitest'
import {
  isFeishuBlock,
  isFeishuDocEntity,
  extractFeishuBlocks,
  extractFeishuDocs,
  FeishuBlockType
} from '../types/feishu'

describe('Feishu Utils', () => {
  describe('isFeishuBlock', () => {
    it('should return true for valid block', () => {
      const block = {
        block_id: '123',
        block_type: FeishuBlockType.Text
      }
      expect(isFeishuBlock(block)).toBe(true)
    })

    it('should return false for invalid block', () => {
      expect(isFeishuBlock({})).toBe(false)
      expect(isFeishuBlock(null)).toBe(false)
      expect(isFeishuBlock({ block_id: '123' })).toBe(false)
    })
  })

  describe('extractFeishuBlocks', () => {
    it('should extract from items', () => {
      const resp = { items: [{ block_id: '1', block_type: 2 }] }
      expect(extractFeishuBlocks(resp)).toHaveLength(1)
    })

    it('should extract from data.items', () => {
      const resp = { data: { items: [{ block_id: '1', block_type: 2 }] } }
      expect(extractFeishuBlocks(resp)).toHaveLength(1)
    })

    it('should extract from result.data.items', () => {
      const resp = { result: { data: { items: [{ block_id: '1', block_type: 2 }] } } }
      expect(extractFeishuBlocks(resp)).toHaveLength(1)
    })

    it('should return empty array if nothing found', () => {
      expect(extractFeishuBlocks({})).toEqual([])
    })
  })

  describe('isFeishuDocEntity', () => {
    it('should return true for valid doc entity', () => {
      const doc = {
        docs_token: 'tok-1',
        doc_type: 'docx'
      }
      expect(isFeishuDocEntity(doc)).toBe(true)
    })

    it('should return false for invalid doc entity', () => {
      expect(isFeishuDocEntity({})).toBe(false)
      expect(isFeishuDocEntity(null)).toBe(false)
    })
  })

  describe('extractFeishuDocs', () => {
    it('should extract from docs_entities', () => {
      const resp = {
        docs_entities: [{ docs_token: '1', doc_type: 'docx', title: 'T', owner_id: 'O' }]
      }
      expect(extractFeishuDocs(resp)).toHaveLength(1)
    })

    it('should extract from data.docs_entities', () => {
      const resp = {
        data: { docs_entities: [{ docs_token: '1', doc_type: 'docx', title: 'T', owner_id: 'O' }] }
      }
      expect(extractFeishuDocs(resp)).toHaveLength(1)
    })

    it('should extract from result.data.docs_entities', () => {
      const resp = {
        result: {
          data: {
            docs_entities: [{ docs_token: '1', doc_type: 'docx', title: 'T', owner_id: 'O' }]
          }
        }
      }
      expect(extractFeishuDocs(resp)).toHaveLength(1)
    })

    it('should return empty array if nothing found', () => {
      expect(extractFeishuDocs({})).toEqual([])
    })
  })
})
