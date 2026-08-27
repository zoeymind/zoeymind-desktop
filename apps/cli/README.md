# @zoeymind/cli

ZoeyMind Desktop 的本地命令行客户端。

> [!NOTE]
> Release artifacts are built and packed from this workspace. Availability on npm depends on the latest approved `npm Release` workflow run.

## Installation and command

```bash
npm install --global @zoeymind/cli@latest
zoeymind --help
zoeymind doctor --json

# Reproducible one-off invocation without a global install
npx --yes --package @zoeymind/cli@latest zoeymind projects
```

公共命令固定为 `zoeymind`。`Document Portal`、Broker 和 document identity 是内部架构术语，不进入用户命令名。
Agent 使用时同时安装官方 Skill：

```bash
npx --yes skills add zoeymind/zoeymind-desktop --skill zoeymind --global --agent <claude-code|codex|opencode|universal> --yes
```

Skill 提供查询、Tree Hashline Patch、冲突处理和功能测试用例规则；CLI 提供实际执行能力。

## 当前开发方式

先启动 ZoeyMind Desktop：

```bash
pnpm tauri:dev
```

然后从 workspace 调用：

```bash
pnpm --filter @zoeymind/cli exec tsx src/bin.ts projects

pnpm --filter @zoeymind/cli exec tsx src/bin.ts \
  query_current_mindmap \
  '{"mode":"outline","maxLines":200}'
```

## 操作

| 操作                    | 输入                                                  | 作用                              |
| ----------------------- | ----------------------------------------------------- | --------------------------------- |
| `projects`              | `{"action":"list","projectId?":"...","title?":"..."}` | 列出或精确过滤 Desktop 可见的项目 |
| `projects`              | `{"action":"create","title":"..."}`                   | 创建并打开临时草稿                |
| `activate_project`      | `{"projectId":"..."}`                                 | 打开或激活项目                    |
| `query_current_mindmap` | outline/subtree/search request                        | 查询当前 ready 的思维导图         |
| `edit_current_mindmap`  | anchor + Tree Hashline patch                          | 原子编辑当前思维导图              |

CLI 不直接读取或修改 `.zmind` 文件。它通过共享 Broker Client 调用正在运行的 Desktop，由 Desktop 内唯一的实时文档会话执行操作。

完整且未截断的 outline 响应包含 `summary.caseCount` 与 `summary.priorityCounts`。Search 返回的 `readPath` 可原样用于 subtree 查询；路径以文档根节点为相对起点，也兼容包含根节点的写法。

CLI 接受 Agent 附带的额外上下文，并在 Broker seam 只保留当前操作可执行的字段；无关字段不会阻断调用。

## 通信

```text
zoeymind CLI
  → HTTP on 127.0.0.1:<dynamic-port>
  → authenticated Desktop Broker
  → live Document Portal
  → current MindMap
```

CLI 每次请求读取 Desktop 创建的本地 descriptor；用户不配置端口和 token。Desktop 未运行、没有打开文档或文档未 ready 时，CLI 返回结构化错误。
`zoeymind doctor --json` 会执行只读检查：Node.js 版本、authenticated Desktop Broker，以及活动文档的 outline 查询。没有活动 ready 文档时返回 `warn`；连接或查询失败返回 `fail` 和修复信息。

## 诊断与恢复

- `APP_UNAVAILABLE`：打开或重新打开 Desktop，等待应用就绪后重试；
- Desktop 重启后旧 descriptor/token 失效：直接重试，CLI 会在下一次调用重新读取 descriptor；
- descriptor 损坏或协议版本不兼容：重新打开 Desktop，让应用重新生成 descriptor；
- CLI 不记录 token、descriptor 内容、文档内容或工具输入。Desktop 日志位置可在 Preferences → Logs 查看和打开。

## 开发与验证

```bash
pnpm --filter @zoeymind/cli build
pnpm --filter @zoeymind/cli typecheck
pnpm --filter @zoeymind/cli test
pnpm --filter @zoeymind/cli smoke
pnpm --filter @zoeymind/cli integration
pnpm test:packages
```

The package requires Node.js 22 or newer. Descriptor path derivation and protocol validation are covered for macOS, Windows, and Linux; installer-level acceptance remains part of each Desktop release matrix. Broker protocol version 1 rejects unknown descriptors as unavailable.

Breaking CLI, MCP schema, structured error, or Broker protocol changes follow the repository [SemVer and deprecation policy](../../CHANGELOG.md#versioning-policy).

架构、协议、安全边界和完整发布清单见[根 README](../../README.md)。

## License

Apache License 2.0。允许自由使用、修改、商用与再分发；只需保留 [`LICENSE`](./LICENSE) 与 [`NOTICE`](./NOTICE)。
