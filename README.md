# ZoeyMind Desktop

ZoeyMind Desktop 是基于 Tauri 的本地思维导图编辑器。它将 `.zmind` 文档保存在用户选择的位置，并通过统一的 Document Automation Portal 向内置 AI、命令行工具和本地 MCP Client 提供结构化查询与原子编辑能力。

> [!IMPORTANT]
> Desktop、Portal、CLI 和 MCP Adapter 已完成开发环境集成、真实应用链路测试和 npm 发行加固。CLI/MCP 采用 `@zoeymind/cli`（bin `zoeymind`）与 `@zoeymind/mcp`（bin `zoeymind-mcp`）双 package 发行。首次 npm 发布由受保护的 `npm Release` workflow 驱动，需要 npm scope 与 trusted publisher 授权后才能自动完成。

## 功能

- 本地 `.zmind` 文档、新建草稿、最近项目和恢复快照；
- 多标签思维导图编辑、撤销/重做、dirty 与保存生命周期；
- 内置 Mind AI Agent；
- Document Automation Portal：
  - 大文档 outline、完整 subtree 和结构化 search；
  - Tree Hashline Patch；
  - 短期 read anchor 与冲突检测；
  - 单文档串行、单 patch 原子提交和单 undo 边界；
  - 提交后实时画布收敛、节点选择和视口居中；
- 本地 Broker、CLI 和 stdio MCP Adapter；
- macOS、Windows 和 Linux 安装包构建。

## 当前状态

