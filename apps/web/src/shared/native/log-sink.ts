/**
 * 把 `@zoeymind/logger` 的输出 forward 到 Rust 侧 tauri-plugin-log,
 * 让前端日志和后端日志汇聚到同一根 `app.log`.
 *
 * 设计:
 *  * **只在 Tauri 环境启用** —— 检测 `window.__TAURI_INTERNALS__`, 纯 web 构建下自动 no-op.
 *  * **级别地板 = info** —— debug 不做 IPC (每条 log 一次 invoke 太贵),
 *    但仍会走浏览器 console. Rust 侧的用户可调级别控制的是文件的最终保留范围;
 *    JS 侧的这条地板只决定"哪些值得上桥".
 *  * **序列化只做一次** —— 主消息 + 附加参数拼成一行文本.
 *    Error 展开为 `${message}\n${stack}`; 对象走 JSON.stringify (含循环引用兜底);
 *    原始值 String(...).
 *  * **失败静默** —— sink 内部 catch 掉 invoke 异常, logger 主流程绝不感知.
 *    invoke 本身是 async, 我们不 await —— 顺序稍微乱一点可接受, 换来零阻塞.
 */
import type { LogEntry, LogSink } from "@zoeymind/logger"
import type * as PluginLogModule from "@tauri-apps/plugin-log"

type PluginLog = typeof PluginLogModule

const LEVEL_ORDER = ["debug", "info", "success", "warn", "error"] as const
const FLOOR_INDEX = LEVEL_ORDER.indexOf("info")

function isTauriEnv(): boolean {
  if (typeof window === "undefined") return false
  return "__TAURI_INTERNALS__" in window
}

function stringifySafe(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ? `${value.message}\n${value.stack}` : value.message
  }
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    // 循环引用 / BigInt / 函数等
    return Object.prototype.toString.call(value)
  }
}

function formatEntry(entry: LogEntry): string {
  const body = entry.args.map(stringifySafe).join(" ")
  return entry.prefix ? `[${entry.prefix}] ${body}` : body
}

let pluginPromise: Promise<PluginLog | null> | null = null

async function getPlugin(): Promise<PluginLog | null> {
  if (!isTauriEnv()) return null
  if (!pluginPromise) {
    pluginPromise = import("@tauri-apps/plugin-log").catch(err => {
      // 装了但 runtime 拉不起来 — 打到 console, 不阻塞前端.
      console.warn("[log-sink] plugin-log unavailable:", err)
      return null
    })
  }
  return pluginPromise
}

/**
 * 生成一个可挂到 `configureLogger({ sinks: [...] })` 的 sink.
 * 在 main.tsx 里调用一次即可.
 */
export function createTauriLogSink(): LogSink {
  return (entry: LogEntry) => {
    if (LEVEL_ORDER.indexOf(entry.level) < FLOOR_INDEX) return
    if (!isTauriEnv()) return

    const message = formatEntry(entry)
    void getPlugin().then(plugin => {
      if (!plugin) return
      // success 走 info; 其它 1:1 映射.
      switch (entry.level) {
        case "error":
          return plugin.error(message)
        case "warn":
          return plugin.warn(message)
        case "debug":
          return plugin.debug(message)
        case "info":
        case "success":
        default:
          return plugin.info(message)
      }
    })
  }
}
