# @zoeymind/mcp

ZoeyMind Desktop 的本地 stdio MCP Adapter，让支持标准本地 stdio server 配置的 MCP Host 查询和编辑当前思维导图。

> [!NOTE]
> Release artifacts are built and packed from this workspace. Availability on npm depends on the latest approved `npm Release` workflow run.

## Installation

```bash
npm install --global @zoeymind/mcp@latest
zoeymind-mcp doctor --json
```

安装后提供 stdio executable `zoeymind-mcp`。MCP server key 统一为 `zoeymind`。

使用 Host 的原生入口配置：

```bash
# Claude Code
claude mcp add --scope user zoeymind -- zoeymind-mcp

# Codex
codex mcp add zoeymind -- zoeymind-mcp
```

OpenCode 在用户配置的 `mcp` object 中安全合并：

```json
{
  "mcp": {
    "zoeymind": {
      "type": "local",
      "command": ["zoeymind-mcp"],
      "enabled": true
    }
  }
}
```

Agent 使用时同时安装官方 Skill：

```bash
npx --yes skills add zoeymind/zoeymind-desktop --skill zoeymind --global --agent <claude-code|codex|opencode|universal> --yes
```

Skill 提供工具流程、锚点编辑协议和功能测试用例规则；MCP 提供实际执行能力。

## 前提

- ZoeyMind Desktop 正在运行；
- 编辑前应有一个 ready 的活动思维导图；若目标不是当前项目，Agent 可调用 `projects` 和 `activate_project`。

已配置的 Agent 可以直接从用户意图调用目标 Tool。`zoeymind-mcp doctor --json` 用于安装验收或故障诊断，不是每次任务前的门禁。

用户不需要配置端口、token 或 descriptor 路径。

MCP SDK child-process handshake and tool calls are covered by automated tests. Host-specific discovery must be verified in a fresh Host session after installation; a written config alone is not completion evidence. Doctor 使用真实 stdio child process 验证四个工具的发现，再通过 MCP 调用 Desktop Broker，并对活动文档执行只读 outline 查询。

## Tools

| Tool                    | Annotation                  | Purpose                                       |
| ----------------------- | --------------------------- | --------------------------------------------- |
| `projects`              | write, non-destructive      | List projects or create a temporary draft     |
| `activate_project`      | write, idempotent           | Open or activate a project                    |
| `query_current_mindmap` | read-only                   | Read outline/subtree or run structured search |
| `edit_current_mindmap`  | destructive, non-idempotent | Apply an anchored Tree Hashline patch         |

Tool annotations 是 MCP Client 的行为提示，不是授权机制。真正的授权和事务校验由 Desktop Broker 与 Portal 执行。

`projects` list 可按精确 `projectId` / `title` 过滤。完整且未截断的 outline 返回结构化 `summary.caseCount` / `summary.priorityCounts`；search hit 的 `readPath` 可直接传给 subtree。MCP 接受额外 Agent 上下文，并在 Broker seam 自动忽略与当前 action/mode 无关的字段。

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
- MCP SDK stdio child-process interoperability is verified; Host configuration discovery remains an installation-time acceptance check;
- Desktop 启动后即提供 authenticated loopback Broker；
- `edit_current_mindmap` 与读取、项目控制使用相同的本机 token 授权；
- `preview: true` 只计算影响，不提交文档；
- package SemVer may advance independently from Desktop releases while Broker protocol compatibility remains explicit;
- breaking-change and deprecation rules are defined in the repository [changelog](../../CHANGELOG.md#versioning-policy).

完整架构和待办见[根 README](../../README.md)。

## License

Apache License 2.0。允许自由使用、修改、商用与再分发；只需保留 [`LICENSE`](./LICENSE) 与 [`NOTICE`](./NOTICE)。
