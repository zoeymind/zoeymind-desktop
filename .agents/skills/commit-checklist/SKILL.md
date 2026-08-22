---
name: commit-checklist
description: 提交前审视 commit 内容, 按 checklist 拦截敏感 leak、仓库规范违反、重复设计、过度设计、UI 冗余文案、领域不变式破坏、缺失用户确认. 每一项缺一不可. 触发词 "commit / 提交 / push / 推 / 审视 / 走一下 checklist".
---

# Commit Checklist

## 为什么

本仓库是公开开源仓 (Apache License 2.0). **任何 commit 都会永久进入公开 git history**——一次 leak 或一次坏设计都追不回来 (git history 不删).

本 skill 不是"跑几条 grep 就完事", 是**七道门**, **每道必过, 缺一不可**:
A leak → B 仓库规范 → C 重复/过度设计 → D UI 文案 → E 领域不变式 → F 质量门 → G 用户明确 `我确认`.

## Process

### 1. 全景 —— staged 内容清单

```bash
git status --short
git diff --cached --stat
git diff --cached | head -200
```

### 2. Checklist (7 道门, 缺一不可)

#### A. 硬编码敏感值 (**零容忍**)

```bash
git diff --cached | grep -iE "sk-[a-z0-9]{20,}|Bearer [a-zA-Z0-9]{20,}|-----BEGIN (PRIVATE|RSA|EC).*KEY|api[_-]?key.*[=:].{16,}" || echo "✓ 无硬编码 secret"
git diff --cached | grep -E "^\+" | grep -iE "客户名|rate.card|定价|付费|竞品|护城|内部规划" || echo "✓ 无内部策略"
```

命中 → 立即 `git reset` + 挪 env / `.env.local` (gitignored) / 改写.

#### B. 仓库规范符合度 (**必过**)

针对 staged 的所有 `.ts` / `.tsx` / `.rs` 逐条对照 [`AGENTS.md`](../../../AGENTS.md).

**UI 组件与色系** (最容易踩):

- **组件**: 引 `@zoeymind/ui`; 不引 `@radix-ui/*`; 不引第二个组件库; 缺组件 → 补进 `packages/ui`, 不在业务代码里私造
- **图标**: `lucide-react`, 不用 emoji, 不用 inline SVG
- **颜色 token**: `bg-background` / `text-foreground` / `text-muted-foreground` / `border-border` / `bg-destructive`; 不硬编码 hex / `bg-white` / `bg-gray-*`
- **圆角**: `rounded-{sm,md,lg,xl}`; 不硬编码 px
- **深色元素的陷阱**: `bg-gray-{700,800,900}` + `text-white` 换 token 时**不能**变成 `bg-muted text-white`（muted 是 light token, text-white 会看不见）; 正确是 `bg-foreground text-background`
- **方向边框**: `border-l-*` / `border-t-*` / `border-r-*` / `border-b-*` / `border-x-*` / `border-y-*` 带颜色时同样按 token 映射, 别只顾 `border-*`
- **主题细节**: 遵循 skill `make-interfaces-feel-better` — 同心圆角、`tabular-nums`、`text-balance` / `text-pretty`、按钮 `active:scale-[0.98]`、图片加 1px `outline` inside border

**文案与国际化**:

- 用户可见字符串一律走 `t("key")`, 新增 key `zh-CN` + `en-US` **成对**加, 不能只加一边
- 单位、次数、进度用 `tabular-nums`
- 后端返回 / native 错误信息用 `ErrorCode` + `createAppError`, 不裸抛字符串

**类型与日志**:

- 不用 `any` / `@ts-ignore`; 用 `unknown` + narrowing
- 不用 `console.*`; 一律 `@zoeymind/logger`
- 业务枚举用 `as const` 对象, 不散布字符串字面量

**Tab / 会话生命周期** (踩过):

- Tab 隐藏用 `visibility` + `pointer-events` + `aria-hidden` + `inert`, **不用** `display:none` / `hidden` (否则布局尺寸测量失效)
- 一个 ProjectSessionStore 归一个 pane 拥有, 不加 `tabInstances` / `tabDirty` 之类全局镜像
- Zustand selector 的 action / snapshot 引用要稳定, 否则 `useSyncExternalStore` 会一直重渲染

**Tauri / native 边界**:

