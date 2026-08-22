# ZoeyMind Desktop Context

> 稳定领域词汇。实现方案、调研证据与可变状态见对应架构文档。

## Scope

ZoeyMind Desktop 是独立桌面应用，当前以 Tauri 2 承载 Web 前端和原生文件、窗口、菜单及恢复能力。

## Ubiquitous Language

| 术语                               | 定义                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **正式项目（Formal Project）**     | 已成功原子写入用户选择路径，并已成功登记进项目索引的 `.zmind` 文档。只有正式项目拥有可供普通保存复用的正式路径。               |
| **恢复快照（Recovery Snapshot）**  | 应用为故障恢复持久化的内部备份。它不是正式项目、不是项目索引记录，也不能成为普通保存目标。                                     |
| **恢复文档（Recovered Document）** | 从恢复快照建立的未保存、dirty 文档会话。首次保存必须执行 Save As；只有完整保存成功后才能晋升为正式项目。                       |
| **文档标签（Document Tab）**       | 一个打开文档的用户界面入口和生命周期单元。标签身份不等于操作系统进程或 WebView renderer。                                      |
| **文档会话（Document Session）**   | 单个文档标签拥有的编辑状态、dirty 状态、保存入口和恢复元数据。会话状态隔离不等于执行故障隔离。                                 |
| **Shell**                          | 承载标签栏、窗口级命令和文档运行时编排的应用外壳。当前 Shell 与所有文档标签仍运行在同一个 Tauri WebView / JavaScript runtime。 |
| **故障域（Failure Domain）**       | 一次执行故障能够影响的最大运行范围。严格标签故障隔离要求一个标签的同步死循环、OOM 或 renderer crash 不阻塞 Shell 和其他标签。  |
| **软隔离（Soft Isolation）**       | 通过独立状态 store、React Error Boundary、Web Worker 或 Rust 后台任务限制已知故障影响，但不承诺 renderer 级隔离。              |
| **硬隔离（Hard Isolation）**       | 由独立、可监督和可重建的执行单元提供标签级故障边界；某标签故障后，Shell 能终止、重建并从恢复快照还原该标签。                   |
| **Tab Supervisor**                 | 位于文档 renderer 之外，负责标签运行时创建、健康检测、终止、重建、崩溃循环限制和恢复协调的原生监督者。当前产品尚未实现。       |

## Invariants

1. 恢复快照永远不是正式项目。
2. 恢复文档首次保存必须使用 Save As。
3. 只有文件原子写入和项目索引登记均成功后，恢复文档才能晋升为正式项目并清除恢复快照。
4. 文档标签或文档会话的独立状态不能被表述为独立 renderer 或独立进程。
5. 当前 Tauri 单 WebView 架构不能承诺严格标签故障隔离。

## Context References

- [文档标签故障隔离架构](./docs/architecture/tab-fault-isolation.md) — 当前结论、平台能力、证据、优先级和后续更新入口。
- [文档自动化 Portal](./docs/architecture/document-automation-portal.md) — Test Document、搜索、局部快照、Tree Hashline Patch 与 AI SDK/CLI/MCP 统一接入方案。
