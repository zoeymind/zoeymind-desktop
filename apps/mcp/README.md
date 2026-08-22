# @zoeymind/mcp

ZoeyMind Desktop 的本地 stdio MCP Adapter，让支持标准本地 stdio server 配置的 MCP Host 查询和编辑当前思维导图。

> [!NOTE]
> Release artifacts are built and packed from this workspace. Availability on npm depends on the latest approved `npm Release` workflow run.

## Installation

```bash
npm install --global @zoeymind/mcp
```

安装后提供：

```text
zoeymind-mcp
```

标准 stdio Host 配置：

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

公共名称保持简短：npm package 是 `@zoeymind/mcp`，executable 是 `zoeymind-mcp`，MCP server key 推荐使用 `zoeymind`。`Document Portal` 只作为内部架构名。

## 前提

- ZoeyMind Desktop 正在运行；
- 至少一个思维导图标签已打开并 ready；
- 如果目标不是当前项目，Agent 先调用 `projects` 和 `activate_project`。

用户不需要配置端口、token 或 descriptor 路径。

已自动验证 MCP SDK child process 握手和工具调用。OMP 已验证配置发现；Claude Code 与 Codex 的真实账户验收被外部账户限制阻断，因此这里只提供标准协议配置，不宣称特定 Host 已完成端到端验收。

## Tools

| Tool                    | Annotation                  | Purpose                                       |
| ----------------------- | --------------------------- | --------------------------------------------- |
| `projects`              | write, non-destructive      | List projects or create a temporary draft     |
| `activate_project`      | write, idempotent           | Open or activate a project                    |
| `query_current_mindmap` | read-only                   | Read outline/subtree or run structured search |
| `edit_current_mindmap`  | destructive, non-idempotent | Apply an anchored Tree Hashline patch         |

Tool annotations 是 MCP Client 的行为提示，不是授权机制。真正的授权和事务校验由 Desktop Broker 与 Portal 执行。

## How it works

```text
MCP Host
  → spawn zoeymind-mcp
  → JSON-RPC over stdin/stdout
  → local Broker Client
  → authenticated HTTP on 127.0.0.1:<dynamic-port>
  → ZoeyMind Desktop
  → live current MindMap
```

MCP Adapter 使用官方 TypeScript SDK 的 `StdioServerTransport`，自身不监听网络端口。Desktop Broker 使用操作系统分配的动态 loopback 端口；Adapter 每次调用重新读取 Desktop descriptor。

> [!IMPORTANT]
> stdout 只能承载 MCP JSON-RPC。所有 banner、进度和诊断必须写入 stderr，否则 MCP Host 会收到损坏的协议消息。

## 当前开发配置

将路径替换为本机 `apps/desktop` 的绝对路径：

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

OMP 用户配置通常位于：

```text
~/.omp/agent/mcp.json
```

不要把含开发机绝对路径的配置提交到公共仓库。

## 故障排查

| Symptom                         | Cause                                | Action                                         |
| ------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `APP_UNAVAILABLE`               | Desktop 未运行或 descriptor 不存在   | 启动 Desktop 并等待主界面 ready                |
| `DOCUMENT_NOT_OPEN`             | 没有打开的思维导图                   | 打开项目或调用 `projects` / `activate_project` |
| `DOCUMENT_NOT_READY`            | MindMap 正在挂载                     | 等待后重试                                     |
| anchor expired/conflict         | 文档在 query 后发生变化              | 使用最新返回 view/anchor，必要时重新 query     |
| MCP initialize/JSON parse error | command 不可执行或 stdout 被日志污染 | 在 shell 验证 command；确保诊断只写 stderr     |
| Broker unauthorized/timeout     | Desktop 重启或 Web bridge 未响应     | 重试并检查 Desktop 日志                        |
| `EXTERNAL_EDITS_DISABLED`       | 未授权外部破坏性编辑                 | 在 Preferences 单独启用破坏性编辑              |

## 开发与验证

```bash
pnpm --filter @zoeymind/mcp build
pnpm --filter @zoeymind/mcp typecheck
pnpm --filter @zoeymind/mcp test
pnpm --filter @zoeymind/mcp smoke
pnpm test:packages
pnpm test:portal-integration
```

The test suite spawns compiled `dist/index.js` over real stdio and clean-installs both packed tarballs before exercising their bins.

## Compatibility and policy

- Node.js 22 or newer;
- Broker protocol version 1; unknown descriptor versions fail closed as unavailable;
- descriptor path derivation is contract-tested for macOS, Windows, and Linux; installer-level OS acceptance follows the Desktop release matrix;
- MCP SDK stdio child-process interoperability and OMP configuration discovery are verified;
- Desktop external automation is disabled by default and must be enabled in Preferences;
- destructive external edits are independently disabled by default;
- `ai-case-review-enabled` applies only to built-in AI and is not an external authorization setting;
- package SemVer may advance independently from Desktop releases while Broker protocol compatibility remains explicit;
- breaking-change and deprecation rules are defined in the repository [changelog](../../CHANGELOG.md#versioning-policy).

完整架构和待办见[根 README](../../README.md)。

## License

Apache License 2.0。允许自由使用、修改、商用与再分发；只需保留 [`LICENSE`](./LICENSE) 与 [`NOTICE`](./NOTICE)。