- Tauri command 参数与返回类型两端一致; Rust `serde::{Serialize, Deserialize}` derive 齐; 前端 `invoke<T>` 有明确类型标注
- 修 `src-tauri/**/*.rs` / `tauri.conf.json` / `capabilities/**` / `Cargo.toml` / `.env` → **告诉用户"这次要重启 tauri:dev"**, agent 不自跑
- Broker 只监听 `127.0.0.1`, 从不监听公网端口; 每次启动新 token
- 外部 CLI/MCP **不接触**编辑审查令牌、node/document UID、Broker token
- 外部工具 read 与破坏性 edit 是**独立开关**, default-deny

**依赖去重** (踩过):

- 加 identity-sensitive runtime lib (ProseMirror / Tiptap / Yjs) 时先 `pnpm why <pkg>`, 多版本必须在 `pnpm-workspace.yaml` `overrides` 钉死 + `vite-config` `resolve.dedupe` 加入

命中 → 改到符合. 无法立即改 → 拆 commit, message 写明 `技术债: XXX`.

#### C. 重复设计 / 过度设计 (**必过**)

**重复设计** (存在同类实现却新造轮子):

- 提交里新增的 hook / util / 组件, 先在 `@zoeymind/ui` / `apps/web/src/shared/**` / `apps/web/src/products/**` 里搜过一遍?
- 触发 skill `prefer-existing-solutions` — 新库 / 新做法先 Context7 查官方 + grep 现有实现对比, 别凭记忆造
- 触发 skill `reuse-ui-components` — 前端加任何 UI 前先搜通用组件, 表单 / 表格 / 弹框 / 头像 / 列表 / 菜单 / toast 都已有
- 新增 store / context / provider, 与现有 `useAppVersion` / `useSettingsDialog` / `useTabStore` 模式对齐
- 新增 Tauri command, `src-tauri/src/**` 里有没有已能覆盖的 API?

**过度设计** (加了没必要的抽象):

- 只有一个 caller 的 hook / util / helper → inline
- 只有一个实现的 interface / abstract class → 用具体类型
- factory / builder / strategy 只服务当前一个 use case → 删
- config 项只有一种取值 → 删
- 抽象名字很泛 (`Manager` / `Handler` / `Helper` / `Utils` / `Service` 无具体后缀) → 抽象没找到语义
- 加 shim / adapter / wrapper 只为绕开某个上游函数签名, 而不是隔离领域边界 → 直接改上游

**深模块原则** (Ousterhout): 抽象的收益要大于隐藏的成本. 命中 → **删抽象、合并、inline**; 到需要第二个 use case 时再抽.

#### D. UI 文案 / dev 想法泄漏成用户可见文本 (**必过**)

**症状**: 把内部实现的心路历程 / 保护性提示 / dev 自我表达写进了 UI 用户会看到的地方 (button 标签 / dialog description / toast body / tooltip / empty state 文案).

**判据**: 假想一个第一次用产品的测试工程师看到这段文字, 5 秒读完, 明白该干什么就 OK; 读完还要想"这在跟我解释啥"就不 OK.

**坏例子**:

- ❌ "由于系统还在检测更新, 请稍等片刻, 我们会尽快为您呈现最新的信息 (通常需要 3-5 秒)"
- ❌ 按钮 "点击我以确认这次操作会不可逆地将数据保存到本地磁盘并同步索引"
- ❌ Tooltip 复述这个页面 30 秒前的代码注释块
- ❌ 首次运行弹一个自家 dialog 复述 macOS Gatekeeper 步骤 (用户已经点过放行才看到 dialog)
- ❌ 应用内更新提示复述 SmartScreen 是什么 (系统级 UX 不复述)

**好例子**:

- ✅ "检查中…"
- ✅ 按钮 "保存"
- ✅ Tooltip 一句话说清这个按钮**干什么**, 不解释**为什么**
- ✅ 分类 release notes: `✨ Features` / `🐛 Fixes` / …

**产品定位口径**: ZoeyMind 是**功能测试用例编辑器**, 不用 "通用思维导图" / "知识管理" 描述. 用 "完全本地 / BYOK AI / XMind × MeterSphere 双向流通" 三条差异化.

命中 → 精简到"用户操作需要知道的那一句", 内部设计意图挪去代码注释 / commit body / issue.

