import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createMCPClient: vi.fn(),
  listConfiguredMcpServers: vi.fn(),
  nativeFetch: vi.fn(),
  setMcpServerDisabled: vi.fn(),
  close: vi.fn(async () => undefined),
  tools: vi.fn(async () => ({ search: { description: "Search" } })),
  listTools: vi.fn(async () => ({ tools: [{ name: "search", description: "Search" }] })),
}))

vi.mock("@ai-sdk/mcp", () => ({ createMCPClient: mocks.createMCPClient }))
vi.mock("@/shared/native/native-fetch", () => ({ nativeFetch: mocks.nativeFetch }))
vi.mock("@/shared/native/mcp-config", () => ({
  listConfiguredMcpServers: mocks.listConfiguredMcpServers,
  setMcpServerDisabled: mocks.setMcpServerDisabled,
}))
vi.mock("@/shared/native/tauri-mcp-transport", () => ({
  TauriStdioMcpTransport: class {},
}))

import { MCPClientManager } from "./mcp-client"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listConfiguredMcpServers.mockResolvedValue([
    { id: "remote", name: "remote", kind: "http", url: "https://example.com/mcp" },
  ])
  mocks.createMCPClient.mockResolvedValue({
    tools: mocks.tools,
    listTools: mocks.listTools,
    close: mocks.close,
  })
})

describe("persistent MCP runtime", () => {
  it("routes HTTP requests through the native CORS-free fetch", async () => {
    const manager = new MCPClientManager()
    await manager.initialize()

    const transport = mocks.createMCPClient.mock.calls[0]?.[0].transport
    expect(transport.fetch).toBe(mocks.nativeFetch)
  })

  it("shares one initialization across callers and reuses connected tools", async () => {
    const manager = new MCPClientManager()

    const [first, second, tools] = await Promise.all([
      manager.initialize(),
      manager.initialize(),
      manager.loadTools(),
    ])

    expect(first).toBe(second)
    expect(tools).toBe(first.tools)
    expect(mocks.createMCPClient).toHaveBeenCalledOnce()
    expect(mocks.listConfiguredMcpServers).toHaveBeenCalledOnce()
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it("reconnects only on explicit refresh", async () => {
    const manager = new MCPClientManager()
    await manager.initialize()
    await manager.refresh()

    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.createMCPClient).toHaveBeenCalledTimes(2)
    expect(mocks.listConfiguredMcpServers).toHaveBeenCalledTimes(2)
  })

  it("disconnects and removes only the disabled server tools", async () => {
    const manager = new MCPClientManager()
    await manager.initialize()
    await manager.setServerEnabled("remote", false)

    expect(mocks.setMcpServerDisabled).toHaveBeenCalledWith("remote", true)
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(manager.getSnapshot()?.tools).toEqual({})
  })
})
