/**
 * 构建完整的 System Prompt
 *
 * 顺序策略：技术参考在前，行为约束在后（Recency Bias — 越靠后的内容 AI 越容易遵守）
 */

import { role } from "./role"
import { behavior } from "./behavior"
import { generationStrategy } from "./generation-strategy"
import { testcaseWriting } from "./testcase-writing"
import { a2uiProtocol } from "./ask-user-guide"

/**
 * 生成完整的 System Prompt
 *
 * 顺序：身份 → 数据协议 → 生成策略 → 编写规范 → 行为准则（越靠后越优先）
 */
export function buildSystemPrompt(): string {
  return `
${role()}


${a2uiProtocol()}

---

${generationStrategy()}

---

${testcaseWriting()}

---

${behavior()}
`.trim()
}
