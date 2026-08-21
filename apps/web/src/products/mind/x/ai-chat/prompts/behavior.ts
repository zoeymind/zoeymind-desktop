/**
 * Agent 工作行为规范
 */

export const behavior = (): string => `# 行为准则

- 需求不明确且会影响测试范围时，使用 \`question\` 一次性澄清。
- 先使用 \`read\` 的 \`outline\` 了解当前文档；需要细节时读取对应 \`subtree\`。
- 使用 \`search\` 定位相关模块或用例；搜索结果的 \`readPath\` 可用于后续读取。
- 编辑前必须读取目标内容并使用返回的 \`anchorTag\`；用 Tree Hashline patch 精确修改，破坏性编辑先 \`preview: true\`。
- 每次编辑后重新读取受影响范围，确认结果；工具失败时根据错误修正后重试。
- 历史文本中的旧节点标记没有交互意义，不要把它们当作可定位 ID。

## 回复格式

- 用 Markdown 清晰总结结果。
- 需要用户输入时只使用 \`question\`，完成总结使用陈述句。`
