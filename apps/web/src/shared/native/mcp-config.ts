import { invoke } from "@tauri-apps/api/core"
import { appDataDir } from "@tauri-apps/api/path"
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs"
import { z } from "zod"
import { configFilePath } from "./paths"

const StdioServerSchema = z.object({
  type: z.literal("stdio").optional(),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().min(1).optional(),
  disabled: z.boolean().optional(),
})

const RemoteServerSchema = z.object({
  type: z.enum(["http", "sse"]).optional(),
  url: z.url(),
  headers: z.record(z.string(), z.string()).optional(),
  disabled: z.boolean().optional(),
})

const McpServerSchema = z.union([StdioServerSchema, RemoteServerSchema])
const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerSchema),
})

export interface StdioMcpServerConfig {
  type?: "stdio"
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  disabled?: boolean
}

export interface RemoteMcpServerConfig {
  type?: "http" | "sse"
  url: string
  headers?: Record<string, string>
  disabled?: boolean
}

export type McpServerConfig = StdioMcpServerConfig | RemoteMcpServerConfig
export type NamedMcpServer = McpServerConfig & {
  id: string
  name: string
  kind: "stdio" | "http" | "sse"
}
export type NamedStdioMcpServer = NamedMcpServer & StdioMcpServerConfig & { kind: "stdio" }
export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

const EMPTY_CONFIG: McpConfig = { mcpServers: {} }

export async function mcpConfigPath(): Promise<string> {
  return configFilePath("mcp.json")
}

export async function ensureMcpConfigFile(): Promise<string> {
  const path = await mcpConfigPath()
  if (!(await exists(path))) {
    const dir = await appDataDir()
    if (!(await exists(dir))) await mkdir(dir, { recursive: true })
    await writeTextFile(path, `${JSON.stringify(EMPTY_CONFIG, null, 2)}\n`)
  }
  return path
}

export async function loadMcpConfig(): Promise<McpConfig> {
  const path = await ensureMcpConfigFile()
  const raw = await readTextFile(path)
  return McpConfigSchema.parse(JSON.parse(raw))
}

export async function listConfiguredMcpServers(): Promise<NamedMcpServer[]> {
  const config = await loadMcpConfig()
  return Object.entries(config.mcpServers).map(([name, server]) => ({
    ...server,
    id: name,
    name,
    kind: "command" in server ? "stdio" : server.type === "sse" ? "sse" : "http",
  }))
}

export async function setMcpServerDisabled(name: string, disabled: boolean): Promise<void> {
  const config = await loadMcpConfig()
  const server = config.mcpServers[name]
  if (!server) throw new Error(`MCP server ${name} is not configured`)
  config.mcpServers[name] = disabled ? { ...server, disabled: true } : withoutDisabled(server)
  await writeTextFile(await mcpConfigPath(), `${JSON.stringify(config, null, 2)}\n`)
}

function withoutDisabled(server: McpServerConfig): McpServerConfig {
  const enabledServer = { ...server }
  delete enabledServer.disabled
  return enabledServer
}

export async function openMcpConfigFile(): Promise<void> {
  await ensureMcpConfigFile()
  await invoke("mcp_config_open")
}
