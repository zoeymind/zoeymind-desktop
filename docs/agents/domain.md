# Domain Docs

Engineering skills 探索 codebase 时，应如何消费这个 repo 的 domain documentation。

## Before exploring, read these

- repo 根目录的 **[`CONTEXT.md`](../../CONTEXT.md)** — 稳定领域词汇 (正式项目 / 恢复快照 / 文档标签 / 故障域 / Invariants / 架构文档索引)。
- **[`docs/architecture/`](../architecture/)** — 具体架构决策与调研 (文档标签故障隔离、文档自动化 Portal)。ADR 尚未按 `docs/adr/` 索引编号，作为 Architecture Records 存放在同一目录。

如果这些文件对当前话题不适用，**静默继续**。不要标记缺失；不要提前建议创建。producer skill (`/grill-with-docs`) 会在 terms 或 decisions 实际被解决时懒创建它们。

## File structure

Single-context repo (Desktop 是一个产品仓):

```
apps/desktop/
├── CONTEXT.md                            ← 稳定领域词汇
├── AGENTS.md                             ← 开发规范 · Agent Boundaries
├── docs/
│   ├── architecture/
│   │   ├── document-automation-portal.md
│   │   └── tab-fault-isolation.md
│   └── agents/
│       ├── issue-tracker.md
│       ├── triage-labels.md
│       └── domain.md
└── ...
```

## Use the glossary's vocabulary

当你的输出命名某个 domain concept 时 (issue title、refactor proposal、hypothesis、test name)，使用 `CONTEXT.md` 中定义的 term。不要漂移到 glossary 明确避免的 synonyms。

例:
- 用 "正式项目 (Formal Project)" 而不是 "已保存文档"
- 用 "恢复文档 (Recovered Document)" 而不是 "从备份恢复的东西"
- 用 "文档标签 (Document Tab)" 而不是 "打开的窗口"

如果你需要的概念还不在 glossary 中，这是一个信号：要么你正在发明项目没有使用的语言 (重新考虑)，要么确实存在缺口 (为 `/grill-with-docs` 记录)。

## Flag architecture doc conflicts

如果你的输出与现有 `docs/architecture/*.md` 的结论矛盾，明确指出，而不是静默覆盖：

> _与 `tab-fault-isolation.md` 结论 (当前单 WebView 架构不承诺严格标签故障隔离) 矛盾 — 但值得重开讨论因为…_
