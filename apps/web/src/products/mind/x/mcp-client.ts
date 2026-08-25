import { createMCPClient, type MCPClient, type MCPTransport } from "@ai-sdk/mcp"
import { logger } from "@zoeymind/logger"
import {
  listConfiguredMcpServers,
  setMcpServerDisabled,
  type NamedMcpServer,
  type NamedStdioMcpServer,
} from "@/shared/native/mcp-config"
import { TauriStdioMcpTransport } from "@/shared/native/tauri-mcp-transport"
import { nativeFetch } from "@/shared/native/native-fetch"
import { useMCPStore } from "./useMCPStore"

export interface MCPToolInfo {
  name: string
  description?: string
}

export interface MCPTestResult {
  success: boolean
  toolCount?: number
  tools?: MCPToolInfo[]
  error?: string
}

type McpToolSet = Awaited<ReturnType<MCPClient["tools"]>>

export interface MCPRuntimeSnapshot {
  servers: NamedMcpServer[]
  tools: McpToolSet
}

function transportFor(server: NamedMcpServer):
  | MCPTransport
  | {
      type: "http" | "sse"
      url: string
      headers?: Record<string, string>
      fetch?: typeof fetch
    } {
  if (server.kind === "stdio") {
    return new TauriStdioMcpTransport(server as NamedStdioMcpServer)
  }
  if (!("url" in server) || typeof server.url !== "string") {
    throw new Error(`MCP server ${server.name} is missing its URL`)
  }
  return {
    type: server.kind,
    url: server.url,
    headers: server.headers,
    fetch: nativeFetch,
  }
}

function namespacedToolName(serverName: string, toolName: string): string {
  const safeServer = serverName.replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `mcp_${safeServer}_${safeTool}`
}

async function describe(client: MCPClient): Promise<MCPToolInfo[]> {
  const result = await client.listTools()
  return result.tools.map(tool => ({ name: tool.name, description: tool.description }))
}

function updateStatus(server: NamedMcpServer, result: MCPTestResult): void {
  useMCPStore.getState().updateServerStatus(server.id, {
    connected: result.success,
    toolCount: result.toolCount,
    tools: result.tools,
    error: result.error,
    lastChecked: new Date().toISOString(),
  })
}

async function connect(server: NamedMcpServer): Promise<MCPClient> {
  return createMCPClient({
    name: `zoeymind-${server.name}`,
    transport: transportFor(server),
    onUncaughtError: error => {
      logger.error(`[mcp:${server.name}] uncaught error`, { error })
      updateStatus(server, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    },
  })
}

export class MCPClientManager {
  private clients = new Map<string, MCPClient>()
  private snapshot: MCPRuntimeSnapshot | null = null
  private initialization: Promise<MCPRuntimeSnapshot> | null = null

  async listServers(): Promise<NamedMcpServer[]> {
    return this.snapshot?.servers ?? listConfiguredMcpServers()
  }

  getSnapshot(): MCPRuntimeSnapshot | null {
    return this.snapshot
  }

  initialize(): Promise<MCPRuntimeSnapshot> {
    if (this.snapshot) return Promise.resolve(this.snapshot)
    if (this.initialization) return this.initialization
    useMCPStore.getState().setInitializing(true)
    this.initialization = this.connectConfiguredServers()
      .then(snapshot => {
        useMCPStore.getState().setRuntime(snapshot.servers)
        return snapshot
      })
      .finally(() => {
        this.initialization = null
        useMCPStore.getState().setInitializing(false)
      })
    return this.initialization
  }

  async refresh(): Promise<MCPRuntimeSnapshot> {
    useMCPStore.getState().setInitializing(true)
    await this.close(false)
    useMCPStore.getState().clearAllStatus()
    return this.initialize()
  }

  async testConnection(server: NamedMcpServer): Promise<MCPTestResult> {
    const existing = this.clients.get(server.id)
    if (existing) {
      try {
        const tools = await describe(existing)
        const result = { success: true, toolCount: tools.length, tools }
        updateStatus(server, result)
        return result
      } catch (error) {
        const result = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
        updateStatus(server, result)
        return result
      }
    }
    let client: MCPClient | null = null
    try {
      client = await connect(server)
      const tools = await describe(client)
      return { success: true, toolCount: tools.length, tools }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    } finally {
      await client?.close().catch(() => undefined)
    }
  }

  async loadTools(): Promise<McpToolSet> {
    return (await this.initialize()).tools
  }

  async setServerEnabled(serverName: string, enabled: boolean): Promise<void> {
    await setMcpServerDisabled(serverName, !enabled)
    const servers = await listConfiguredMcpServers()
    const server = servers.find(candidate => candidate.name === serverName)
    if (!server) throw new Error(`MCP server ${serverName} is not configured`)

    const existing = this.clients.get(server.id)
    if (existing) {
      this.clients.delete(server.id)
      await existing.close()
    }

    const entries = Object.entries(this.snapshot?.tools ?? {}).filter(
      ([name]) => !name.startsWith(`${namespacedToolName(server.name, "")}`)
    )
    if (enabled) {
      try {
        entries.push(...(await this.connectServer(server)))
      } catch (error) {
        updateStatus(server, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    this.snapshot = {
      servers,
      tools: Object.fromEntries(entries) as McpToolSet,
    }
    if (!enabled) useMCPStore.getState().clearServerStatus(server.id)
    useMCPStore.getState().setRuntime(servers)
  }

  async close(publish = true): Promise<void> {
    const clients = [...this.clients.values()]
    this.clients.clear()
    this.snapshot = null
    await Promise.allSettled(clients.map(client => client.close()))
    if (publish) useMCPStore.getState().setRuntime([])
  }

  private async connectServer(
    server: NamedMcpServer
  ): Promise<Array<[string, McpToolSet[string]]>> {
    const client = await connect(server)
    this.clients.set(server.id, client)
    try {
      const [serverTools, displayTools] = await Promise.all([client.tools(), describe(client)])
      updateStatus(server, {
        success: true,
        toolCount: displayTools.length,
        tools: displayTools,
      })
      return Object.entries(serverTools).map(([name, tool]) => [
        namespacedToolName(server.name, name),
        tool,
      ])
    } catch (error) {
      this.clients.delete(server.id)
      await client.close().catch(() => undefined)
      throw error
    }
  }

  private async connectConfiguredServers(): Promise<MCPRuntimeSnapshot> {
    const servers = await listConfiguredMcpServers()
    const entries: Array<[string, McpToolSet[string]]> = []

    await Promise.all(
      servers.map(async server => {
        if (server.disabled === true) return
        try {
          entries.push(...(await this.connectServer(server)))
        } catch (error) {
          updateStatus(server, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    )

    this.snapshot = {
      servers,
      tools: Object.fromEntries(entries) as McpToolSet,
    }
    return this.snapshot
  }
}

export const mcpManager = new MCPClientManager()
