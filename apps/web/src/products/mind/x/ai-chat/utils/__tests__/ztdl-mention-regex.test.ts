import {
  CLASS_MENTION_SPAN_REGEX,
  INLINE_CODE_ZTDL_REGEX,
  LEGACY_MENTION_SPAN_REGEX,
  ZTDL_MENTION_REGEX
} from '../../../ai-chat/utils/ztdl-mention-regex'
import { describe, it, expect } from 'vitest'

describe('ZTDL mention regex', () => {
  it('matches UUID mention with name', () => {
    const text = 'M:53e7d113-c077-4460-abf7-a01321fab603「登录页面」'
    const match = ZTDL_MENTION_REGEX.exec(text)
    expect(match?.[2]).toBe('M')
    expect(match?.[3]).toBe('53e7d113-c077-4460-abf7-a01321fab603')
    expect(match?.[4]).toBe('登录页面')
  })

  it('matches short id mention n1', () => {
    const text = 'C:n8「[P2]手机号输入框-输入超长字符」'
    ZTDL_MENTION_REGEX.lastIndex = 0
    const match = ZTDL_MENTION_REGEX.exec(text)
    expect(match?.[2]).toBe('C')
    expect(match?.[3]).toBe('n8')
    expect(match?.[4]).toBe('[P2]手机号输入框-输入超长字符')
  })

  it('matches prefixed diff mention', () => {
    const text = '+M:n2「验证码输入框」> M:n1「登录页面」'
    ZTDL_MENTION_REGEX.lastIndex = 0
    const all = [...text.matchAll(ZTDL_MENTION_REGEX)]
    expect(all).toHaveLength(2)
    expect(all[0][1]).toBe('+')
    expect(all[0][3]).toBe('n2')
    expect(all[1][3]).toBe('n1')
  })

  it('unescapes inline code mention', () => {
    const text = '这里是 `M:n1「登录页面」` 引用'
    const out = text.replace(INLINE_CODE_ZTDL_REGEX, '$1')
    expect(out).toBe('这里是 M:n1「登录页面」 引用')
  })

  it('converts legacy span mention', () => {
    const html = '<span class="mention-tag" data-node-id="n1">登录页面</span>'
    const out = html.replace(LEGACY_MENTION_SPAN_REGEX, (_m, nodeId, name) => {
      return `M:${nodeId}「${name}」`
    })
    expect(out).toBe('M:n1「登录页面」')
  })

  it('converts class mention span', () => {
    const html = '<span class="mention-tag nid-n2 ztdl-found ztdl-M">验证码输入框（新名称）</span>'
    const match = CLASS_MENTION_SPAN_REGEX.exec(html)
    expect(match?.[1]).toContain('mention-tag')
    expect(match?.[1]).toContain('nid-n2')
    expect(match?.[2]).toBe('验证码输入框（新名称）')
  })
})
