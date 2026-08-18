/**
 * @-mentions 工具 —— 桌面端简版。
 *
 * 产品仓的实现支持 mindmap 节点跨引用，桌面端保留最小 API 表面（Regex 剥离 + no-op 处理），
 * 因为编辑器 MentionEditor 组件被搬进来时会 import 这几个名字。桌面端不接跨引用，
 * 直接按纯文本输出。
 */

export interface MindMapNode {
  uid: string
  text: string
}

export interface MentionProcessorOptions {
  nodes?: MindMapNode[]
}

/**
 * 去除 mention 语法（`@[label](nodeId)` 之类），保留纯文本；给 CodeBlock 之类
 * 需要纯文本的 renderer 使用。
 */
export function stripMentionsForCodeBlock(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '$1')
}

/** 处理 mention —— 桌面端只做去 mention 语法的等价处理，不注入节点上下文。 */
export function processMentions(text: string, _opts?: MentionProcessorOptions): string {
  return stripMentionsForCodeBlock(text)
}
