# ZoeyMind Desktop

> 让 `apps/desktop/` 可作为独立开发目录使用。

## Repository facts

- Remote: `git@github.com:zoeymind/zoeymind-desktop.git`
- Branch: `main`，直接推送；无 PR 流程
- Maintainer: GitHub [`chacelow`](https://github.com/chacelow) · npm [`caishilong`](https://www.npmjs.com/~caishilong)

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
