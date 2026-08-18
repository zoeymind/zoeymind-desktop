/**
 * MCP stdio server 拉起 —— 用 tauri-plugin-shell 的 Command 起子进程，
 * 暴露 stdin 写入 + stdout / stderr 事件流，供上层 MCP 协议 client（JSON-RPC）接管。
 *
 * 桌面端所有 MCP server 都从 SqlMcpRepo 读配置：kind='stdio' 时用 command+args，
 * kind='sse'/'http' 时应走 fetch（不在本文件），本文件只覆盖 stdio。
 *
 * 交付形态：`launchStdioServer(row)` 返回一个 `SpawnedMcpProcess` 句柄。
 * 具体 JSON-RPC 编解码（initialize/list_tools/call_tool）由后续 MCP client 实现。
 */
import { Command, type Child } from '@tauri-apps/plugin-shell'
import { logger } from '@zoeymind/logger'
import type { McpServerRow } from './mcp-repo'

export interface SpawnedMcpProcess {
  child: Child
  send(line: string): Promise<void>
  kill(): Promise<void>
  onStdout(handler: (chunk: string) => void): () => void
  onStderr(handler: (chunk: string) => void): () => void
}

export async function launchStdioServer(row: McpServerRow): Promise<SpawnedMcpProcess> {
  if (row.kind !== 'stdio') {
    throw new Error(`MCP server ${row.name} is not stdio (kind=${row.kind})`)
  }
  if (!row.command) {
    throw new Error(`MCP server ${row.name} missing command`)
  }

  const cmd = Command.create(row.command, row.args)

  const stdoutHandlers = new Set<(chunk: string) => void>()
  const stderrHandlers = new Set<(chunk: string) => void>()

  cmd.stdout.on('data', chunk => {
    const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    for (const h of stdoutHandlers) h(text)
  })
  cmd.stderr.on('data', chunk => {
    const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    for (const h of stderrHandlers) h(text)
  })
  cmd.on('close', ({ code }) => {
    logger.info(`[mcp:${row.name}] closed code=${code}`)
  })
  cmd.on('error', error => {
    logger.error(`[mcp:${row.name}] error`, error)
  })

  const child = await cmd.spawn()

  return {
    child,
    async send(line) {
      await child.write(line.endsWith('\n') ? line : `${line}\n`)
    },
    async kill() {
      await child.kill()
    },
    onStdout(handler) {
      stdoutHandlers.add(handler)
      return () => stdoutHandlers.delete(handler)
    },
    onStderr(handler) {
      stderrHandlers.add(handler)
      return () => stderrHandlers.delete(handler)
    }
  }
}
