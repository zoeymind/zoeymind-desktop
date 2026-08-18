import type { LogLevel, LoggerConfig, LogMessage } from './types'
import { applyColor, isBrowser, defaultColors } from './colors'

/**
 * 格式化时间戳
 */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '')
}

/**
 * 获取日志级别的显示文本
 */
function getLevelText(level: LogLevel): string {
  const levelTexts = {
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    success: 'SUCCESS'
  }
  return levelTexts[level]
}

/**
 * 格式化日志消息
 */
export function formatMessage(message: LogMessage, config: LoggerConfig): (string | number)[] {
  const colors = { ...defaultColors, ...config.colors }

  if (isBrowser) {
    // 浏览器环境格式化
    let formattedMessage = ''
    const styles: string[] = []

    // 时间戳
    if (config.showTimestamp) {
      const [timestampText, timestampStyle] = applyColor(
        `[${formatTimestamp(message.timestamp)}]`,
        colors.timestamp
      ) as [string, string]
      formattedMessage += `${timestampText} `
      styles.push(timestampStyle)
    }

    // 日志级别
    if (config.showLevel) {
      const levelColor = colors[message.level]
      const [levelText, levelStyle] = applyColor(
        `[${getLevelText(message.level)}]`,
        levelColor
      ) as [string, string]
      formattedMessage += `${levelText} `
      styles.push(levelStyle)
    }

    // 前缀
    if (config.prefix || message.prefix) {
      const prefixText = message.prefix || config.prefix || ''
      const [prefixFormatted, prefixStyle] = applyColor(`[${prefixText}]`, colors.prefix) as [
        string,
        string
      ]
      formattedMessage += `${prefixFormatted} `
      styles.push(prefixStyle)
    }

    // 消息内容 - 除了warn和error，其他都用灰白色，字体更小
    const messageColor =
      message.level === 'warn' || message.level === 'error' ? colors[message.level] : '#9ca3af' // 灰白色
    const [messageText, messageStyle] = applyColor(message.message, messageColor) as [
      string,
      string
    ]
    // 为消息内容添加小字体样式
    const smallerFontStyle = `${messageStyle}; font-size: 10px;`
    formattedMessage += messageText
    styles.push(smallerFontStyle)

    return [formattedMessage, ...styles]
  } else {
    // Node.js环境格式化
    let formattedMessage = ''

    // 时间戳
    if (config.showTimestamp) {
      const timestampText = applyColor(
        `[${formatTimestamp(message.timestamp)}]`,
        colors.timestamp
      ) as string
      formattedMessage += `${timestampText} `
    }

    // 日志级别
    if (config.showLevel) {
      const levelColor = colors[message.level]
      const levelText = applyColor(`[${getLevelText(message.level)}]`, levelColor) as string
      formattedMessage += `${levelText} `
    }

    // 前缀
    if (config.prefix || message.prefix) {
      const prefixText = message.prefix || config.prefix || ''
      const prefixFormatted = applyColor(`[${prefixText}]`, colors.prefix) as string
      formattedMessage += `${prefixFormatted} `
    }

    // 消息内容 - 除了warn和error，其他都用灰白色
    const messageColor =
      message.level === 'warn' || message.level === 'error' ? colors[message.level] : '#9ca3af' // 灰白色
    const coloredMessage = applyColor(message.message, messageColor) as string
    formattedMessage += coloredMessage

    return [formattedMessage]
  }
}
