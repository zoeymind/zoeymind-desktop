/**
 * 浏览器实例 ID 管理
 * 用于区分同一用户的不同浏览器实例
 */

const BROWSER_INSTANCE_KEY = 'browser_instance_id'

/**
 * 生成浏览器实例 ID
 */
function generateBrowserInstanceId(): string {
  return `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取或创建浏览器实例 ID
 */
export function getBrowserInstanceId(): string {
  let instanceId = sessionStorage.getItem(BROWSER_INSTANCE_KEY)

  if (!instanceId) {
    instanceId = generateBrowserInstanceId()
    sessionStorage.setItem(BROWSER_INSTANCE_KEY, instanceId)
  }

  return instanceId
}

/**
 * 清除浏览器实例 ID（通常在用户登出时调用）
 */
export function clearBrowserInstanceId(): void {
  sessionStorage.removeItem(BROWSER_INSTANCE_KEY)
}