| 模块            | 状态     | 说明                                                                      |
| --------------- | -------- | ------------------------------------------------------------------------- |
| Desktop 应用    | 可发布   | Tauri 2 + React 19，Release workflow 输出 macOS/Windows/Linux 安装包      |
| Portal 内核     | 已实现   | 直接读写当前打开且 ready 的实时 `ProjectSession` / MindMap                |
| 内置 AI         | 已实现   | 模型只看到当前导图 query/edit，不看到内部文档身份和节点 UID               |
| Local Broker    | 默认关闭 | 动态 loopback 端口、随机 token、descriptor 由 Preferences 中的开关控制    |
| `@zoeymind/cli` | 发行就绪 | 编译到 `dist/`，bin `zoeymind`；等待 npm scope 授权后由 workflow 发布     |
| `@zoeymind/mcp` | 发行就绪 | 编译到 `dist/`，bin `zoeymind-mcp`；等待 npm scope 授权后由 workflow 发布 |
| npm 发布        | 等待鉴权 | 见 [首次发布准备](#首次发布准备)                                          |

## 系统要求

开发与 CI 当前使用：

- Node.js 22；
- pnpm 10.11；
- Rust stable；
- Tauri 2 所需的平台构建依赖。

仓库尚未发布 CLI/MCP 的正式 Node、Desktop、MCP Client 兼容矩阵；发布前必须补齐并由 CI 验证。

## 快速开始

```bash
pnpm install --frozen-lockfile
pnpm tauri:dev
```

只启动 Web UI：

```bash
pnpm dev
```

构建：

```bash
pnpm build
pnpm tauri:build
```

## 仓库结构

```text
apps/desktop/
├── apps/
│   ├── web/                       # React UI、编辑器、AI Chat、Portal 实现
│   ├── cli/                       # 人和脚本使用的 Broker CLI Adapter
│   └── mcp/                       # 外部 Agent 使用的 stdio MCP Adapter
├── packages/
│   ├── document-portal-client/    # Node Broker Client 和共享 wire tool names
│   ├── simple-mind-map/           # 思维导图引擎
│   └── ui/                        # 共享 UI
├── src-tauri/
│   └── src/document_portal/       # 本地 HTTP Broker 生命周期与鉴权
├── docs/architecture/             # 架构决策和实现说明
└── .github/workflows/             # Desktop CI 与安装包发布
```

核心 seam：

```text
built-in Agent ── current-document Adapter ─┐
                                             │
external Agent ── stdio MCP ── Local Broker ├─ Document Portal ── live MindMap
human/script ──── CLI ──────── Local Broker ┘
```

CLI 和 MCP 只做协议转换；projection、search、anchor、patch、transaction 和 renderer convergence 均由同一个 Portal 实现。

详细设计见 [`docs/architecture/document-automation-portal.md`](./docs/architecture/document-automation-portal.md)。

## Document Automation Portal

### 外部工具

外部 CLI/MCP 当前暴露四个操作：

| 工具                    | 类型                | 用途                                                        |
| ----------------------- | ------------------- | ----------------------------------------------------------- |
| `projects`              | 读/写               | 列出项目或创建临时草稿                                      |
| `activate_project`      | 写                  | 打开或激活一个项目                                          |
| `query_current_mindmap` | 只读                | outline、subtree 或结构化 search                            |
| `edit_current_mindmap`  | destructive、非幂等 | 使用 read 返回的 anchor 和 Tree Hashline patch 编辑当前导图 |

内置 Mind AI Agent 不暴露项目控制，只拥有：

```text
query_current_mindmap
edit_current_mindmap
question
```

调用开始时，Adapter 使用 `useTabs.getState().activeId` 解析当前 ready 的文档会话，并在内部注入文档身份。

### 查询

读取结构：

```json
{
  "mode": "outline",
  "maxLines": 200
}
```

读取完整局部子树：

```json
{
  "mode": "subtree",
  "path": ["用户中心", "登录"],
  "maxLines": 200
}
```

结构化搜索：

```json
{
  "mode": "search",
  "query": "登录失败",
  "fields": ["caseTitle", "expected"],
  "limit": 20
}
```

Outline 只证明结构，不包含步骤；只有未截断的 complete subtree 才能支持完整替换或完整性结论。

### 编辑

编辑必须使用最近一次 query/edit 返回的 `anchorTag`。例如：

```json
{
  "anchorTag": "<query 返回的 anchorTag>",
  "patch": "PUT >8:\n+[P1] 登录失败 & 密码错误\n+  点击登录 & 显示密码错误提示",
  "returnView": {
    "view": "subtree",
    "maxLines": 100
  }
}
```

Tree Hashline wire format：

```text
PUT N.=M:       替换连续节点
PUT >N:         在 N 后插入同级节点
PUT <N:         在 N 前插入同级节点
CUT N.=M:       删除连续节点
MOVE N -> M:    移动子树
```

Body 每行以 `+` 开始；两个空格表示一层树深度。成功提交返回新的 bounded view 和 anchor，后续编辑应使用新 anchor；旧 anchor 会过期。

## 开发环境 CLI

Desktop 必须正在运行，目标标签必须处于 ready 状态。

```bash
pnpm --filter @zoeymind/cli exec tsx src/index.ts projects

pnpm --filter @zoeymind/cli exec tsx src/index.ts \
  query_current_mindmap \
  '{"mode":"outline","maxLines":200}'
```

完整真实应用验收：

```bash
pnpm test:portal-integration
```

该命令通过运行中的 Desktop/Broker 创建临时草稿，验证 query、search、连续 edit、破坏性 edit、过期 anchor、嵌套 MOVE、原子多操作 patch 和 renderer convergence，最后清理临时草稿。

## 开发环境 MCP 配置

MCP Adapter 使用官方 TypeScript SDK 的 `StdioServerTransport`。MCP Host 启动 Adapter 子进程，JSON-RPC request 进入 stdin，response 从 stdout 返回；Adapter 本身不监听 MCP 网络端口。

> [!WARNING]
> MCP 子进程的 stdout 只能输出 MCP JSON-RPC。任何 banner、进度或 `console.log` 都会破坏协议；诊断必须写入 stderr。

以下配置只适用于当前源码工作区。将路径替换为本机 `apps/desktop` 的绝对路径：

```json
{
  "mcpServers": {
    "zoeymind": {
      "command": "pnpm",
      "args": [
        "--dir",
        "/absolute/path/to/apps/desktop",
        "--filter",
        "@zoeymind/mcp",
        "exec",
        "tsx",
        "src/index.ts"
      ]
    }
  }
}
```

OMP 用户配置路径：

```text
~/.omp/agent/mcp.json
```

OMP 也会读取项目根目录的 `.mcp.json` / `mcp.json`。不要把开发机绝对路径提交为公共项目配置。

发布后的正式配置应使用稳定 executable，例如：

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

`@zoeymind/mcp` 与 `@zoeymind/cli` 的 release artifacts 由受保护的 `npm Release` workflow 构建、pack 验证并通过 npm trusted publishing 发布。首次发布需要在 npmjs 完成 `@zoeymind` scope 认领与 trusted publisher 关联。

## 通信与安全

运行时链路：

```text
MCP Host
  └─ stdio JSON-RPC
     └─ MCP Adapter
        └─ authenticated HTTP on 127.0.0.1:<dynamic-port>
           └─ Tauri Broker
              └─ Tauri event
                 └─ Web Adapter → Portal → live MindMap
```

Desktop 使用 `TcpListener::bind("127.0.0.1:0")`，由操作系统原子分配并绑定可用端口，因此不需要固定端口配置，也没有常规固定端口冲突。启动后 Desktop 写入包含 PID、动态端口和随机 32-byte token 的 descriptor；Node Client 每次请求重新读取该 descriptor。

安全属性：

- Broker 只监听 `127.0.0.1`，不暴露到局域网；
- 每次 Desktop 启动生成新的 Bearer token；
- Unix descriptor 创建权限为 `0600`；
- HTTP body 上限 1 MiB；
- Broker 有请求读取与 Portal 响应超时；
- Desktop 关闭时删除 descriptor；
- 外部自动化默认关闭，关闭时不创建 listener 或 descriptor；
- 破坏性外部编辑拥有独立、默认关闭的授权开关；
- 内置 AI 的 `ai-case-review-enabled` 不作为外部自动化授权。
- 外部 Agent 不获取内部节点 UID或编辑审查 token。

当前信任模型是“同一操作系统用户启动的本地进程属于受信任自动化调用方”。它不防御已经取得当前用户文件访问权限的恶意进程。

## 故障排查

| 现象                                                 | 原因                                            | 处理                                                   |
| ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| `APP_UNAVAILABLE`                                    | Desktop 未运行或 descriptor 不存在/无效         | 启动 ZoeyMind Desktop，等待主界面 ready 后重试         |
| `DOCUMENT_NOT_OPEN`                                  | 当前没有打开的思维导图标签                      | 打开项目，或先调用 `projects` / `activate_project`     |
| `DOCUMENT_NOT_READY`                                 | 编辑器仍在挂载 MindMap                          | 等待标签加载完成后重试                                 |
| `DOCUMENT_ANCHOR_EXPIRED` / `DOCUMENT_EDIT_CONFLICT` | 读取后文档或目标节点已变化                      | 使用最新返回 view/anchor；必要时重新 query             |
| `BROKER_UNAUTHORIZED`                                | Desktop 已重启，旧 token 失效                   | 重试；Client 会重新读取 descriptor                     |
| `BROKER_TIMEOUT`                                     | Web bridge 未响应或主线程阻塞                   | 检查 Desktop 日志和 renderer 状态                      |
| MCP Host 报 JSON parse/initialize 失败               | MCP stdout 被日志污染，或 Node/command 路径错误 | 确认所有日志走 stderr，并在 shell 中验证配置命令可执行 |

## 验证

```bash
# Web build / typecheck
pnpm --filter @zoeymind-desktop/web build
pnpm --filter @zoeymind-desktop/web typecheck

# Web tests
pnpm --filter @zoeymind-desktop/web test

# CLI / MCP
pnpm --filter @zoeymind/cli test
pnpm --filter @zoeymind/cli smoke
pnpm --filter @zoeymind/mcp test
pnpm --filter @zoeymind/mcp smoke
pnpm test:packages

# 真实 Portal + engine + Rust Broker
pnpm test:portal-integration

# Native
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## 首次发布准备

CLI、MCP 和 Desktop 已经完成代码、构建、测试、文档、CI/CD、安全策略工作，剩下只有需要账号级授权的动作：

### 由仓库/仓库外的人工授权

- **npm scope 认领**：在 <https://www.npmjs.com/> 用具备发布权的账号创建/申领 `@zoeymind` scope；
- **npm trusted publisher**：在 npmjs 该 scope 下把 `zoeymind/zoeymind-desktop` 仓库的 `npm Release` workflow 添加为 trusted publisher，绑定：
  - repository: `zoeymind/zoeymind-desktop`
  - workflow: `npm Release`
  - environment: `npm`
- **GitHub `npm` environment**：在 GitHub `Settings → Environments` 创建名为 `npm` 的 environment；如果 npm 侧不使用 trusted publishing，则在同一 environment 里添加 `NODE_AUTH_TOKEN` secret；勾选 `Required reviewers` 让首发默认需人工放行；
- **Desktop 更新签名密钥**：在 GitHub Secrets 中确认 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`；缺失会阻止 macOS 更新器打包。

### 由 workflow 自动完成

- `pnpm build:packages` 生成 CLI/MCP `dist`；
- `pnpm test:packages` 通过则 pack 并做全新 tarball 安装验证；
- npm 侧使用 `--provenance` 生成 attestation；
- Desktop `Release` workflow 生成 macOS/Windows/Linux 安装包、SHA256 checksums 与 `latest.json` updater manifest；
- 打 `vX.Y.Z` git tag、创建 draft release，用完成的 asset 集合发布正式版本。

### 触发命令

```bash
# CLI / MCP 首次发布 —— 需要 npm 环境已在 GitHub 上创建并被 reviewer 批准
gh workflow run "npm Release" \
  --repo zoeymind/zoeymind-desktop \
  --field version=0.1.0 \
  --field tag=latest

# Desktop 桌面安装包与自动更新 manifest
gh workflow run "Release" \
  --repo zoeymind/zoeymind-desktop \
  --field version=0.1.0
```

更细规则见 [`CHANGELOG.md`](./CHANGELOG.md#versioning-policy)。

## 设计与文档参考

README 的组织和发布待办参考了以下维护中的一手项目，而不是自行猜测：

- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — stdio transport、生命周期与故障排查；
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) — 一个 package 中共享核心并提供多种运行模式；
- [MCP Filesystem Server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) — npm bin、`dist` 发布面、权限边界与 Host 配置；
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) — requirements、client setup、configuration、security 和 troubleshooting；
- [Sentry MCP](https://github.com/getsentry/sentry-mcp) — stdio/remote 区分、环境配置、Inspector 与开发流程；
- [Notion MCP Server](https://github.com/makenotion/notion-mcp-server) — breaking-change migration 和 least-privilege 文档；
- [Vercel CLI](https://github.com/vercel/vercel/tree/main/packages/cli) — 单 package 多 bin 与 packed-artifact 测试；
- [Wrangler](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler) — Quick Start、system requirements、configuration 和 command reference 分层。

这些项目提供的是文档和 package 组织模式；ZoeyMind 的 Portal、安全边界和 Desktop 通信说明仍以本仓库代码与测试为准。
