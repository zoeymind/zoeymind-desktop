# ZoeyMind Desktop

> 让 `apps/desktop/` 可作为独立开发目录使用。

## Repository facts

- Remote: `git@github.com:zoeymind/zoeymind-desktop.git`
- Branch: `main`，直接推送；无 PR 流程
- Maintainer: GitHub [`chacelow`](https://github.com/chacelow) · npm [`caishilong`](https://www.npmjs.com/~caishilong)

## Working with this repo

### Tech stack

- **Native**: Tauri 2 + Rust 1.77（`src-tauri/`）
- **Web**: React 19 + Vite 6 + TypeScript 5（`apps/web/`）
- **CLI/MCP**: Node 22 + tsup（`apps/cli/`、`apps/mcp/`）
- **Workspace**: pnpm 10（`pnpm-workspace.yaml`）

### App lifecycle（重要）

**用户手动启动应用**，并在开发全程保持运行观察热更新。Agent **不启动、不重启**应用。

- 用户已经在跑 `pnpm tauri:dev`，边改边看边测；Vite HMR + Tauri reload 会自动生效
- Agent 改完 web/TS 代码 → 用户桌面上会自动刷新，Agent 假定"新代码已经在跑"进行下一步（询问 / 请用户测 / 读日志）
- **例外**：改动确实需要重启才能生效（改 `src-tauri/**/*.rs`、`src-tauri/tauri.conf.json`、`src-tauri/capabilities/**`、`Cargo.toml` 依赖、`.env`、原生 plugin 注册）→ **明确告知用户"这次要重启 tauri:dev"**，不要自己跑
- 类型 / 单测这类无副作用的可以直接跑，不需要用户配合

### Common commands

**Agent 可直接跑**（无副作用）：

- `pnpm --filter @zoeymind-desktop/web typecheck` — 仅类型（最快信号）
- `pnpm --filter @zoeymind-desktop/web test` — vitest 一次跑完
- `pnpm --filter @zoeymind-desktop/web exec eslint <files>` — 单文件 lint
- `pnpm release <version>` — 一次 bump 全部版本 + CHANGELOG + tag（见 [Release tooling](#release-tooling)）

**只给用户参考，Agent 不主动跑**：

- `pnpm tauri:dev` — 起 dev 应用（用户全程手动持有）
- `pnpm --filter @zoeymind-desktop/web dev` — 只跑 web 端
- `pnpm tauri:build` — 本地打包

### Boundaries

- ✅ **Always** — UI 组件从 `@zoeymind/ui` 引；提交前 lint-staged 自动跑 prettier + eslint --fix；跨文件重命名走 `lsp rename`；改完假定用户桌面上已经热更新
- ⚠️ **Ask first** — 改 `src-tauri/tauri.conf.json`；动 `packages/ui/src/` 的组件公共 API；新增 npm 依赖；改 `.github/workflows/`；**任何需要用户重启 tauri:dev 的改动**
- 🚫 **Never** — 提交任何 secrets / token / API key；把 CI 改成 push 就 publish；把商业价格 / 客户信息内联进源码或注释；**自启动、自重启、自杀 `pnpm tauri:dev` / 应用进程**

### Commit confirmation (per-commit, not per-session)

`.husky/pre-commit` 每次 commit 都拦一次确认门. 非交互式 (agent / CI /
脚本) 提交必须显式携带:

```
USER_CONFIRM_HASH=$(git write-tree) git commit -m "..."
```

这个 SHA 绑定到"当前这一次 commit"的具体 staged 内容. 换一次 commit,
staged 变了, SHA 也变, agent 必须重新拿到用户新一次「我确认」并重新
计算; 复用旧值到新 commit 会被 hook 拒绝.

边界:

1. 用户必须在**本次 commit 上下文**里显式说出「我确认」三个字, 才能设置.
2. **每一次 commit 都需要独立的「我确认」**. Session 里更早的确认不能
   滚动复用到后续 commit. Batch commit / amend / rebase 每次都算新
   commit, 各自需要新确认.
3. 「提交吧」/「commit 一下」/「加一下」/「push 吧」等隐含语气都不算.
   必须是原文包含「我确认」这三个字.
4. 违规示例:
   - 用户在 commit A 说「我确认」, agent 顺手把 commit B 也 `USER_CONFIRM_HASH=...` — 违规
   - 用户说「提交吧」但没说「我确认」, agent `USER_CONFIRM_HASH=...` — 违规
5. 所有 non-interactive 通过都写审计日志 `.git/commit-audit.log`
   (含时间、branch、staged tree SHA、staged 文件列表), 用户可以事后
   grep 检查 agent 是否越权.

## Product positioning

ZoeyMind Desktop 是**面向测试人员的功能测试用例编辑器**，不是通用思维导图工具。围绕三条差异化设计与描述：

1. **完全本地化**：`.zmind` 存本机任意路径，无云、无账号、不注册、不登录，用例数据永不出本机
2. **AI 完全 BYOK**：用户自己的 OpenAI / Anthropic / Gemini / Ollama Key，ZoeyMind 不代理、不转发、不缓存
3. **XMind × MeterSphere 双向流通**：导入团队现有 `.xmind`（含 MeterSphere 味），导出 MeterSphere 用例 XMind

副作用：文案、README、website、release notes 中不用「通用思维导图」「知识管理」等词描述本产品。

## npm ecosystem

两个 npm 包，都从本仓 `apps/{cli,mcp}` 构建发布：

| Package | Bin | 作用 |
| --- | --- | --- |
| [`@zoeymind/cli`](https://www.npmjs.com/package/@zoeymind/cli) | `zoeymind` | 脚本 / 本地工具驱动 Desktop |
| [`@zoeymind/mcp`](https://www.npmjs.com/package/@zoeymind/mcp) | `zoeymind-mcp` | stdio MCP server，暴露 Desktop 给外部 Agent |

MCP host 配置 key 统一为 `zoeymind`。外部工具（Claude Code / OMP / Codex / OpenCode）通过 authenticated loopback 连接，每次启动新 token，从不监听公网端口。

## Signing posture

不购买 Apple / Microsoft 代码签名证书。用户遇到 macOS Gatekeeper「无法确认开发者」或 Windows SmartScreen「Windows 已保护你的电脑」属于**正常预期行为，不是 bug**。放行姿势写在 [`README.md`](./README.md) 「首次运行」段。

应用内 **不** 复述系统级 UX（用户已点过放行才能看到应用内 dialog，复述属噪音）。dev 端本质工作是把 Tauri Updater 的加密签名产物在 4 平台上全部产出并写进 `latest.json`。

## Release tooling

- `pnpm release <version>`（`scripts/release.mjs`）：一次 bump `apps/cli/package.json` + `apps/mcp/package.json` + `src-tauri/Cargo.toml` + `apps/mcp/src/server.ts` PACKAGE_VERSION + 重写 CHANGELOG `## Unreleased` 段，本地跑校验，commit + tag
- `scripts/build-updater-manifest.mjs`：从 `release-assets/` 扫 4 平台 `.app.tar.gz` / `.AppImage.tar.gz` / `.nsis.zip` + 对应 `.sig`，生成 `latest.json`
- `scripts/validate-updater-manifest.mjs`：pre-flight 校验 manifest 完整性
- `scripts/generate-release-notes.mjs`：从 GitHub compare API 拉两版本间 commit，按 conventional commits 前缀分类写回 Release body

详细验收命令见 [`RELEASE.md`](./RELEASE.md)。

## Version stream

v0.3.0 是首个公开版本。后续走 SemVer。

## Release contract

The user operates releases by intent, not by GitHub mechanics.

### Ordinary development

- The user normally commits and pushes directly to `main`; business PRs are not required.
- Every push runs CI only.
- A normal push MUST NOT publish a GitHub Release, build public installers, or create a user-visible update.
- Do not ask the user to adopt Conventional Commit keywords. Use an appropriate commit message when committing on their behalf.

### Explicit release intent

Phrases such as `发布版本`, `发一个新版本`, `提交所有然后发 0.2`, or `把当前版本发出去` explicitly authorize an end-to-end release.

The agent MUST:

1. Review all current changes in this repository and run the commit checklist.
2. Finish required validation, commit all approved changes, and push `main`.
3. Treat the pushed `origin/main` HEAD as the release commit unless the user names another commit.
4. Normalize shorthand versions (`0.2` means `0.2.0`). If no version is given, choose the next sensible SemVer version from the changes and existing releases.
5. Trigger `.github/workflows/release.yml` with the normalized version and the chosen commit SHA. The workflow creates the tag and Draft Release, injects the version only into the Tauri build, builds all platforms, and publishes atomically.
6. Verify Windows x64, macOS ARM64, macOS Intel, Linux AppImage, Linux DEB, and `SHA256SUMS.txt` on the published GitHub Release.
7. If builds succeeded but checksum/upload/publication failed, use the workflow's artifact recovery input instead of rebuilding.
8. Report the published tag, URL, assets, and any signing or update-distribution limitations.

The agent MUST NOT ask the user to create tags, modify source-controlled version files, manually trigger Actions, or choose internal recovery inputs. Those are implementation details.

### Release lifecycle

- Source-controlled development versions remain `0.0.0`; release versions are workflow inputs injected at build time.
- A Draft GitHub Release should exist only while an explicitly requested release is being assembled or recovered.
- Normal release inputs are `version` and `release-ref`; the latter may name a stable commit, branch, or tag and defaults to `main`.
- `artifact-run-id` and `release-tag` are recovery-only inputs for reusing successful installers after a final-stage failure.

## Domain glossary

稳定领域词汇（正式项目 / 恢复快照 / 文档标签 / 故障域 / Invariants 等）与架构文档索引住 [`CONTEXT.md`](./CONTEXT.md)。做领域相关改动 (`.zmind` 生命周期 / 文档标签隔离 / Portal 编辑协议) 前先读它。

## Agent skills

### Issue tracker

GitHub Issues (`zoeymind/zoeymind-desktop`), 用 `gh` CLI 驱动. 详见 [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

采用 5 个 canonical triage roles (`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`), label string 与 role name 一致. 详见 [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context repo: root `CONTEXT.md` (稳定领域词汇) + `docs/architecture/*.md` (架构决策). 详见 [`docs/agents/domain.md`](./docs/agents/domain.md).
