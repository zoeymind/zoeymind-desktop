// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import { cn } from '@/shared/app-shared'

/**
 * mention 标签的唯一样式常量。
 *
 * 编辑态（MentionEditor 的 pill）与只读态（ReactMarkdown 渲染的 span）
 * 共用这一份，保证两种状态下字号、底色、内距完全一致。
 */
export const MENTION_PILL_CLASS = cn(
  'rounded',
  'bg-primary/15',
  'text-primary',
  'px-0.5',
  'text-xs'
)

/**
 * 将 @mention 转换为可点击的 HTML 片段
 *
 * 所有元数据编码到 class 中（react-markdown v9+ 不传 data-* 属性）。
 *
 * class 格式：mention-tag nid-{nodeId} [ztdl-found|ztdl-notfound] [ztdl-M|ztdl-C] [ztdl-p1|ztdl-p2|ztdl-p3]
 *
 * @param status - 'found' 节点存在可点击 | 'notfound' 节点已删除不可点击 | 'unrecognized' 未识别节点
 * @param priority - 用例优先级（1/2/3），模块不传
 */
export const buildMentionHtml = (
  displayText: string,
  nodeId: string,
  status: 'found' | 'notfound' | 'unrecognized' = 'found',
  nodeType = '',
  priority?: number
): string => {
  // ✅ 对文本内容进行 HTML 转义（防止 XSS）
  const safeText = displayText
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const safeId = nodeId.trim().replace(/"/g, '&quot;')
  const classes = ['mention-tag', `nid-${safeId}`, `ztdl-${status}`]
  if (nodeType) classes.push(`ztdl-${nodeType}`)
  if (priority && priority >= 1 && priority <= 3) classes.push(`ztdl-p${priority}`)
  // ✅ 返回真实 HTML，不进行额外编码
  return `<span class="${classes.join(' ')}">${safeText}</span>`
}

/**
 * 从 className 中提取 nodeId（nid-xxx 格式）
 */
export const extractNodeIdFromClass = (className: string): string | null => {
  // 支持 nid-{任意ID} 格式（不含空格的字符串）
  const match = className.match(/\bnid-(\S+)/)
  return match ? match[1] : null
}
