/**
 * Log 配置桥 —— 对应 Rust 侧 `src-tauri/src/log_config.rs`.
 *
 * 默认存储位置由 tauri-plugin-log `LogDir` target 决定:
 *  - macOS:   ~/Library/Logs/{bundleId}/
 *  - Windows: %LOCALAPPDATA%\{bundleId}\logs\
 *  - Linux:   $XDG_DATA_HOME/{bundleId}/logs
 *
 * 用户可自定义目录, 落盘到 config.dir. 目录切换需要重启 (fern::Dispatch 只在
 * plugin build 时打开 RotatingFile 一次), 级别切换即时生效.
 */
import { invoke } from "@tauri-apps/api/core"

export type LogLevel = "off" | "error" | "warn" | "info" | "debug" | "trace"

export const LOG_LEVEL_OPTIONS: readonly LogLevel[] = [
  "off",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const

export interface LogInfo {
  level: LogLevel
  /** 本次会话正在写日志的目录 (启动时定住). */
  activeDir: string
  /** 用户配置的自定义目录; null 表示走 OS 默认. */
  configuredDir: string | null
  /** OS 默认日志目录, 用于 UI placeholder / reset. */
  defaultDir: string
  /** 活跃目录里所有 log 文件的总字节数; 清空 / rotate 后需要 refresh 拿新值. */
  sizeBytes: number
}

export async function getLogConfig(): Promise<LogInfo> {
  return await invoke<LogInfo>("get_log_config")
}

/** 用系统文件管理器打开本次会话正在写入的日志目录. */
export async function openLogDir(): Promise<void> {
  await invoke("open_log_dir")
}

export async function setLogLevel(level: LogLevel): Promise<void> {
  await invoke("set_log_level", { level })
}

/**
 * 保存自定义日志目录. 空串 (或纯空格) = 重置为默认.
 * 需要重启才生效; 命令本身只负责持久化 + 建目录.
 */
export async function setLogDir(dir: string): Promise<void> {
  await invoke("set_log_dir", { dir })
}

/** 删除 log 目录下所有 .log / rotate 副本; 返回删除的文件数. */
export async function clearLogs(): Promise<number> {
  return await invoke<number>("clear_logs")
}
