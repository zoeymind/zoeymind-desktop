# 文档标签故障隔离架构

- 状态：调研完成，暂不迁移 Electron
- 最近核验：2026-08-20
- 适用范围：ZoeyMind Desktop
- 稳定术语：[Desktop Context](../../CONTEXT.md)

## 1. 问题与目标

当前桌面端在一个 Tauri WebView 和一个 JavaScript runtime 中挂载 Shell 与全部文档标签：

```text
Tauri Window
└── one WebView / JavaScript runtime
    └── one React root
        ├── Shell / Tab Bar
        ├── Document Tab A
        ├── Document Tab B
        └── Document Tab C
```

现有 `ProjectSessionProvider`、session stores、`projectSessionRegistry` 和 `tabSaveFns` 提供文档状态归属，但不提供执行故障隔离。某标签发生同步死循环时，共享 JS 线程上的标签切换、保存命令、恢复定时器和其他标签都会停止响应。

产品级硬隔离目标是：

> 单个文档标签同步卡死、OOM 或 renderer crash 时，Shell 和其他标签仍可操作；监督者能只终止并重建故障标签，再从原生层持久化的恢复快照还原。

## 2. 当前结论

**Tauri 并非完全无法实现多 WebView 或故障恢复，但当前无法提供跨平台、可承诺的“一标签一故障域”。**

| 能力                             | 当前结论                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| 一个窗口承载多个 child WebView   | 可以实现，但 Tauri 仍将 multiwebview 置于 `unstable` feature 下，且存在跨平台缺陷。 |
| 检测 WebView 内容进程崩溃        | 底层三平台均有机制；Tauri 当前只有 macOS/iOS 直接暴露内容进程终止 hook。            |
| 检测同步死循环或 renderer 无响应 | Windows WebView2 原生支持；Tauri 没有跨平台统一 API。                               |
| 销毁并重建单个 WebView           | API 层面可行，但必须先证明故障没有传播到共享的底层 renderer/browser process。       |
| 保证一个标签故障绝不影响其他标签 | 当前 Tauri 和系统 WebView 没有 process-per-tab contract，不能保证。                 |

因此当前决策是：

1. 不立即迁移 Electron。
2. 继续完成 recovery 生命周期和主线程风险治理。
3. 将 Tauri multiwebview 作为后续跨平台技术验证，而非现阶段生产架构。
4. 只有真实故障数据和 PoC 同时证明 Tauri 无法满足产品 SLA 时，才重新评估 Electron。

## 3. 为什么 child WebView 不等于独立故障域

理想模型要求：

```text
Native Supervisor
├── Tab A WebView → Renderer A
├── Tab B WebView → Renderer B
└── Tab C WebView → Renderer C
```

Tauri 当前只能表达独立 WebView 对象，不能跨平台控制系统 WebView 如何把这些对象分配给底层 renderer process。

尤其是 WebView2 官方进程模型明确说明：

- 同一 WebView2 process group 含一个 browser process、一个或多个 renderer process。
- 一个 renderer process 可以服务多个 WebView2 实例。
- 是否创建额外 renderer 取决于 Site Isolation、origin 和 Chromium 内部策略。

因此：

```text
one child WebView != guaranteed one renderer process
```

一个共享 renderer 的失败可能同时影响多个 WebView；browser 或 GPU 层故障的影响范围可能更大。

## 4. 平台能力矩阵

### 4.1 Windows / WebView2

原生能力：

- `CoreWebView2.ProcessFailed`
- `CoreWebView2Environment.BrowserProcessExited`
- `RenderProcessExited`
- `RenderProcessUnresponsive`

Microsoft 文档明确将长时间脚本、同步 XHR 和无限循环列为 `RenderProcessUnresponsive` 的可能原因，并建议 reload 或关闭、重建 WebView2 control。

限制：

- Wry 暴露原始 `ICoreWebView2` handle，理论上可在 Rust 中注册 Windows 专用监听。
- Tauri/Wry 当前没有把 `ProcessFailed` 提升为统一 Tauri WebView 事件。
- ProcessFailed 事件可能同时由多个使用相同失败进程的 WebView2 control 收到。
- renderer 分配不由应用直接控制。

结论：**检测与重建能力强，但需要平台专用 Rust 集成，仍不能由此证明严格标签隔离。**

### 4.2 macOS / WKWebView

原生能力：

- `WKNavigationDelegate.webViewWebContentProcessDidTerminate(_:)`

Wry 已实现该 delegate；Tauri 提供 `Builder::on_web_content_process_terminate`，但文档明确标注 Linux、Windows、Android 不支持。

