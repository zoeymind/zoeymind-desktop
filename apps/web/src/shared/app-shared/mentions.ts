/**
 * @-mentions & ZTDL 提及处理 —— 桌面端。
 *
 * 与源仓 apps/zoeymind/apps/web/src/shared/app-shared/mentions/ 对齐:
 *  - buildMentionHtml         构建带 class 编码的 <span> HTML
 *  - processMentions          ZTDL "M:id「name」" -> HTML span (found / unrecognized)
 *  - convertAtMentionToZTDL   编辑器输出 @[name](id) -> ZTDL 供发送/渲染
 *  - stripMentionsForCodeBlock 剥离 HTML span + ZTDL 转纯文本 (代码块用)
 *  - extractNodeIdFromClass   从 span class 提回 node id
 *
 * MessageView 走 ReactMarkdown + rehypeRaw, 把 processMentions 产出的 span
 * 交给自定义 `span` component 渲染成可点击标签.
 */

import { i18next } from "@zoeymind/i18n"

/** 消息里 @提及的通用样式类名 (供输入框 pill 复用) */
export const mentionClassName = "rounded bg-primary/15 text-primary text-m"
export const getMentionMessageClassName = () => mentionClassName

/* ------------------------------------------------------------------ */
/* 正则                                                                */
/* ------------------------------------------------------------------ */

// M:xxx 「name」 / +M:xxx / -C:xxx 等; name 可选
export const ZTDL_MENTION_REGEX = /([+\-~>=!]?)([MC]):([^\s:「」<>]+)\s*(?:「([^」]*)」)?/g

// 内联代码里的 ZTDL: `M:xxx` -> 剥掉反引号让主 regex 命中
export const INLINE_CODE_ZTDL_REGEX = /`([+\-~>=!]*[MC]:[^\s:`]+)`/g

// 老的 data-node-id span, 兼容旧消息
export const LEGACY_MENTION_SPAN_REGEX =
  /<span\s+class="mention-tag"\s+data-node-id="([^"]+)"\s*>\s*([^<]+)\s*<\/span>/g

export const CLASS_MENTION_SPAN_REGEX =
  /<span\s+class="([^"]*\bmention-tag\b[^"]*)"\s*>\s*([^<]+)\s*<\/span>/g

export const ESCAPED_ZTDL_REGEX = /\\([+\-~>=!]?)([MC]):([^\s:「」<>]+)\s*(?:「([^」]*)」)?/g

/* ------------------------------------------------------------------ */
/* buildMentionHtml                                                    */
/* ------------------------------------------------------------------ */

/**
 * 将 mention 编码为 HTML span:
 *   class="mention-tag nid-<id> ztdl-<status> ztdl-<M|C> [ztdl-p1|p2|p3]"
 *
 * react-markdown v9+ 不透传 data-* 属性, 所有元数据编码到 class.
 */
export const buildMentionHtml = (
  displayText: string,
  nodeId: string,
  status: "found" | "notfound" | "unrecognized" = "found",
  nodeType = "",
  priority?: number
): string => {
  const safeText = displayText
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
  const safeId = nodeId.trim().replace(/"/g, "&quot;")
  const classes = ["mention-tag", `nid-${safeId}`, `ztdl-${status}`]
  if (nodeType) classes.push(`ztdl-${nodeType}`)
  if (priority && priority >= 1 && priority <= 3) classes.push(`ztdl-p${priority}`)
  return `<span class="${classes.join(" ")}">${safeText}</span>`
}

/** 从 span className 提回 node id (支持任意非空 id, 与 SessionIdMapper 一致) */
export const extractNodeIdFromClass = (className: string): string | null => {
  const match = className.match(/\bnid-(\S+)/)
  return match ? match[1] : null
}

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export interface MindMapNode {
  data?: {
    uid?: string
    text?: string
    icon?: string[]
  }
}

export interface MentionProcessorOptions {
  /** 短 id -> 真 UUID; 传不到就原样 */
  resolveShortId?: (id: string) => string
  /** 用 uuid 找 mindmap 节点; 找不到就走 unrecognized 分支 */
  findNode?: (id: string) => MindMapNode | null
  /** 兼容旧接口: 直接传节点数组 */
  nodes?: MindMapNode[]
}

/* ------------------------------------------------------------------ */
/* processMentions                                                     */
/* ------------------------------------------------------------------ */

/**
 * 把 ZTDL `M:id「name」` / `C:id「name」` 转成 mention-tag <span>.
 * 类似 markdown 图片: id 有效 -> 蓝可点击, id 无效 -> 灰不可点击.
 */
export function processMentions(content: string, options: MentionProcessorOptions = {}): string {
  const { resolveShortId = id => id, findNode, nodes } = options

  const lookup =
    findNode ?? (nodes ? (id: string) => nodes.find(n => n.data?.uid === id) ?? null : undefined)

  return content.replace(
    ZTDL_MENTION_REGEX,
    (_match, prefix = "", nodeType = "", rawId = "", rawName = "") => {
      if (!rawId) return _match

      const resolvedId = resolveShortId(rawId)
      const node = lookup?.(resolvedId) ?? null
      const typeLabel =
        nodeType === "M" ? i18next.t("common.mentionModule") : i18next.t("common.mentionCase")

      if (node) {
        const nodeText = (node.data?.text || "").replace(/\[P\d\]/g, "").trim()
        const displayText = nodeText || rawName || `${typeLabel}(${rawId})`
        const fullUid = node.data?.uid || resolvedId

        let priority: number | undefined
        if (nodeType === "C") {
          const icons: string[] = node.data?.icon || []
          const priorityIcon = icons.find((i: string) => i.startsWith("priority_"))
          if (priorityIcon) {
            const p = parseInt(priorityIcon.replace("priority_", ""), 10)
            if (p >= 1 && p <= 3) priority = p
          }
        }

        // 末尾空格避免 markdown 把紧邻字符并进 span
        return `${prefix}${buildMentionHtml(displayText, fullUid, "found", nodeType, priority)} `
      }

      // 节点找不到 -> 灰色
      const trimmedName = (rawName as string)?.trim() || ""
      let priority: number | undefined
      const priorityMatch = trimmedName.match(/^\[P([1-3])\]/)
      if (priorityMatch) priority = parseInt(priorityMatch[1], 10)
      const nameWithoutPriority = trimmedName.replace(/^\[P[1-3]\]/, "").trim()
      const displayText = nameWithoutPriority || `${typeLabel}(${rawId})`
      return `${prefix}${buildMentionHtml(displayText, resolvedId, "unrecognized", nodeType, priority)} `
    }
  )
}

/** 编辑器输出 `@[name](id)` -> ZTDL `M:id「name」` (发送前预处理 UserMessage) */
export function convertAtMentionToZTDL(content: string): string {
  return content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, id) => {
    if (id === "" || id === undefined) return `@${text}`
    return `M:${id}「${text}」`
  })
}

/**
 * 代码块里剥离 mention, 保留纯文本:
 *   1. mention-tag span -> 内部文字
 *   2. ZTDL M:id / +M:id「name」 -> 前缀+name (name 存在) 或 前缀
 */
export function stripMentionsForCodeBlock(content: string): string {
  return content
    .replace(/<span\s+class="[^"]*\bmention-tag\b[^"]*"[^>]*>([^<]+)<\/span>/g, "$1")
    .replace(
      /([+\-~>=!]?)\s*[MC]:[^\s:「」<>]+(?:\s*「([^」]*)」)?/g,
      (_match, prefix, name) => prefix + (name || "")
    )
}
