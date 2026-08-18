// 主导出文件
export { createLogger, logger, configureLogger, DEFAULT_REDACT_KEYS } from './logger'
export { showLogo } from './logo'
export { defaultColors, isBrowser } from './colors'
export type { LogLevel, LoggerConfig, ColorTheme, LogMessage, Logger } from './types'

// 默认导出logger实例
import { logger } from './logger'
export default logger
