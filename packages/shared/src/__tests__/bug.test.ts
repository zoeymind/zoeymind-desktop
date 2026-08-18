import { describe, it, expect } from 'vitest'
import {
  BUG_STATUS_TRANSITIONS,
  findBugTransition,
  BUG_STATUSES,
  type BugStatus
} from '../data/bug'

describe('缺陷状态机（以原型为准，见 #104）', () => {
  it('每个状态都有至少一个合法转移（不存在"无流转"状态）', () => {
    for (const status of BUG_STATUSES) {
      expect(BUG_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0)
    }
  })

  it('NEW/IN_PROGRESS/SUSPENDED/REJECTED 均可直接 CLOSED（允许跳流程关闭）', () => {
    const direct: BugStatus[] = ['NEW', 'IN_PROGRESS', 'SUSPENDED', 'REJECTED']
    for (const from of direct) {
      expect(findBugTransition(from, 'CLOSED')).toMatchObject({ to: 'CLOSED' })
    }
  })

  it('RESOLVED→IN_PROGRESS（打回）计入 reopenCount', () => {
    const t = findBugTransition('RESOLVED', 'IN_PROGRESS')
    expect(t?.countsAsReopen).toBe(true)
    expect(t?.permission).toBe('reopen')
  })

  it('CLOSED→IN_PROGRESS（重开）计入 reopenCount', () => {
    const t = findBugTransition('CLOSED', 'IN_PROGRESS')
    expect(t?.countsAsReopen).toBe(true)
    expect(t?.permission).toBe('reopen')
  })

  it('其余合法转移不计入 reopenCount', () => {
    expect(findBugTransition('NEW', 'IN_PROGRESS')?.countsAsReopen).toBeUndefined()
    expect(findBugTransition('IN_PROGRESS', 'RESOLVED')?.countsAsReopen).toBeUndefined()
    expect(findBugTransition('NEW', 'CLOSED')?.countsAsReopen).toBeUndefined()
  })

  it('RESOLVED 不能直接回 NEW（打回目标态是 IN_PROGRESS，不是 NEW）', () => {
    expect(findBugTransition('RESOLVED', 'NEW')).toBeUndefined()
  })

  it('CLOSED 是终态之一，但仍可重开到 IN_PROGRESS，不能到其它状态', () => {
    expect(BUG_STATUS_TRANSITIONS.CLOSED).toHaveLength(1)
    expect(BUG_STATUS_TRANSITIONS.CLOSED[0].to).toBe('IN_PROGRESS')
  })

  it('非法转移（如 NEW→RESOLVED 跳过处理中）返回 undefined', () => {
    expect(findBugTransition('NEW', 'RESOLVED')).toBeUndefined()
  })

  it('resolve 权限位类别只出现在 IN_PROGRESS→RESOLVED', () => {
    for (const status of BUG_STATUSES) {
      const resolveTransitions = BUG_STATUS_TRANSITIONS[status].filter(
        t => t.permission === 'resolve'
      )
      if (status === 'IN_PROGRESS') {
        expect(resolveTransitions).toHaveLength(1)
        expect(resolveTransitions[0].to).toBe('RESOLVED')
      } else {
        expect(resolveTransitions).toHaveLength(0)
      }
    }
  })
})
