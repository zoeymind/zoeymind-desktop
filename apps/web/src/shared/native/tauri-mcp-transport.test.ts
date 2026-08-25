import { beforeEach, describe, expect, it, vi } from "vitest"

const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  unlisten: vi.fn(),
  listener: undefined as ((event: { payload: unknown }) => void) | undefined,
}))

vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }))
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_event: string, listener: (event: { payload: unknown }) => void) => {
    native.listener = listener
    native.listen(_event, listener)
    return native.unlisten
  }),
}))

import { TauriStdioMcpTransport } from "./tauri-mcp-transport"

const server = {
  id: "local",
  name: "local",
  kind: "stdio" as const,
  command: "node",
  args: ["server.js"],
  cwd: "/work",
  env: { TOKEN: "test" },
}

beforeEach(() => {
  native.invoke.mockReset()
  native.listen.mockClear()
  native.unlisten.mockClear()
  native.listener = undefined
  native.invoke.mockImplementation(async command =>
    command === "mcp_process_spawn" ? 7 : undefined
  )
})

function emit(payload: unknown): void {
  native.listener?.({ payload })
}

describe("TauriStdioMcpTransport", () => {
  it("spawns only by configured server name and writes JSON-RPC", async () => {
    const transport = new TauriStdioMcpTransport(server)
    await transport.start()
    await transport.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })

    expect(native.invoke).toHaveBeenNthCalledWith(1, "mcp_process_spawn", { serverName: "local" })
    expect(native.invoke).toHaveBeenNthCalledWith(2, "mcp_process_write", {
      processId: 7,
      message: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    })
  })

  it("routes only matching process events", async () => {
    const transport = new TauriStdioMcpTransport(server)
    const onmessage = vi.fn()
    transport.onmessage = onmessage
    await transport.start()

    emit({ processId: 8, kind: "stdout", data: '{"jsonrpc":"2.0","id":1,"result":{}}' })
    emit({ processId: 7, kind: "stdout", data: '{"jsonrpc":"2.0","id":1,"result":{}}' })

    expect(onmessage).toHaveBeenCalledOnce()
    expect(onmessage).toHaveBeenCalledWith({ jsonrpc: "2.0", id: 1, result: {} })
  })

  it("reports process errors and closes idempotently", async () => {
    const transport = new TauriStdioMcpTransport(server)
    const onerror = vi.fn()
    transport.onerror = onerror
    await transport.start()

    emit({ processId: 7, kind: "error", data: "spawn failed" })
    expect(onerror).toHaveBeenCalledWith(expect.objectContaining({ message: "spawn failed" }))

    await transport.close()
    await transport.close()
    expect(native.invoke).toHaveBeenCalledWith("mcp_process_kill", { processId: 7 })
    expect(native.unlisten).toHaveBeenCalledOnce()
  })

  it("notifies close once when the native process exits", async () => {
    const transport = new TauriStdioMcpTransport(server)
    const onclose = vi.fn()
    transport.onclose = onclose
    await transport.start()

    emit({ processId: 7, kind: "close", code: 0 })
    emit({ processId: 7, kind: "close", code: 0 })

    expect(onclose).toHaveBeenCalledOnce()
    expect(native.unlisten).toHaveBeenCalledOnce()
  })
})
