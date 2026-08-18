import { describe, it, expect } from 'vitest'
import { createOrganizationSchema } from '../schemas/organization'
import { uploadImageSchema } from '../schemas/upload'
import { TestCaseStepSchema, UITestCasePriorityEnum } from '../schemas/test-project'
import { createMindmapSchema } from '../schemas/mindmap'

describe('Schemas Validation', () => {
  describe('createOrganizationSchema', () => {
    it('should validate correct data', () => {
      const data = {
        name: 'My Org',
        slug: 'my-org',
        description: 'Testing'
      }
      const result = createOrganizationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should fail on invalid slug', () => {
      const data = {
        name: 'My Org',
        slug: 'My Org' // Invalid: spaces and uppercase
      }
      const result = createOrganizationSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('uploadImageSchema', () => {
    it('should validate correct base64 image data', () => {
      const data = {
        category: 'user',
        type: 'avatar',
        imageData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        imageFormat: 'png'
      }
      const result = uploadImageSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should fail on invalid base64 format', () => {
      const data = {
        category: 'user',
        type: 'avatar',
        imageData: 'not-base64'
      }
      const result = uploadImageSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('test-project schemas', () => {
    it('should validate test case step', () => {
      const result = TestCaseStepSchema.safeParse({ action: 'click', expected: 'ok' })
      expect(result.success).toBe(true)
    })

    it('should validate priorities', () => {
      expect(UITestCasePriorityEnum.parse('P0')).toBe('P0')
    })
  })

  describe('mindmap schema', () => {
    it('should validate create mindmap input', () => {
      const data = {
        title: 'New Mindmap',
        tags: ['test']
      }
      const result = createMindmapSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })
})
