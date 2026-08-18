import { describe, it, expect } from 'vitest'
import {
  processMentions,
  convertAtMentionToZTDL,
  stripMentionsForCodeBlock,
  type MindMapNode
} from '@/shared/app-shared'

describe('mentions-processor', () => {
  describe('convertAtMentionToZTDL', () => {
    it('should convert @[name](id) to M:id「name」', () => {
      const input = '请参考 @[登录模块](n1) 的实现'
      const output = convertAtMentionToZTDL(input)
      expect(output).toBe('请参考 M:n1「登录模块」 的实现')
    })

    it('should handle empty id', () => {
      const input = '@[未知]()'
      const output = convertAtMentionToZTDL(input)
      expect(output).toBe('@[未知]()')
    })

    it('should handle multiple mentions', () => {
      const input = '使用 @[登录](n1) 和 @[注册](n2)'
      const output = convertAtMentionToZTDL(input)
      expect(output).toBe('使用 M:n1「登录」 和 M:n2「注册」')
    })

    it('should handle special characters in name', () => {
      const input = '@[<script>](n1)'
      const output = convertAtMentionToZTDL(input)
      expect(output).toBe('M:n1「<script>」')
    })
  })

  describe('processMentions', () => {
    const mockFindNode = (uid: string): MindMapNode => ({
      data: { text: '登录模块', uid }
    })

    it('should render found node as clickable span', () => {
      const input = 'M:n1「登录模块」'
      const output = processMentions(input, {
        findNode: mockFindNode,
        resolveShortId: id => id
      })
      expect(output).toContain('<span class="mention-tag nid-n1 ztdl-found ztdl-M">')
      expect(output).toContain('登录模块</span>')
      expect(output).not.toContain('&lt;span')
    })

    it('should render unrecognized node as gray span', () => {
      const input = 'M:n999「不存在」'
      const output = processMentions(input, {
        findNode: () => null,
        resolveShortId: id => id
      })
      expect(output).toContain('ztdl-unrecognized')
    })

    it('should handle case with priority', () => {
      const input = 'C:c2「[P2]手机号输入」'
      const output = processMentions(input, {
        findNode: () => ({
          data: {
            text: '手机号输入',
            uid: 'uuid-c2',
            icon: ['priority_2']
          }
        }),
        resolveShortId: id => id
      })
      expect(output).toContain('ztdl-p2')
    })

    it('should handle operation prefix', () => {
      const input = '+M:n1「新模块」'
      const output = processMentions(input, {
        findNode: mockFindNode,
        resolveShortId: id => id
      })
      expect(output).toMatch(/^\+<span/)
    })

    it('should resolve short ID', () => {
      const input = 'M:n1「模块」'
      const output = processMentions(input, {
        findNode: mockFindNode,
        resolveShortId: id => (id === 'n1' ? 'uuid-123' : id)
      })
      expect(output).toContain('nid-uuid-123')
    })

    it('should handle case with empty name', () => {
      const input = 'M:n1'
      const output = processMentions(input, {
        findNode: mockFindNode,
        resolveShortId: id => id
      })
      expect(output).toContain('ztdl-found')
    })

    it('should escape special characters in display text', () => {
      const input = 'M:n1「<script>」'
      const output = processMentions(input, {
        findNode: () => ({ data: { text: '<script>', uid: 'n1' } }),
        resolveShortId: id => id
      })
      expect(output).toContain('&lt;script&gt;')
    })

    it('should handle multiple mentions in one text', () => {
      const input = '使用 M:n1「登录」和 C:c2「注册」'
      const output = processMentions(input, {
        findNode: id => ({
          data: { text: id === 'n1' ? '登录' : '注册', uid: id }
        }),
        resolveShortId: id => id
      })
      expect(output).toContain('ztdl-M')
      expect(output).toContain('ztdl-C')
    })
  })

  describe('stripMentionsForCodeBlock', () => {
    it('should remove HTML mention and keep text', () => {
      const input = '<span class="mention-tag nid-n1">登录模块</span>'
      const output = stripMentionsForCodeBlock(input)
      expect(output).toBe('登录模块')
    })

    it('should remove ZTDL mention and keep name', () => {
      const input = 'M:n1「登录模块」'
      const output = stripMentionsForCodeBlock(input)
      expect(output).toBe('登录模块')
    })

    it('should preserve operation prefix', () => {
      const input = '+M:n1「模块」'
      const output = stripMentionsForCodeBlock(input)
      expect(output).toBe('+模块')
    })

    it('should handle mixed content', () => {
      const input = 'const foo = <span class="mention-tag nid-n1">模块</span> + M:n2「另一个」'
      const output = stripMentionsForCodeBlock(input)
      expect(output).toBe('const foo = 模块 +另一个')
    })

    it('should handle code with priority', () => {
      const input = 'C:c1「[P1]用例」'
      const output = stripMentionsForCodeBlock(input)
      expect(output).toBe('[P1]用例')
    })

    it('should handle mentions without name', () => {
      const input = 'M:n1'
      const output = stripMentionsForCodeBlock(input)
      expect(output).toBe('')
    })
  })
})
