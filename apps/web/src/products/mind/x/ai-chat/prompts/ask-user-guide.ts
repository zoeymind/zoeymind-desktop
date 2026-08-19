/**
 * question 工具使用指南
 *
 * 当 Agent 需要向用户提问时，使用 question 工具。
 * 前端会自动生成交互式 UI。
 *
 * ⚠️ 重要规则：
 * - 最后总结不能存在疑问句，必须使用 question 工具提问
 * - 禁止在文本总结中提问，必须调用此工具
 */

export const questionGuide = (): string => `# question 工具使用指南

当需要用户补充信息时，调用 \`question\` 工具。

## ⚡ 批量提问（推荐）

支持一次性提交多个问题，用户可以在问题之间切换 Tab。

\`\`\`typescript
{
  "questions": [
    {
      "header": "测试环境",
      "question": "请选择测试环境",
      "options": [
        {"label": "开发环境", "description": "用于本地开发测试"},
        {"label": "测试环境", "description": "用于 QA 测试"},
        {"label": "生产环境", "description": "用于正式环境"}
      ],
      "multiple": false
    },
    {
      "header": "测试类型",
      "question": "选择需要测试的功能（可多选）",
      "options": [
        {"label": "功能测试", "description": "验证功能正确性"},
        {"label": "性能测试", "description": "验证响应时间和吞吐量"}
      ],
      "multiple": true
    }
  ],
  "allowSkip": true
}
\`\`\`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| questions | array | ✅ | 问题数组（支持批量提交） |
| questions[].header | string | ❌ | 问题标题/分类（最长30字符，用于 Tab 显示） |
| questions[].question | string | ✅ | 问题文本（完整的问题） |
| questions[].options | array | ❌ | 选项列表（有选项则为选择题） |
| questions[].options[].label | string | ✅ | 选项文本（1-5个词，简短） |
| questions[].options[].description | string | ❌ | 选项说明 |
| questions[].multiple | boolean | ❌ | 是否多选（默认 false，单选） |
| questions[].placeholder | string | ❌ | 输入框占位符（文本输入时使用） |
| allowSkip | boolean | ❌ | 是否显示跳过按钮（默认 false） |

## 常见用法

### 单选问题

\`\`\`typescript
{
  "questions": [
    {
      "header": "优先级",
      "question": "请选择测试优先级",
      "options": [
        {"label": "P1（高）"},
        {"label": "P2（中）"},
        {"label": "P3（低）"}
      ]
    }
  ]
}
\`\`\`

### 多选问题

\`\`\`typescript
{
  "questions": [
    {
      "header": "测试范围",
      "question": "选择需要测试的功能（可多选）",
      "options": [
        {"label": "功能测试"},
        {"label": "性能测试"},
        {"label": "安全测试"}
      ],
      "multiple": true
    }
  ]
}
\`\`\`

### 文本输入

\`\`\`typescript
{
  "questions": [
    {
      "header": "模块名称",
      "question": "请输入模块名称",
      "placeholder": "例如：登录模块"
    }
  ]
}
\`\`\`

### 批量提问

\`\`\`typescript
{
  "questions": [
    {
      "header": "测试环境",
      "question": "请选择测试环境",
      "options": [{"label": "开发环境"}, {"label": "测试环境"}]
    },
    {
      "header": "优先级",
      "question": "请选择测试优先级",
      "options": [{"label": "P1"}, {"label": "P2"}, {"label": "P3"}]
    }
  ],
  "allowSkip": true
}
\`\`\`

## ⚠️ 重要规则

1. **禁止在文本总结中提问**：所有需要用户回答的问题必须使用 question 工具
2. **最后总结不能存在疑问句**：回复用户时必须使用陈述句，不能使用问句
3. **如需用户确认**：必须调用 question 工具，不能在文本中提问
`

export const a2uiProtocol = questionGuide
