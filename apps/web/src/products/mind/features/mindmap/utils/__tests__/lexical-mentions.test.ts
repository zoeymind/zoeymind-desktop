/**
 * lexical-mentions 序列化/反序列化往返测试。
 *
 * 核心契约：编辑器内容序列化出的纯文本必须与下游解析的 @[name](id) 格式一致，
 * 且能把同样的标记还原回 mention 节点（pill）。用真实 Lexical headless 编辑器验证。
 */

import { describe, it, expect } from 'vitest'
import { createEditor, $getRoot, $createParagraphNode, $isParagraphNode } from 'lexical'
import { BeautifulMentionNode, $isBeautifulMentionNode } from 'lexical-beautiful-mentions'
import { $createNodesFromMarkup, $serializeToMarkup } from '../lexical-mentions'

/** 在 headless 编辑器里渲染 markup 后再序列化回来 */
function roundTrip(markup: string): string {
  const editor = createEditor({
    namespace: 'test',
    nodes: [BeautifulMentionNode],
    onError: e => {
      throw e
    }
  })
  let result = ''
  editor.update(
    () => {
      const root = $getRoot()
      root.clear()
      const paragraph = $createParagraphNode()
      paragraph.append(...$createNodesFromMarkup(markup))
      root.append(paragraph)
    },
    { discrete: true }
  )
  editor.getEditorState().read(() => {
    result = $serializeToMarkup()
  })
  return result
}

/** 统计渲染后段落里的 mention 节点数量 */
function countMentions(markup: string): number {
  const editor = createEditor({
    namespace: 'test',
    nodes: [BeautifulMentionNode],
    onError: e => {
      throw e
    }
  })
  let count = 0
  editor.update(
    () => {
      const root = $getRoot()
      root.clear()
      const paragraph = $createParagraphNode()
      paragraph.append(...$createNodesFromMarkup(markup))
      root.append(paragraph)
    },
    { discrete: true }
  )
  editor.getEditorState().read(() => {
    const paragraph = $getRoot().getFirstChild()
    if (paragraph && $isParagraphNode(paragraph)) {
      for (const child of paragraph.getChildren()) {
        if ($isBeautifulMentionNode(child)) count++
      }
    }
  })
  return count
}

describe('lexical-mentions round-trip', () => {
  it('纯文本无 mention 时原样往返', () => {
    expect(roundTrip('请帮我生成用例')).toBe('请帮我生成用例')
  })

  it('单个 @[name](id) 往返保持格式', () => {
    const input = '请参考 @[登录模块](n1) 的实现'
    expect(roundTrip(input)).toBe(input)
    expect(countMentions(input)).toBe(1)
  })

  it('多个 mention 往返保持格式', () => {
    const input = '使用 @[登录](n1) 和 @[注册](n2)'
    expect(roundTrip(input)).toBe(input)
    expect(countMentions(input)).toBe(2)
  })

  it('模块名包含空格时仍正确还原为单个 pill', () => {
    const input = '@[用户 登录 模块](uid-abc) 校验'
    expect(roundTrip(input)).toBe(input)
    expect(countMentions(input)).toBe(1)
  })

  it('mention 在句首句尾都能往返', () => {
    const input = '@[开头](a) 中间文字 @[结尾](b)'
    expect(roundTrip(input)).toBe(input)
    expect(countMentions(input)).toBe(2)
  })

  it('空字符串往返为空', () => {
    expect(roundTrip('')).toBe('')
  })
})
