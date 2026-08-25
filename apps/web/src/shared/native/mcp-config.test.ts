import { beforeEach, describe, expect, it, vi } from "vitest"

const fs = vi.hoisted(() => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))
const invoke = vi.hoisted(() => vi.fn())

vi.mock("@tauri-apps/api/core", () => ({ invoke }))
vi.mock("@tauri-apps/api/path", () => ({ appDataDir: vi.fn(async () => "/app-data") }))
vi.mock("@tauri-apps/plugin-fs", () => fs)
vi.mock("./paths", () => ({ configFilePath: vi.fn(async () => "/app-data/mcp.json") }))

import {
  ensureMcpConfigFile,
  listConfiguredMcpServers,
  loadMcpConfig,
  openMcpConfigFile,
  setMcpServerDisabled,
} from "./mcp-config"

beforeEach(() => {
  vi.clearAllMocks()
  fs.exists.mockResolvedValue(true)
})

describe("MCP config", () => {
  it("creates the standard empty mcpServers file", async () => {
    fs.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(false)

    await expect(ensureMcpConfigFile()).resolves.toBe("/app-data/mcp.json")

    expect(fs.mkdir).toHaveBeenCalledWith("/app-data", { recursive: true })
    expect(fs.writeTextFile).toHaveBeenCalledWith(
      "/app-data/mcp.json",
      '{\n  "mcpServers": {}\n}\n'
    )
  })

  it("parses stdio, Streamable HTTP, and SSE servers", async () => {
    fs.readTextFile.mockResolvedValue(
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
            cwd: "/tmp",
            env: { TOKEN: "test" },
          },
          remote: { url: "https://example.com/mcp", headers: { Authorization: "Bearer test" } },
          events: { type: "sse", url: "https://example.com/sse", disabled: true },
        },
      })
    )

    await expect(listConfiguredMcpServers()).resolves.toEqual([
      expect.objectContaining({ id: "filesystem", name: "filesystem", kind: "stdio" }),
      expect.objectContaining({ id: "remote", name: "remote", kind: "http" }),
      expect.objectContaining({ id: "events", name: "events", kind: "sse", disabled: true }),
    ])
  })

  it("rejects invalid server configuration", async () => {
    fs.readTextFile.mockResolvedValue('{"mcpServers":{"broken":{"url":"not-a-url"}}}')
    await expect(loadMcpConfig()).rejects.toThrow()
  })

  it("asks the native boundary to open the ensured config file", async () => {
    await openMcpConfigFile()
    expect(invoke).toHaveBeenCalledWith("mcp_config_open")
  })

  it("persists one server disabled without changing its configuration", async () => {
    fs.readTextFile.mockResolvedValue(
      JSON.stringify({
        mcpServers: {
          context7: { url: "https://example.com/mcp", headers: { Authorization: "secret" } },
          shoogle: { command: "npx", args: ["shoogle"] },
        },
      })
    )

    await setMcpServerDisabled("context7", true)

    expect(fs.writeTextFile).toHaveBeenCalledWith(
      "/app-data/mcp.json",
      expect.stringContaining('"disabled": true')
    )
    const written = JSON.parse(fs.writeTextFile.mock.calls[0]?.[1])
    expect(written.mcpServers.context7.headers.Authorization).toBe("secret")
    expect(written.mcpServers.shoogle).toEqual({ command: "npx", args: ["shoogle"] })
  })
})
