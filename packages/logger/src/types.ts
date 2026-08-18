export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success'

export interface LoggerConfig {
  show: boolean
  showLogo: boolean
  showTimestamp: boolean
  showLevel: boolean
  prefix?: string
  colors?: Partial<ColorTheme>
  minLevel?: LogLevel
  json?: boolean
  /** 生产 JSON 模式下需脱敏的字段名（大小写不敏感，递归匹配）。命中值替换为 '[REDACTED]'。 */
  redactKeys?: string[]
  /** 返回每条日志要注入的环境字段（如 requestId/userId）。JSON 模式下合并进日志，权威值覆盖用户传入。 */
  contextProvider?: () => Record<string, unknown> | undefined
}

export interface ColorTheme {
  debug: string
  info: string
  warn: string
  error: string
  success: string
  timestamp: string
  prefix: string
}

export interface LogMessage {
  level: LogLevel
  message: string
  timestamp: Date
  prefix?: string
}

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  success: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  setConfig: (config: Partial<LoggerConfig>) => void
  getConfig: () => LoggerConfig
}
