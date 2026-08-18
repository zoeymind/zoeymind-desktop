import type { LogLevel, LoggerConfig, Logger } from './types'
import { defaultColors, isBrowser } from './colors'
import { formatMessage } from './formatter'
import { showLogo } from './logo'
import { normalizeError, redact } from './serialize'
import { isProduction } from './env'

// 生产环境最低级别：
// - 浏览器生产：只留 warn/error（debug/info/success 不进用户 console，避免泄露与噪音）
// - Node 生产：info（服务端日志要保留常规运行信息供检索）
// - 开发：debug（全量）
const prodMinLevel: LogLevel = isBrowser ? 'warn' : 'info'

const defaultConfig: LoggerConfig = {
  show: true,
  showLogo: !isProduction,
  showTimestamp: false,
  showLevel: true,
  colors: defaultColors,
  minLevel: isProduction ? prodMinLevel : 'debug',
  json: isProduction
}

/**
 * 创建Logger实例
 */
export function createLogger(initialConfig: Partial<LoggerConfig> = {}): Logger {
  let config: LoggerConfig = { ...defaultConfig, ...initialConfig }
  let logoShown = false

  /**
   * 显示Logo（仅显示一次）
   */
  function displayLogo(): void {
    if (config.showLogo && !logoShown) {
      showLogo()
      logoShown = true
    }
  }

  /**
   * 检查日志级别是否应该显示
   */
  function shouldLog(level: LogLevel): boolean {
    if (!config.show) return false
    if (!config.minLevel) return true

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'success']
    const currentLevelIndex = levels.indexOf(level)
    const minLevelIndex = levels.indexOf(config.minLevel)

    return currentLevelIndex >= minLevelIndex
  }

  function log(level: LogLevel, ...args: unknown[]): void {
    if (!shouldLog(level)) return

    if (!config.json) {
      displayLogo()
    }

    const mainMessage = args.length > 0 ? String(args[0]) : ''
    const extraArgs = args.slice(1)

    if (config.json) {
      const entry: Record<string, unknown> = {
        level,
        msg: mainMessage,
        time: Date.now()
      }
      if (config.prefix) entry.prefix = config.prefix
      // 环境上下文（requestId/userId 等）先注入，作为权威字段
      const ctx = config.contextProvider?.()
      if (ctx) Object.assign(entry, ctx)
      // 附加参数：Error 展开为普通对象（否则 stack/message 丢失），其余原样
      if (extraArgs.length === 1 && typeof extraArgs[0] === 'object' && extraArgs[0] !== null) {
        const first = extraArgs[0]
        Object.assign(entry, first instanceof Error ? normalizeError(first) : first)
      } else if (extraArgs.length > 0) {
        entry.data = extraArgs.map(arg => (arg instanceof Error ? normalizeError(arg) : arg))
      }
      const redactKeys = config.redactKeys
      const payload =
        redactKeys && redactKeys.length > 0
          ? redact(entry, new Set(redactKeys.map(k => k.toLowerCase())))
          : entry
      const consoleMethod =
        level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      consoleMethod(JSON.stringify(payload))
      return
    }

    const logMessage = { level, message: mainMessage, timestamp: new Date() }
    const formattedParts = formatMessage(logMessage, config)

    const consoleMethod =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    consoleMethod(...formattedParts, ...extraArgs)
  }

  return {
    debug: (...args: unknown[]) => log('debug', ...args),
    info: (...args: unknown[]) => log('info', ...args),
    warn: (...args: unknown[]) => log('warn', ...args),
    error: (...args: unknown[]) => log('error', ...args),
    success: (...args: unknown[]) => log('success', ...args),
    log: (...args: unknown[]) => log('info', ...args), // 默认使用info级别

    setConfig: (newConfig: Partial<LoggerConfig>) => {
      config = { ...config, ...newConfig }
    },

    getConfig: () => ({ ...config })
  }
}

// 生产 JSON 模式默认脱敏的高危字段（大小写不敏感）。业务可用 configureLogger 追加。
export const DEFAULT_REDACT_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'sessionToken'
]

export const logger = createLogger({
  prefix: 'ZOEY',
  showTimestamp: false,
  showLevel: true,
  showLogo: !isProduction,
  minLevel: isProduction ? prodMinLevel : 'debug',
  json: isProduction,
  redactKeys: DEFAULT_REDACT_KEYS
})

export function configureLogger(config: Partial<LoggerConfig>) {
  logger.setConfig(config)
}
