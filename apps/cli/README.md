# @zoeymind/cli

ZoeyMind Desktop 的本地命令行客户端。

> [!NOTE]
> Release artifacts are built and packed from this workspace. Availability on npm depends on the latest approved `npm Release` workflow run.

## Installation and command

```bash
npm install --global @zoeymind/cli
zoeymind --help

# Reproducible one-off invocation without a global install
npx --yes --package @zoeymind/cli@0.1.0 zoeymind projects
```

公共命令固定为 `zoeymind`。`Document Portal`、Broker 和 document identity 是内部架构术语，不进入用户命令名。

## 当前开发方式

先启动 ZoeyMind Desktop：

```bash
pnpm tauri:dev
```

然后从 workspace 调用：

```bash
pnpm --filter @zoeymind/cli exec tsx src/index.ts projects

pnpm --filter @zoeymind/cli exec tsx src/index.ts \
  query_current_mindmap \
  '{"mode":"outline","maxLines":200}'
```

## 操作

| 操作                    | 输入                                | 作用                          |
| ----------------------- | ----------------------------------- | ----------------------------- |
| `projects`              | `{"action":"list"}`                 | 列出 Desktop 可见的项目和状态 |
| `projects`              | `{"action":"create","title":"..."}` | 创建并打开临时草稿            |
| `activate_project`      | `{"projectId":"..."}`               | 打开或激活项目                |
| `query_current_mindmap` | outline/subtree/search request      | 查询当前 ready 的思维导图     |
| `edit_current_mindmap`  | anchor + Tree Hashline patch        | 原子编辑当前思维导图          |

CLI 不直接读取或修改 `.zmind` 文件。它通过共享 Broker Client 调用正在运行的 Desktop，由 Desktop 内唯一的实时文档会话执行操作。

## 通信

```text
zoeymind CLI
  → HTTP on 127.0.0.1:<dynamic-port>
  → authenticated Desktop Broker
  → live Document Portal
  → current MindMap
```

CLI 每次请求读取 Desktop 创建的本地 descriptor；用户不配置端口和 token。Desktop 未运行、没有打开文档或文档未 ready 时，CLI 返回结构化错误。

## 诊断与恢复

- `APP_UNAVAILABLE`：启动 Desktop，在 Preferences 中启用外部自动化，然后重试；
- Desktop 重启后旧 descriptor/token 失效：直接重试，CLI 会在下一次调用重新读取 descriptor；
- descriptor 损坏或协议版本不兼容：关闭外部自动化再重新开启，让 Desktop 重新生成 descriptor；
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
