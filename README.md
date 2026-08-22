<p align="center">
  <img src=".github/assets/logo.svg" alt="ZoeyMind" width="180" />
</p>

<h1 align="center">ZoeyMind Desktop</h1>

<p align="center">
  本地优先的思维导图工作站 · 内置 AI Agent · 支持外部自动化
</p>

<p align="center">
  <a href="https://github.com/zoeymind/zoeymind-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/zoeymind/zoeymind-desktop?display_name=tag&sort=semver" alt="Latest release"></a>
  <a href="https://www.npmjs.com/package/@zoeymind/cli"><img src="https://img.shields.io/npm/v/@zoeymind/cli?label=%40zoeymind%2Fcli" alt="npm @zoeymind/cli"></a>
  <a href="https://www.npmjs.com/package/@zoeymind/mcp"><img src="https://img.shields.io/npm/v/@zoeymind/mcp?label=%40zoeymind%2Fmcp" alt="npm @zoeymind/mcp"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg" alt="License"></a>
  <a href="https://github.com/zoeymind/zoeymind-desktop/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/zoeymind/zoeymind-desktop/ci.yml?label=CI" alt="CI"></a>
  <a href="https://github.com/zoeymind/zoeymind-desktop/stargazers"><img src="https://img.shields.io/github/stars/zoeymind/zoeymind-desktop?style=flat" alt="GitHub stars"></a>
</p>

<hr />

ZoeyMind 是一款基于 Tauri 2 + React 19 的本地优先思维导图应用，运行在 macOS / Windows / Linux。它把「文档编辑器」、「AI 工作台」和「Agent 自动化」合并成同一个应用：

- 📄 **本地 `.zmind` 文档**，用户完全掌控存储位置，配套崩溃恢复与外部修改检测；
- 🧠 **内置 Mind AI Agent**，模型直接读写当前打开的思维导图；
- 🔌 **外部 Agent 自动化**（`@zoeymind/cli` / `@zoeymind/mcp`），共享同一个 Document Portal 内核；
- 🎨 **完整的编辑体验**：多标签、多层级、样式、图片、公式、Markdown、导入导出；
- 🛡 **默认关闭外部访问**，全部通信走本地 loopback + 每次启动新 token。

## 目录