限制：

- 事件表示 Web Content Process 已终止，不是通用的同步死循环/无响应检测。
- 多个 WKWebView 与 Web Content Process 的映射不构成 Tauri 可控制的 process-per-tab contract。

结论：**当前可监听崩溃并尝试 reload/recreate，但没有统一 hang 检测和硬隔离保证。**

### 4.3 Linux / WebKitGTK

原生能力：

- `WebKitWebView::web-process-terminated`
- 事件携带 `WebKitWebProcessTerminationReason`

限制：

- Wry/Tauri 当前没有将此信号包装成与 Apple 平台对称的公开 hook。
- 可以通过 GTK 原始 WebView handle 写平台专用监听，但要承担跨版本维护成本。
- multiwebview 的 GTK 定位与容器实现仍有未解决问题。

结论：**底层可检测异常终止，但需要自维护平台适配；生产成熟度最低。**

## 5. Tauri 社区状态

Tauri 已通过 PR #8280 引入多 WebView 所需的 `Window` / `Webview` 拆分和 child WebView API，但 PR 作者指出 API 尚未完成，官方 example 至今仍需：

```bash
cargo run --example multiwebview --features unstable
```

已核验的相关问题：

| 链接                                                            | 状态与含义                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [tauri#2709](https://github.com/tauri-apps/tauri/issues/2709)   | BrowserView-like 能力的长期讨论；维护者强调 Tauri 包装三个系统 WebView，不控制完整浏览器架构。 |
| [tauri#2975](https://github.com/tauri-apps/tauri/issues/2975)   | Multiple webviews in one window；由 #8280 提供基础实现。                                       |
| [tauri#8280](https://github.com/tauri-apps/tauri/pull/8280)     | multiwebview 核心实现；明确 API 未完成并保留在 `unstable`。                                    |
| [tauri#10420](https://github.com/tauri-apps/tauri/issues/10420) | Linux child WebView 定位/尺寸失效；截至最近核验仍 open，修复涉及 Wry、Tao、Tauri runtime。     |
| [tauri#11376](https://github.com/tauri-apps/tauri/issues/11376) | macOS 曾只显示最后一个 child，Windows 初次显示亦有问题；已有修复记录，但证明跨平台细节仍脆弱。 |
| [tauri#9611](https://github.com/tauri-apps/tauri/issues/9611)   | WebView 固定位置与 `auto_resize` 冲突，仍属于 unstable 范围。                                  |

调研没有找到 Tauri/Wry 已提供统一的：

```text
webview crashed / renderer unresponsive
→ identify affected tab
→ terminate that execution unit
→ recreate only that tab
```

## 6. 当前实施优先级

### P0：完成 recovery 文档生命周期

固定语义：

```text
Recovery Snapshot
→ Recovered dirty document
→ Save As
→ atomic formal file write
→ project-index registration
→ promote current tab
→ clear recovery snapshot
```

恢复快照必须位于 renderer 之外并由原生层原子持久化。恢复快照不是正式项目路径。

### P1：缩小已知主线程冻结面

适合迁出共享 UI 线程的工作：

- 大型 `.zmind` / XMind / ZIP 解析与生成
- 大型序列化和压缩
- 昂贵布局计算
- 图片和预览生成
- 搜索与索引

优先顺序按数据和调用边界选择：

```text
Web Worker
→ Rust background task
→ 独立 sidecar process（只有真正需要进程边界时）
```

这属于软隔离和风险降低，不应描述成严格标签隔离。

### P1：每个 EditorPane 独立 Error Boundary

覆盖 React render、effect 和生命周期错误。不能捕获同步死循环、OOM 或整个 renderer crash。

### P2：原生层 recovery 持久化与健康信号

renderer 将可恢复状态持续提交给 Rust；Rust 负责版本化、节流和原子落盘。这样整个 WebView 失效时恢复材料仍在。

### P3：Tauri multiwebview 跨平台 PoC

PoC 必须验证行为而非只验证 API：

1. Shell 使用独立 WebView，每个文档使用 child WebView。
2. Tab A 执行同步无限循环后，Shell、Tab B、原生保存和恢复写入是否仍可用。
3. Tab A 主动制造 renderer crash/OOM 后，实际影响哪些 WebView。
4. 记录每个 WebView 的 renderer PID、browser process group 和共享关系。
5. 只销毁并重建 Tab A，验证其他标签状态未丢失。
6. 从原生 recovery snapshot 还原 Tab A。
7. macOS、Windows、Linux 分别验证；不能从单平台外推。
8. 检查焦点、输入法、快捷键、拖放、resize、显示隐藏和辅助功能。

### P4：重新评估 Electron

仅在以下条件同时成立时提升：

- 真实用户故障或遥测显示整窗冻结达到不可接受水平。
- 已知重计算迁出主线程后问题仍然存在。
- multiwebview PoC 证明三平台无法满足目标。
- 产品正式要求严格的一标签一故障域 SLA。
- Electron 包体、内存、更新和迁移成本可接受。

## 7. 若未来采用硬隔离，目标架构

不限定最终引擎，稳定责任边界应为：

```text
Native Tab Supervisor
├── Shell runtime
├── TabRuntime A
├── TabRuntime B
├── TabRuntime C
└── Recovery Store
```

`TabSupervisor` 负责：

- 创建和销毁 TabRuntime。
- 分配稳定 `tabId`、`documentId` 和一次性 `runtimeId`。
- 监听 heartbeat、unresponsive、process-gone。
- 超时后终止并只重建故障 runtime。
- 在 crash loop 阈值后停止自动重启并展示安全恢复入口。
- 从 Recovery Store 载入最近完整快照。
- 所有跨标签通信通过约束的原生协议，不允许 renderer 直接互相持有对象。

必须满足的安全与数据不变量：

1. renderer 不拥有 recovery snapshot 的唯一副本。
2. renderer crash 不得清除 recovery。
3. 重建 runtime 不得把 recovery path 晋升成正式文件 path。
4. 跨标签 IPC 必须按 tab capability 授权。
5. heartbeat 丢失只能证明“未响应”，不能自动推断原因；重启策略必须有限次并保留诊断信息。

Electron 当前能以 `WebContentsView`、`unresponsive`、`render-process-gone` 和 `forcefullyCrashRenderer()` 提供更完整的监督控制面；代价是包体、内存、构建发布和原生集成迁移。该事实是未来选型输入，不是当前迁移决定。

## 8. 可更新状态与重新评估规则

后续讨论本主题时，先核验并更新本节，而不是重新从零调研全文。

### 需要定期核验

- Tauri multiwebview 是否退出 `unstable`。
- #10420、#9611 及新增跨平台 multiwebview 缺陷状态。
- Wry 是否新增 Windows `ProcessFailed`、Linux `web-process-terminated` 或统一 termination/unresponsive API。
- Tauri 是否新增跨平台 WebView crash/hang 事件。
- WebView2、WKWebView、WebKitGTK 是否新增可控制的 per-view process isolation contract。
- Electron 安装包与内存成本在当前产品发行链中的实测结果。
- ZoeyMind 实际整窗冻结、renderer crash 和恢复成功率。

### 更新记录

| 日期       | 变化                                                                                                                                        | 决策影响                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2026-08-20 | 初始调研完成：multiwebview 可用但仍 unstable；底层三平台有终止检测，Tauri 无跨平台统一 crash/hang supervisor；未发现 process-per-tab 保证。 | Electron 迁移降为 P4；先完成 recovery、主线程治理和后续 PoC。 |

## 9. 一手来源

- [Tauri BrowserView discussion #2709](https://github.com/tauri-apps/tauri/issues/2709)
- [Tauri multiple webviews #2975](https://github.com/tauri-apps/tauri/issues/2975)
- [Tauri multiwebview implementation PR #8280](https://github.com/tauri-apps/tauri/pull/8280)
- [Tauri multiwebview example](https://github.com/tauri-apps/tauri/tree/dev/examples/multiwebview)
- [Tauri Linux positioning bug #10420](https://github.com/tauri-apps/tauri/issues/10420)
- [Tauri multiwebview rendering bug #11376](https://github.com/tauri-apps/tauri/issues/11376)
- [Tauri auto-resize/position bug #9611](https://github.com/tauri-apps/tauri/issues/9611)
- [Microsoft: Handling process-related events in WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-related-events)
- [Microsoft: WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model)
- [Apple: `webViewWebContentProcessDidTerminate`](<https://developer.apple.com/documentation/webkit/wknavigationdelegate/webviewwebcontentprocessdidterminate(_:)>)
- [WebKitGTK: `web-process-terminated`](https://webkitgtk.org/reference/webkit2gtk/2.40.0/signal.WebView.web-process-terminated.html)
- [Wry WebViewBuilder and platform extension API](https://docs.rs/wry/latest/wry/struct.WebViewBuilder.html)
- [Tauri WebviewBuilder API](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html)
