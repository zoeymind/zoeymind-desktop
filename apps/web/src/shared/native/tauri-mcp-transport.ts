import type { JSONRPCMessage, MCPTransport } from "@ai-sdk/mcp"
import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { logger } from "@zoeymind/logger"
import { z } from "zod"
import type { NamedStdioMcpServer } from "./mcp-config"

const JsonRpcMessageSchema = z.union([
  z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number()]),
      method: z.string(),
    })
    .passthrough(),
  z.object({ jsonrpc: z.literal("2.0"), method: z.string() }).passthrough(),
  z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number()]),
      result: z.unknown(),
    })
    .passthrough(),
  z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number()]).optional(),
      error: z.object({ code: z.number(), message: z.string() }).passthrough(),
    })
    .passthrough(),
])

interface McpProcessEvent {
  processId: number
  kind: "stdout" | "stderr" | "error" | "close"
  data?: string
  code?: number
}

export class TauriStdioMcpTransport implements MCPTransport {
  readonly supportsProtocolVersionDiscovery = true
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void
  private readonly server: NamedStdioMcpServer
  private processId: number | null = null
  private unlisten: UnlistenFn | null = null
  private closed = false

  constructor(server: NamedStdioMcpServer) {
    this.server = server
  }

  async start(): Promise<void> {
    if (this.processId !== null)
      throw new Error(`MCP server ${this.server.name} is already running`)
    this.closed = false
    this.unlisten = await listen<McpProcessEvent>("mcp:process", event => {
      if (event.payload.processId !== this.processId) return
      this.handleEvent(event.payload)
    })
    try {
      this.processId = await invoke<number>("mcp_process_spawn", { serverName: this.server.name })
    } catch (error) {
      this.unlisten?.()
      this.unlisten = null
      throw error
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.processId === null) throw new Error(`MCP server ${this.server.name} is not running`)
    await invoke("mcp_process_write", {
      processId: this.processId,
      message: JSON.stringify(message),
    })
  }

  async close(): Promise<void> {
    const processId = this.processId
    this.processId = null
    this.disposeListener()
    if (processId !== null) await invoke("mcp_process_kill", { processId })
  }

  private handleEvent(event: McpProcessEvent): void {
    if (event.kind === "stdout" && event.data) {
      try {
        this.onmessage?.(JsonRpcMessageSchema.parse(JSON.parse(event.data)) as JSONRPCMessage)
      } catch (error) {
        this.reportError(error instanceof Error ? error : new Error(String(error)))
      }
      return
    }
    if (event.kind === "stderr" && event.data) {
      logger.warn(`[mcp:${this.server.name}] stderr`, { message: event.data })
      return
    }
    if (event.kind === "error") {
      this.reportError(new Error(event.data ?? `MCP server ${this.server.name} failed`))
      return
    }
    if (event.kind === "close") {
      this.processId = null
      this.disposeListener()
      if (!this.closed) {
        this.closed = true
        this.onclose?.()
      }
    }
  }

  private disposeListener(): void {
    this.unlisten?.()
    this.unlisten = null
  }

  private reportError(error: Error): void {
    this.onerror?.(error)
  }
}
