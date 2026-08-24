/**
 * 时间格式化工具
 */
import { i18next } from "@zoeymind/i18n"

/**
 * 格式化相对时间标签
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < day) {
    return i18next.t("mindmap.aiChat.dateGroup.today")
  } else if (diff < 2 * day) {
    return i18next.t("mindmap.aiChat.dateGroup.yesterday")
  } else if (diff < 7 * day) {
    return i18next.t("mindmap.aiChat.dateGroup.last7Days")
  } else if (diff < 30 * day) {
    return i18next.t("mindmap.aiChat.dateGroup.last30Days")
  } else {
    return i18next.t("mindmap.aiChat.dateGroup.earlier")
  }
}

/**
 * 从消息内容提取对话标题
 */
export function getConversationTitle(content: string): string {
  // 取前50个字符作为标题
  if (content.length > 50) {
    return `${content.slice(0, 50)}...`
  }
  return content
}
