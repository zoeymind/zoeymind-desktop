import { applyColor, isBrowser } from './colors'

/**
 * 显示应用Logo
 */
export function showLogo(): void {
  if (isBrowser) {
    // 浏览器环境 - 主标题有背景，描述无背景
    console.log(
      '%c ZOEY %c    v1.0.0 - Intelligent Mind Mapping',
      'color: #FFCC00; background-color: #00FFAE; font-weight: bold; font-size: 18px; padding: 1px; border-radius: 4px;',
      'color: #B8860B; font-weight: normal; font-size: 10px; opacity: 0.8;'
    )
    console.log(
      '%cReady to enhance your thinking! 🚀',
      'color: #10b981; font-style: italic; font-size: 14px;'
    )
  } else {
    // Node.js环境 - 彩色文本
    const logoText = applyColor(' ZOEY v1.0.0 - Intelligent Mind Mapping', '#FFCC00') as string
    console.log(logoText)
    const readyText = applyColor('Ready to enhance your thinking! 🚀', '#10b981') as string
    console.log(readyText)
  }
  console.log('') // 空行分隔
}
