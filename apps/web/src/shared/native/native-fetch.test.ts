import { afterEach, expect, it, vi } from "vitest"
import { Chat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

const bridge = vi.hoisted(() => ({
  invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
  listenGate: undefined as Promise<void> | undefined,
}))
vi.mock("@tauri-apps/api/core", () => ({ invoke: bridge.invoke }))
vi.mock("@tauri-apps/api/event", () => ({
  listen: async (name: string, callback: (event: { payload: unknown }) => void) => {
    await bridge.listenGate
    bridge.listeners.set(name, callback)
    return () => bridge.listeners.delete(name)
  },
}))
vi.mock("@/shared/app-shared", () => ({ createUUID: () => "fetch-test" }))
import { nativeFetch } from "./native-fetch"

bridge.invoke.mockResolvedValue(undefined)
afterEach(() => {
  bridge.listeners.clear()
  bridge.listenGate = undefined
  bridge.invoke.mockReset().mockResolvedValue(undefined)
})
const emit = (type: string, payload: unknown = {}) =>
  bridge.listeners.get(`http:fetch-test:${type}`)?.({ payload })
async function started() {
  await vi.waitFor(() =>
    expect(bridge.invoke).toHaveBeenCalledWith("http_stream_start", expect.anything())
  )
}

it("rejects a cancelled request before headers instead of hanging", async () => {
  const controller = new AbortController()
  const pending = nativeFetch("https://example.invalid", { signal: controller.signal })
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" })
  await started()
  controller.abort()
  await rejected
  expect(bridge.listeners.size).toBe(0)
})

it("does not start an already cancelled Request", async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(
    nativeFetch(new Request("https://example.invalid", { signal: controller.signal }))
  ).rejects.toMatchObject({ name: "AbortError" })
  expect(bridge.invoke).not.toHaveBeenCalled()
})

it("keeps chunks delivered immediately after headers and propagates body cancellation", async () => {
  const controller = new AbortController()
  const pending = nativeFetch("https://example.invalid", { signal: controller.signal })
  await started()
  emit("head", { status: 200, headers: {} })
  emit("chunk", { bytes: btoa("first") })
  const response = await pending
  const reader = response.body!.getReader()
  expect(new TextDecoder().decode((await reader.read()).value)).toBe("first")
  const reading = reader.read()
  const rejected = expect(reading).rejects.toMatchObject({ name: "AbortError" })
  controller.abort()
  await rejected
})

it("settles cancellation during listener registration and disposes late listeners", async () => {
  let release!: () => void
  bridge.listenGate = new Promise<void>(resolve => {
    release = resolve
  })
  const controller = new AbortController()
  const pending = nativeFetch("https://example.invalid", { signal: controller.signal })
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" })
  controller.abort()
  await rejected
  release()
  await vi.waitFor(() => expect(bridge.listeners.size).toBe(0))
  expect(bridge.invoke).not.toHaveBeenCalledWith("http_stream_start", expect.anything())
})

it("rejects transport errors before headers and preserves a complete streamed response", async () => {
  const failed = nativeFetch("https://example.invalid")
  const rejection = expect(failed).rejects.toThrow("connection failed")
  await started()
  emit("error", { message: "connection failed" })
  await rejection
  bridge.invoke.mockClear()
  const success = nativeFetch("https://example.invalid")
  await started()
  emit("head", { status: 200, headers: {} })
  emit("chunk", { bytes: btoa("complete") })
  emit("done")
  expect(await (await success).text()).toBe("complete")
  expect(bridge.listeners.size).toBe(0)
})

it("returns the actual Chat SDK to ready after stopping before response headers", async () => {
  const chat = new Chat({ transport: new DefaultChatTransport({ fetch: nativeFetch }) })
  const pending = chat.sendMessage({ text: "hello" })
  await started()
  expect(chat.status).toBe("submitted")
  await chat.stop()
  await pending
  expect(chat.status).toBe("ready")
  expect(chat.error).toBeUndefined()
})
