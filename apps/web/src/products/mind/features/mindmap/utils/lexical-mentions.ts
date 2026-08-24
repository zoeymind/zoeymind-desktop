/**
 * Lexical 编辑器与 @[name](id) 文本标记之间的序列化/反序列化。
 *
 * 输入框对外（onChange / value）始终使用与下游一致的纯文本标记：
 *   @[模块名称](节点ID)
 * 下游消费方（useAIChatV2Store 的 ZTDL 转换、UserMessage 渲染、
 * getMentionedNodesData 解析）都依赖该格式，迁移到 Lexical 后必须保持不变。
 */

import { $createTextNode, $getRoot, $isParagraphNode, type LexicalNode } from "lexical"
import { $createBeautifulMentionNode, $isBeautifulMentionNode } from "lexical-beautiful-mentions"

/** mention 触发符 */
export const MENTION_TRIGGER = "@"

/** 匹配 @[name](id) 标记，与 useAIChatV2Store / UserMessage 的解析正则保持一致 */
const MENTION_MARKUP_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g

/** 编辑器内 mention 节点 data 中存放节点 id 的键 */
export const MENTION_DATA_ID_KEY = "id"

/** 建议菜单项：value 为显示名称，id 为思维导图节点 id */
export interface MentionSuggestion {
  value: string
  id: string
}

/**
 * 将一段可能含 @[name](id) 标记的文本，拆成文本/ mention 交替的 Lexical 节点列表。
 * 用于把外部传入的 value（纯文本标记）还原为带 pill 的编辑器内容。
 */
export function $createNodesFromMarkup(text: string): LexicalNode[] {
  const nodes: LexicalNode[] = []
  let lastIndex = 0
  // 每次调用重置 lastIndex（正则带 g 标志）
  MENTION_MARKUP_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MENTION_MARKUP_REGEX.exec(text)) !== null) {
    const [full, name, id] = match
    if (match.index > lastIndex) {
      nodes.push($createTextNode(text.slice(lastIndex, match.index)))
    }
    nodes.push($createBeautifulMentionNode(MENTION_TRIGGER, name, { [MENTION_DATA_ID_KEY]: id }))
    lastIndex = match.index + full.length
  }
  if (lastIndex < text.length) {
    nodes.push($createTextNode(text.slice(lastIndex)))
  }
  return nodes
}

/**
 * 序列化当前编辑器内容为 @[name](id) 纯文本标记。
 * 段落之间用 \n 连接；mention 节点输出 @[value](data.id)，其余文本原样输出。
 * 必须在 editor.read() / editor.getEditorState().read() 回调内调用。
 */
export function $serializeToMarkup(): string {
  const root = $getRoot()
  const blocks: string[] = []
  for (const child of root.getChildren()) {
    if ($isParagraphNode(child)) {
      let line = ""
      for (const node of child.getChildren()) {
        if ($isBeautifulMentionNode(node)) {
          const value = node.getValue()
          const data = node.getData()
          const id = data?.[MENTION_DATA_ID_KEY]
          line += id != null ? `@[${value}](${String(id)})` : `${MENTION_TRIGGER}${value}`
        } else {
          line += node.getTextContent()
        }
      }
      blocks.push(line)
    } else {
      blocks.push(child.getTextContent())
    }
  }
  return blocks.join("\n")
}
