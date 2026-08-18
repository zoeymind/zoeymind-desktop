import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, logger, configureLogger } from '../logger'

describe('Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createLogger', () => {
    it('should create a logger instance', () => {
      const testLogger = createLogger({ prefix: 'TEST' })
      expect(testLogger).toBeDefined()
      expect(testLogger.info).toBeInstanceOf(Function)
      expect(testLogger.error).toBeInstanceOf(Function)
      expect(testLogger.warn).toBeInstanceOf(Function)
      expect(testLogger.debug).toBeInstanceOf(Function)
      expect(testLogger.success).toBeInstanceOf(Function)
    })

    it('should respect show config', () => {
      const silentLogger = createLogger({ show: false })
      silentLogger.info('This should not appear')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should respect minLevel config', () => {
      const levelLogger = createLogger({ showLogo: false, minLevel: 'warn' })
      levelLogger.debug('Debug message')
      levelLogger.info('Info message')
      levelLogger.warn('Warning message')
      expect(console.log).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledTimes(1)
    })

    it('should use correct console method for each level', () => {
      const testLogger = createLogger({ showLogo: false })
      testLogger.info('Info')
      testLogger.warn('Warning')
      testLogger.error('Error')
      expect(console.log).toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    })

    it('should handle multiple arguments', () => {
      const testLogger = createLogger({ showLogo: false })
      testLogger.info('Message', { data: 'test' }, [1, 2, 3])
      expect(console.log).toHaveBeenCalled()
    })

    it('should update config via setConfig', () => {
      const testLogger = createLogger({ show: true, showLogo: false })
      testLogger.info('Before update')
      testLogger.setConfig({ show: false })
      testLogger.info('After update')
      expect(console.log).toHaveBeenCalledTimes(1)
    })

    it('should get config via getConfig', () => {
      const testLogger = createLogger({ prefix: 'TEST', showLogo: false })
      const config = testLogger.getConfig()
      expect(config.prefix).toBe('TEST')
      expect(config.show).toBe(true)
    })
  })

  describe('log level filtering', () => {
    it('should filter debug when minLevel is info', () => {
      const levelLogger = createLogger({ showLogo: false, minLevel: 'info' })
      levelLogger.debug('Debug')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should allow all levels when minLevel is debug', () => {
      const levelLogger = createLogger({ showLogo: false, minLevel: 'debug' })
      levelLogger.debug('Debug')
      levelLogger.info('Info')
      levelLogger.warn('Warning')
      levelLogger.error('Error')
      expect(console.log).toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('configureLogger', () => {
    it('should configure the global logger', () => {
      configureLogger({ showLogo: false, prefix: 'UPDATED' })
      const config = logger.getConfig()
      expect(config.prefix).toBe('UPDATED')
    })
  })

  describe('timestamp display', () => {
    it('should not show timestamp by default', () => {
      const testLogger = createLogger({ showLogo: false, showTimestamp: false })
      testLogger.info('Message')
      const spy = vi.mocked(console.log)
      const calls = spy.mock.calls
      const message = calls[calls.length - 1].join(' ')
      expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    })

    it('should show timestamp when enabled', () => {
      const testLogger = createLogger({ showLogo: false, showTimestamp: true })
      testLogger.info('Message')
      const spy = vi.mocked(console.log)
      const calls = spy.mock.calls
      const message = calls[calls.length - 1].join(' ')
      expect(message).toMatch(/\d{4}-\d{2}-\d{2}/)
    })
  })

  describe('JSON mode', () => {
    const lastJson = () => {
      const calls = vi.mocked(console.error).mock.calls
      return JSON.parse(String(calls[calls.length - 1][0]))
    }

    it('serializes Error with message and stack (not dropped)', () => {
      const jsonLogger = createLogger({ json: true, showLogo: false })
      const err = new Error('boom')
      jsonLogger.error('操作失败', err)
      const entry = lastJson()
      expect(entry.msg).toBe('操作失败')
      expect(entry.name).toBe('Error')
      expect(entry.message).toBe('boom')
      expect(typeof entry.stack).toBe('string')
    })

    it('serializes nested Error cause', () => {
      const jsonLogger = createLogger({ json: true, showLogo: false })
      const err = new Error('outer', { cause: new Error('inner') })
      jsonLogger.error('failed', err)
      const entry = lastJson()
      expect(entry.cause.message).toBe('inner')
    })

    it('serializes Error inside data array', () => {
      const jsonLogger = createLogger({ json: true, showLogo: false })
      jsonLogger.error('multi', new Error('x'), 42)
      const entry = lastJson()
      expect(entry.data[0].message).toBe('x')
      expect(entry.data[1]).toBe(42)
    })

    it('redacts configured sensitive keys (case-insensitive, deep)', () => {
      const jsonLogger = createLogger({
        json: true,
        showLogo: false,
        redactKeys: ['password', 'token']
      })
      jsonLogger.error('login', { user: 'a', Password: 'p', nested: { token: 't' } })
      const entry = lastJson()
      expect(entry.user).toBe('a')
      expect(entry.Password).toBe('[REDACTED]')
      expect(entry.nested.token).toBe('[REDACTED]')
    })

    it('injects contextProvider fields', () => {
      const jsonLogger = createLogger({
        json: true,
        showLogo: false,
        contextProvider: () => ({ requestId: 'req-1', userId: 'u-9' })
      })
      jsonLogger.error('ping')
      const entry = lastJson()
      expect(entry.requestId).toBe('req-1')
      expect(entry.userId).toBe('u-9')
    })
  })
})
