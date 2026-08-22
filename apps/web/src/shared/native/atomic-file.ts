import { invoke } from "@tauri-apps/api/core"

/**
 * Durable same-directory temporary write followed by an atomic replacement.
 *
 * Tauri 2 的 invoke 支持直接透传 Uint8Array 为原生 IPC 二进制体, 无需 Array.from
 * 转成 JS number 数组走 JSON. 一个几 MB 的 .zmind bundle 用旧路径要产生几百万元素
 * 数组 + 十几 MB JSON, 是保存 Toast 卡顿的主要来源.
 */
export async function writeBytesAtomically(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("write_file_atomically", bytes, {
    headers: { path: encodeURIComponent(path) },
  })
}