- [产品能力](#产品能力)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [AI 工作台](#ai-工作台)
- [外部自动化](#外部自动化)
- [架构概览](#架构概览)
- [开发指南](#开发指南)
- [版本与发布](#版本与发布)
- [反馈与安全](#反馈与安全)
- [技术栈](#技术栈)
- [License](#license)

## 产品能力

### 编辑器

- 完整思维导图编辑：节点增删改、多层级、结构切换、快捷键；
- 富文本节点、图标、图片、附件、超链接、备注；
- 数学公式（KaTeX）、Markdown、代码块；
- 撤销/重做、拖拽、批量选择、按级别对齐；
- 大文档高性能模式（自动降级渲染）；
- 主题预设 + 深浅色模式，可自定义配色；
- 中英文双语界面。

### 文件与项目

- 原生 `.zmind` 文件格式，可打开任意路径的文档；
- 多标签并行编辑，每个 tab 一个独立 `ProjectSession`；
- Dirty / 已保存 / 冲突 三态生命周期；
- 磁盘冲突提示：外部工具修改时提供 reload / 保存副本 / 覆盖；
- 崩溃恢复：意外关闭时保留未提交内容，下次启动可选择性恢复；
- 文件关联：双击 `.zmind` 直接打开对应文档；
- 单实例：重复启动会激活已有窗口而不是开新进程；
- 最近项目、文件夹分组。

### 系统集成

- 全平台安装包：macOS `.dmg`（Intel + Apple Silicon）、Windows `.exe`（NSIS）、Linux `.AppImage` / `.deb`；
- 自动更新：走 Tauri Updater，macOS Apple Silicon 走签名 `.app.tar.gz`；
- 系统菜单本地化，支持 macOS 原生 traffic light 与 Windows overlay title bar；
- 日志系统：级别可动态调整，目录可自定义，自动按周清理。

### AI 工作台

- 内置 **Mind AI Agent**，通过 tool call 直接读写当前思维导图；
- 支持流式响应、可中断、可续跑、消息滚动惯性；
- Agent 侧渲染上限保护，大响应不卡 UI；
- 多模型 Provider：OpenAI / OpenAI 兼容 / Anthropic / Gemini / Ollama；
- 可选 **编辑审查（Case Review）**：Agent 提交编辑前进入人机双确认；
- 外挂 **MCP Client**：Desktop 内自己作为 MCP Host 引入其他 MCP server；
- 会话历史、跨窗口一致的运行状态。

### 外部自动化

- **`@zoeymind/cli`**：命令 `zoeymind`，脚本或本地工具调用 Desktop；
- **`@zoeymind/mcp`**：命令 `zoeymind-mcp`，把 Desktop 暴露给 Claude Code / OMP / Codex / OpenCode 等 MCP Host；
- 唯一 wire format：Tree Hashline Patch + read anchor；
- 默认关闭；在偏好设置中显式启用；**破坏性编辑**权限独立开关，默认也是关闭；
- 通信走认证过的本地 loopback HTTP，Bearer token 每次 Desktop 启动重新生成。

## 快速开始

### 桌面应用

前往 [GitHub Releases](https://github.com/zoeymind/zoeymind-desktop/releases/latest) 下载对应平台安装包：

| 平台                  | 安装包                               |
| --------------------- | ------------------------------------ |
| macOS (Apple Silicon) | `ZoeyMind_<version>_aarch64.dmg`     |
| macOS (Intel)         | `ZoeyMind_<version>_x64.dmg`         |
| Windows x64           | `ZoeyMind_<version>_x64-setup.exe`   |
| Linux (Debian/Ubuntu) | `zoey-mind_<version>_amd64.deb`      |
| Linux (AppImage)      | `zoey-mind_<version>_amd64.AppImage` |

- macOS 首次打开 `.dmg` 需要在 **系统设置 → 隐私与安全性** 允许运行；
- Windows 首次运行可能弹 SmartScreen 需要"仍要运行"。

### 命令行 / MCP

```bash
npm install --global @zoeymind/cli   # 提供 zoeymind
npm install --global @zoeymind/mcp   # 提供 zoeymind-mcp
```

按需 `npx`：

```bash
npx --yes --package @zoeymind/cli@0.3.0 zoeymind projects
```

### 打开首个思维导图

1. 启动 ZoeyMind Desktop；
2. 从起始页选择「新建导图」或双击一个 `.zmind` 文件；
3. 在中央画布用 <kbd>Tab</kbd> / <kbd>Enter</kbd> 添加子节点 / 同级节点；
4. <kbd>Cmd/Ctrl</kbd> + <kbd>S</kbd> 保存到磁盘。

### 唤起内置 AI

1. 右侧 AI 面板选择你已配置的 Provider 与 Model；
2. 输入自然语言诉求；
3. Agent 会先读当前导图（`query_current_mindmap`）再产出补丁（`edit_current_mindmap`）；
4. 如果开启了「编辑审查」，编辑提交前会先弹出差异确认。

### 让外部 Agent 操作导图

1. 在 **偏好设置 → 外部自动化** 打开「允许外部自动化」；
2. 需要 Agent 能改文档时，同时打开「允许破坏性编辑」；
3. 从 CLI 直接调用：

   ```bash
   zoeymind projects
   zoeymind query_current_mindmap '{"mode":"outline","maxLines":200}'
   ```

4. 或在 MCP Host（Claude Code / OMP / Codex / OpenCode）里配置：

   ```json
   {
     "mcpServers": {
       "zoeymind": {
         "command": "zoeymind-mcp",
         "args": []
       }
     }
   }
   ```

## 核心概念

- **`.zmind` 文档**：单文件项目容器，保存节点树 + 布局 + 样式，用户可放到任何目录。
- **`ProjectSession`**：每个打开的 tab 一个 session，是当前导图的唯一 in-memory 事实源。
- **Document Portal**：域内核，统一负责结构投影、结构化搜索、read anchor、Tree Hashline patch 应用、事务与撤销边界、渲染收敛。内置 AI、CLI、MCP 全部走它。
- **Local Broker**：Rust 侧的认证 loopback HTTP 服务，把外部请求转成 Portal 调用。默认关闭。
- **Read Anchor**：Portal 返回 view 时同时返回锚点，编辑必须携带；文档变动后旧 anchor 过期，Portal 会明确拒绝。
- **Tree Hashline Patch**：唯一编辑 wire format。基于行号 + 缩进层级的补丁描述，可原子化多操作提交。
- **编辑审查**：内置 AI 编辑前的可选人机确认闸口，与「外部破坏性编辑」授权彼此独立。

## AI 工作台

内置 Mind AI Agent 只暴露三个模型可见工具：

```text
query_current_mindmap  只读，取 outline / subtree / 结构化 search
edit_current_mindmap   destructive，携带 anchor + Tree Hashline patch
question               让用户回答一个明确问题
```

模型看不到内部文档 ID、节点 UID、编辑审查 token 等内部标识。

Provider 配置在 **设置 → AI Models**，支持：

- **OpenAI** / OpenAI 兼容（Groq、Together、DeepSeek、Kimi 等）；
- **Anthropic**；
- **Google Gemini**；
- **Ollama**（本地模型）。

Chat 侧特性：

- 流式渲染 + 可中断（<kbd>Esc</kbd> 或 UI 按钮）；
- 中断后可续跑同一会话；
- Message scroller 支持鼠标滚轮惯性、跨嵌套滚动区透穿；
- Token/状态指示、工具卡片折叠；
- 全部对话历史落 SQLite；
- 编辑审查开关：`ai-case-review-enabled`。

MCP Client 面板允许 Desktop 自己作为 MCP Host，接入外部 MCP server（文件系统、代码搜索等）；与本仓 `@zoeymind/mcp` 不冲突。

## 外部自动化

外部 CLI / MCP 都通过同一个 Local Broker 与 Portal 对话。工具面：

| 工具                    | 幂等        | 用途                               |
| ----------------------- | ----------- | ---------------------------------- |
| `projects`              | non-idem    | 列出项目，或创建临时草稿           |
| `activate_project`      | idempotent  | 打开或激活指定项目                 |
| `query_current_mindmap` | 只读        | outline / subtree / 结构化 search  |
| `edit_current_mindmap`  | destructive | 基于 anchor 的 Tree Hashline patch |

安全边界：

- Broker 只绑定 `127.0.0.1`，端口由操作系统分配；
- 每次 Desktop 启动生成新的 32-byte Bearer token；
- Descriptor 文件权限 `0600`（Unix）；
- HTTP body 上限 1 MiB，请求/响应带超时；
- Desktop 关闭时删除 descriptor；
- 外部自动化默认关闭，`edit_current_mindmap` 权限独立于读权限；
- 未授权外部编辑请求返回 `EXTERNAL_EDITS_DISABLED`；
- 外部 Agent 拿不到内部节点 UID / 编辑审查 token / 内部文档身份。

详细协议、错误码、故障排查：

- [`docs/architecture/document-automation-portal.md`](./docs/architecture/document-automation-portal.md)
- [`apps/cli/README.md`](./apps/cli/README.md)
- [`apps/mcp/README.md`](./apps/mcp/README.md)

## 架构概览

```text
┌────────────────────────── ZoeyMind Desktop (Tauri 2) ────────────────────────┐
│                                                                              │
│  React 19 + Vite Web UI                                                      │
│    ├─ Mind Map 编辑器 (simple-mind-map + custom plugins)                     │
│    ├─ AI Chat / 编辑审查 / MCP Client                                        │
│    ├─ Document Portal (projection · search · patch · anchor · tx)            │
│    ├─ Recovery / File Save Flow / File Conflict                              │
│    └─ Preferences · 主题 · 日志 · 更新器 UI                                  │
│                                                                              │
│  Rust Native (src-tauri)                                                     │
│    ├─ Document Portal Broker (authenticated loopback HTTP, dynamic port)     │
│    ├─ Chat / HTTP 流式代理 · Atomic file save · 恢复队列                     │
│    ├─ SQLite · Log rotation · File association · Auto-updater                │
│    └─ 外部自动化持久化开关 (native，独立于 Web LocalStorage)                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

外部通信面：
built-in Agent ─┐
external Agent ─┤        ┌ Local Broker (127.0.0.1:<dyn>, Bearer token) ┐
CLI/MCP ────────┴─ HTTP →│                                              │→ Portal → live MindMap
                         └ Preferences 开关 & 权限校验                  ┘
```

模块拓扑：

```text
apps/desktop/
├── apps/
│   ├── web/                     React UI · Portal 实现 · AI Chat · 恢复 · 保存流
│   ├── cli/                     发布为 @zoeymind/cli，本机 CLI Adapter
│   └── mcp/                     发布为 @zoeymind/mcp，stdio MCP Adapter
├── packages/
│   ├── document-portal-client/  Node Broker Client（bundle 进 CLI/MCP）
│   ├── simple-mind-map/         思维导图引擎（内嵌 fork）
│   ├── ui/                      共享 UI 组件库（Base UI + Tailwind + Motion）
│   ├── i18n/                    多语言底座
│   ├── logger/                  日志抽象
│   └── shared/                  跨包工具
├── src-tauri/                   Rust native · Broker · SQLite · 更新器
├── docs/architecture/           架构与决策文档
├── scripts/                     Release 工具、pack 校验
└── .github/workflows/           CI · Desktop Release · npm Release
```

## 开发指南

需求：

- Node.js **22+**、pnpm **10.11+**、Rust stable、Tauri 2 平台构建依赖。

第一次拉代码：

```bash
pnpm install --frozen-lockfile
pnpm tauri:dev
```

只跑 Web UI（无 Tauri 壳）：

```bash
pnpm dev
```

构建：

```bash
pnpm build            # 产出 Web 构建
pnpm tauri:build      # 产出桌面安装包（当前平台）
```

包内验收：

```bash
pnpm --filter @zoeymind-desktop/web test
pnpm --filter @zoeymind-desktop/web typecheck

pnpm --filter @zoeymind/cli build
pnpm --filter @zoeymind/cli test
pnpm --filter @zoeymind/mcp build
pnpm --filter @zoeymind/mcp test
pnpm test:packages           # pack + 清洁环境安装 + bin 冒烟
pnpm test:portal-integration # 真实 Desktop + Broker + Portal + engine

cargo test --manifest-path src-tauri/Cargo.toml document_portal
cargo check --manifest-path src-tauri/Cargo.toml --locked
git diff --check
```

## 版本与发布

- **单一事实源**：git tag `vX.Y.Z`；
- **CLI + MCP 同版本同批发布**；
- **Desktop 版本**可与 npm 包版本独立，兼容性由 Broker 协议版本管理（当前 `1`）；
- **禁止 `--force`** 覆盖已发布版本，永远 bump patch/minor 重发；
- `push v*.*.*` tag 触发 `npm Release` workflow，由 `npm` environment 的 `NODE_AUTH_TOKEN` secret 完成 publish；
- `workflow_dispatch` 触发 `Release` workflow 生成 Desktop 全平台安装包 + 更新器 manifest；
- 详见 [`RELEASE.md`](./RELEASE.md) 与 [`CHANGELOG.md`](./CHANGELOG.md)。

## 反馈与安全

- **一般反馈**：<https://github.com/zoeymind/zoeymind-desktop/issues>
- **商业授权**：见 [`LICENSING.md`](./LICENSING.md)，邮件 <1103837067@qq.com>
- **安全漏洞**：请**不要**开公开 issue；用 GitHub 私有漏洞报告或邮件上述地址，详见 [`SECURITY.md`](./SECURITY.md)。

## 技术栈

- **应用壳**：[Tauri 2](https://tauri.app)、[Rust](https://www.rust-lang.org)、[Tokio](https://tokio.rs)
- **前端**：[React 19](https://react.dev)、[Vite](https://vite.dev)、[TanStack Router](https://tanstack.com/router)
- **UI 基础**：[Base UI](https://base-ui.com)、[Tailwind v4](https://tailwindcss.com)、[Motion](https://motion.dev)
- **思维导图引擎**：[simple-mind-map](https://github.com/wanglin2/mind-map)（内嵌 fork，MIT）
- **协议 SDK**：[Model Context Protocol](https://modelcontextprotocol.io) TypeScript SDK
- **存储**：`.zmind` 文件（本地磁盘）+ SQLite（应用运行时状态）
- **AI SDK**：Vercel AI SDK v5、原生 fetch 通过 Rust 流式代理

以上依赖分别遵循各自开源协议，本项目授权模式不改变第三方依赖的授权条款。

## License

本项目默认采用 [**PolyForm Noncommercial 1.0.0**](./LICENSE)：

- ✅ 允许阅读、修改、再分发、非商业使用；
- ❌ 不允许任何形式的商业化，包括销售、SaaS 转售、内部业务运营；
- 💼 商业授权见 [`LICENSING.md`](./LICENSING.md)，联系 <1103837067@qq.com>。

Copyright © 2026 ZoeyMind. All rights reserved.
