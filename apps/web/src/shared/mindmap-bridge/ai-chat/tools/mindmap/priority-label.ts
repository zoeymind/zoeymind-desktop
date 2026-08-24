/**
 * 测试用例优先级工具函数
 */

export type Priority = 1 | 2 | 3

/**
 * 从icon数组中提取优先级
 * @param icons - 节点icon数组
 * @returns 优先级 (1, 2, 或 3)，默认为 2
 */
export function extractPriorityFromIcons(icons?: string[]): Priority {
  if (!icons || !Array.isArray(icons)) return 2

  const priorityIcon = icons.find(icon => icon.startsWith("priority_"))
  if (!priorityIcon) return 2

  const match = priorityIcon.match(/^priority_([1-3])$/)
  if (match) {
    return parseInt(match[1]) as Priority
  }

  return 2
}

/**
 * 从文本中解析优先级并移除优先级前缀
 * 格式: [P1]用例文本 或 P1用例文本
 * [0] 会被转换为优先级 1
 * @param text - 用例文本
 * @returns { priority, cleanText }
 */
export function parsePriorityFromText(text: string): {
  priority?: Priority
  cleanText: string
} {
  // 先匹配有效的优先级格式 [P1]、[P2]、[P3] 或 P1、P2、P3
  const priorityMatch = text.match(/^\[?P([1-3])\]?\s*(.*)/)
  if (priorityMatch) {
    return {
      priority: parseInt(priorityMatch[1]) as Priority,
      cleanText: priorityMatch[2],
    }
  }

  // 匹配 [0] 格式，转换为优先级 1
  const zeroMatch = text.match(/^\[0\]\s*(.*)/)
  if (zeroMatch) {
    return {
      priority: 1,
      cleanText: zeroMatch[1],
    }
  }

  return { cleanText: text }
}

/**
 * 生成优先级icon数组
 * @param priority - 优先级
 * @returns icon数组（仅 priority_* 图标，用例节点只需此图标即可标识）
 */
export function createPriorityIcons(priority: Priority = 2): string[] {
  return [`priority_${priority}`]
}