#### E. 领域不变式 / 生命周期契约 (**必过**)

对照 [AGENTS.md § Ubiquitous Language / Invariants](../../../AGENTS.md#ubiquitous-language) 逐条:

- 恢复快照永远不是正式项目; 恢复文档首次保存**必须** Save As
- 只有原子写入 + 项目索引登记均成功后, 恢复文档才能晋升正式项目并清恢复快照
- 文档标签 / 文档会话不能被表述为独立 renderer / 独立进程 (当前架构不成立)
- 不承诺严格标签故障隔离 (单 WebView 架构无法承诺)
- Tree Hashline Patch 是 Portal 唯一编辑 wire format; atomic, 串行, 单 undo, 等 renderer 收敛
- App lifecycle: 用户手动 `pnpm tauri:dev`, agent 不启动 / 不重启; 需要重启 → **说出来让用户点**, 不代跑

改动违反上述任一 → 停手、跟用户对齐意图、要么改回、要么先改 AGENTS.md.

#### F. 无关文件 + 质量门 (**必过**)

**无关文件**:

```bash
git status --short | grep -E "^\?\?"
```

新加的 untracked / 首次 add 的文件是否**都是本次改动需要的**? 是否混进本地缓存 (`.DS_Store` / `dist/`) / IDE 私人配置 / 临时脚本 / 别的分支带过来的意外改动?

**质量门**:

- `pnpm --filter @zoeymind-desktop/web typecheck` 绿 (hook 不跑 typecheck, agent 必须自己跑)
- 相关模块 `pnpm test` 绿 (改到什么跑什么, 不必每次全套)
- Commit message 至少一行中文正文; 描述"做了什么 + 为什么"; 挂关联 `#N` (若有); 不承诺未来功能
- 无与本次任务无关的顺手改动 (拆独立 commit)

> **注**: eslint + prettier 由 `.husky/pre-commit` 里的 lint-staged 自动跑 (`prettier --write` + `eslint --fix`), 不需要 agent 在 checklist 里手动跑; hook 会拦 lint 失败.

### 3. 未通过怎么办

| 情况 | 处理 |
|---|---|
| 敏感字眼 | `git reset <file>` + 改写 + 重 `git add` |
| 敏感块混在 M 里 | `git add -p <file>` 交互式挑合规行 |
| 敏感块 + 其他改动混合 | 拆两次 commit, 敏感块留后 (或永不 commit) |
| 规范违反 | 改到符合再 stage; 无法立即改 → 拆独立 commit + `技术债` message |
| 重复 / 过度设计 | 删抽象 / 合并 / inline, 别硬着头皮提 |
| UI 冗余文案 | 精简, 内部想法挪到注释 / commit body |
| 领域不变式破坏 | 停手 + 跟用户对齐 + 改回或先改 AGENTS.md |
| 无关文件 | 加 gitignore 或 `git rm --cached` |
| 质量门失败 | 修到绿再来 |

### 4. G. 用户明确确认 (**最后一道, 必过, 缺一不可**)

前 6 道全绿后, **agent 不主动 commit**. 必须等到用户在对话里精确说出**「我确认」** 这三个字才能提交. **只有精确匹配算通过**——`"好的"` / `"嗯"` / `"ok"` / `"行"` / `"可以"` / `"确认一下"` / `"我确定"` 都不算. 关键字与 `.husky/pre-commit` 的机器兜底完全对齐 (交互式终端也会向用户读一次 `我确认`, 非交互式必须显式设 `USER_CONFIRMED=1`).

`USER_CONFIRMED=1` 只在 A~F 全绿 + G 精确"我确认"通过时才用. 缺一不用.

```bash
USER_CONFIRMED=1 git commit -m "<message>"
git push origin main
```

Desktop 的 husky `pre-commit` 会检查 `USER_CONFIRMED=1`, 缺失就拦下. G 是逻辑兜底, hook 是机器兜底; 两者共用同一个关键字「我确认」.

## 触发本 skill 的规则

用户说 "commit / 提交 / push / 推 / 审视 / 走一下 checklist" 时先跑本 skill, 而**不是**直接 `git commit`.

**默认姿态**: 除非用户明确 opt-out ("跳过 checklist"), 每次 commit 前都跑一遍. A~G 七道门缺一不可.
