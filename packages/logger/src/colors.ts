import type { ColorTheme } from './types'

// 检测是否在浏览器环境
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

// 默认颜色主题
export const defaultColors: ColorTheme = {
  debug: '#6b7280', // 灰色
  info: '#3b82f6', // 蓝色
  warn: '#f59e0b', // 黄色
  error: '#ef4444', // 红色
  success: '#10b981', // 绿色
  timestamp: '#9ca3af', // 浅灰色
  prefix: '#8b5cf6' // 紫色
}

// Node.js环境的ANSI颜色代码
const ansiColors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // 亮色
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m'
}

// 将十六进制颜色转换为最接近的ANSI颜色
function hexToAnsi(hex: string): string {
  const colorMap: Record<string, string> = {
    '#6b7280': ansiColors.gray, // debug - 灰色
    '#3b82f6': ansiColors.blue, // info - 蓝色
    '#f59e0b': ansiColors.yellow, // warn - 黄色
    '#ef4444': ansiColors.red, // error - 红色
    '#10b981': ansiColors.green, // success - 绿色
    '#9ca3af': ansiColors.gray, // timestamp - 浅灰色
    '#8b5cf6': ansiColors.magenta // prefix - 紫色
  }

  return colorMap[hex.toLowerCase()] || ansiColors.white
}

/**
 * 在终端中应用颜色
 */
export function applyNodeColor(text: string, color: string): string {
  if (!color) return text
  const ansiColor = hexToAnsi(color)
  return `${ansiColor}${text}${ansiColors.reset}`
}

/**
 * 在浏览器中应用颜色
 */
export function applyBrowserColor(text: string, color: string): [string, string] {
  if (!color) return [text, '']
  return [`%c${text}`, `color: ${color}; font-weight: bold;`]
}

/**
 * 跨平台颜色应用函数
 */
export function applyColor(text: string, color: string): string | [string, string] {
  if (isBrowser) {
    return applyBrowserColor(text, color)
  } else {
    return applyNodeColor(text, color)
  }
}
