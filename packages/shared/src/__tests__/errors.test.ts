import { describe, it, expect } from 'vitest'
import { ErrorCode, resolveErrorDescriptor, buildErrorPayload, ERROR_DESCRIPTORS } from '../errors'

describe('Error Handling', () => {
  describe('resolveErrorDescriptor', () => {
    it('should return the correct descriptor for a known error code', () => {
      const descriptor = resolveErrorDescriptor(ErrorCode.AUTH_REQUIRED)
      expect(descriptor).toEqual(ERROR_DESCRIPTORS[ErrorCode.AUTH_REQUIRED])
      expect(descriptor.code).toBe(ErrorCode.AUTH_REQUIRED)
      expect(descriptor.httpStatus).toBe(401)
    })

    it('should return UNKNOWN_ERROR descriptor for an unknown error code', () => {
      // @ts-expect-error - testing invalid input
      const descriptor = resolveErrorDescriptor('INVALID_CODE')
      expect(descriptor).toEqual(ERROR_DESCRIPTORS[ErrorCode.UNKNOWN])
      expect(descriptor.code).toBe(ErrorCode.UNKNOWN)
      expect(descriptor.httpStatus).toBe(500)
    })
  })

  describe('buildErrorPayload', () => {
    it('should build a payload with default message', () => {
      const payload = buildErrorPayload(ErrorCode.NOT_FOUND)
      expect(payload.code).toBe(ErrorCode.NOT_FOUND)
      expect(payload.message).toBe(ERROR_DESCRIPTORS[ErrorCode.NOT_FOUND].message)
      expect(payload.httpStatus).toBe(404)
      expect(payload.details).toBeUndefined()
    })

    it('should include details in the payload if provided', () => {
      const details = { resourceId: '123' }
      const payload = buildErrorPayload(ErrorCode.VALIDATION_FAILED, { details })
      expect(payload.code).toBe(ErrorCode.VALIDATION_FAILED)
      expect(payload.details).toEqual(details)
    })
  })
})
