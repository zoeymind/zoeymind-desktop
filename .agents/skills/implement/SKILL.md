---
name: implement
description: '基于 spec 或 tickets 实现一段工作. 开工前先加载仓库 AGENTS.md, 避免和 skill 通用做法冲突.'
disable-model-invocation: true
---

实现用户在 spec 或 tickets 中描述的工作.

## 0. 开工前: 加载仓库规范 (**必读, 非可选**)

> 项目 AGENTS.md 优先于本 skill、优先于任何通用 skill. 冲突时以仓库 AGENTS.md 为准.

- 读根 `AGENTS.md` (含 Working with this repo · Boundaries · Ubiquitous Language)
- 涉及领域概念 (Formal Project / Recovery Snapshot / Document Tab / Failure Domain 等) 读 AGENTS.md 的 `## Ubiquitous Language` 段
- 涉及具体架构决策读 `docs/architecture/*.md`

### 按工作类型主动加载

| 工作类型 | 必读 |
|---|---|
| **前端 UI** (表单/表格/弹框/头像/列表/菜单/toast/…) | skill `reuse-ui-components` — 先搜 `@zoeymind/ui` 里的通用组件, 绝不重复造轮子 |
| **文档自动化 / Portal / Broker** | `docs/architecture/document-automation-portal.md` |
| **文档标签 / 恢复 / 故障隔离** | `docs/architecture/tab-fault-isolation.md` + AGENTS.md Invariants |
| **用户可见文案** | i18n: zh/en 成对走 `t()`; 新增 key 两个 locale 同步加 |
| **选型 / 设计 / "这库支不支持 X" / "现有实现是否落后"** | **Context7 必调** (`xd://mcp__context_resolve_library_id` → `xd://mcp__context_query_docs`) + skill `prefer-existing-solutions`; grep 现有实现对比 |
| **发版 / 版本 / CHANGELOG** | AGENTS.md 的 `## Release tooling` 段 + `RELEASE.md` |
| **应用启停** | AGENTS.md 的 `### App lifecycle` — Agent 不启动 / 不重启应用 |

### 红线 (NEVER) — 摘 AGENTS.md 主线

- 不用 `any` / `@ts-ignore`; 用 `unknown` + 收窄
- 不用 `console.*`; 一律 `@zoeymind/logger`
- 不硬编码颜色 (用 Tailwind token `bg-primary` / `text-muted-foreground` 等); 不用 emoji 当图标 (`lucide-react`)
- 不硬编码用户可见文案; 走 `t()` + zh/en 成对
- 不自建已有组件/脚本/类型; 先搜后建 (`@zoeymind/ui` / `apps/web/src/shared/**`)
- 不用字符串字面量表示业务枚举; 定义 `as const` 常量对象引用
- 选型 / 库能力问题不凭记忆答; Context7 必调
- 不自启动 / 自重启 `pnpm tauri:dev` (用户手动持有)

## 1. 实现

尽可能在预先认可的 seams 上使用 skill `tdd`.

先小步跑通再优化:

- 每完成一个逻辑单元跑一次 `pnpm --filter @zoeymind-desktop/web typecheck` (对应包)
- 跑受影响的**单个测试文件** (`vitest run <path>`), 而不是整套
- 长测试套件放最后
- 前端改动到点用户会在桌面上看到 HMR 结果 (agent 不需要自启动应用); 需要交互验证时请用户点

## 2. 提交前: `commit-checklist`

- 本仓 Apache-2.0 公开开源, **不能出现商业策略 / 客户 / 定价 / 内部规划**类字眼
- 走 skill `commit-checklist`: A 硬编码 secret (零容忍) · B 内部策略字眼 · C 无关文件 · D commit msg · E 质量门 (typecheck + lint + 相关 test)
- 通过后 `USER_CONFIRMED=1 git commit -m "..."`

## 3. 完成后: `code-review`

使用 skill `code-review` 对本次工作做一遍自审.

## 4. 交付

- 全测试套件在最后跑一次 (`pnpm test` 或对应包)
- 提交到**当前 branch** (不新建分支, 除非用户明说)
- 不 push (除非用户明说)

---

**核心**: 这个 skill 的价值不是给你新方法, 而是提醒你**先把仓库 AGENTS.md 读一遍再动手** — 项目宪法永远优先于任何通用 skill 的默认做法.
