/**
 * 项目识别号（Workspace.key）与缺陷/用例编号规范。
 *
 * 前后端共用的单一事实源（见 CONTEXT.md 缺陷域 · #104）：
 * - 识别号：大写英数、以字母开头、2-10 位；一旦有编号引用即冻结
 * - 缺陷编号：`{key}-BUG-{seq}`；用例编号：`{key}-TC-{seq}`
 * - 序号（seq）为项目内独立自增、不回收；缺陷与用例是两套独立 counter
 */
import { z } from 'zod'

/** 识别号字符规则：以大写字母开头，后接 1-9 位大写字母或数字（总长 2-10）。 */
export const WORKSPACE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

export const workspaceKeySchema = z.string().regex(WORKSPACE_KEY_PATTERN, {
  message: '项目识别号必须为 2-10 位大写英文/数字，且以字母开头'
})

export function isValidWorkspaceKey(value: string): boolean {
  return WORKSPACE_KEY_PATTERN.test(value)
}

/** 缺陷编号：{识别号}-BUG-{seq}。渲染时拼接，不落库。 */
export function formatBugCode(workspaceKey: string, seq: number): string {
  return `${workspaceKey}-BUG-${seq}`
}

/** 用例编号：{识别号}-TC-{seq}。存量随迁移回填，新建自动取号。 */
export function formatTestCaseCode(workspaceKey: string, seq: number): string {
  return `${workspaceKey}-TC-${seq}`
}
