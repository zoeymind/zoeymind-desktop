---
name: claude-handoff
description: 为 Claude Code 创建交接摘要。
disable-model-invocation: true
---

把当前对话压缩成一份 handoff summary，供 Claude Code 在新 session 中继续。

生成一个 Markdown 文件，并要求用户用描述性 `--name` 打开 Claude handoff。Summary 应包含目标、已完成工作、关键文件、未解决问题、验证状态和下一步。
