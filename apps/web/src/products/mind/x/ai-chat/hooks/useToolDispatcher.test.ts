// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { trackFetchSettlement } from "./useAIChat"
import { useToolDispatcher } from "./useToolDispatcher"

const executeTool = vi.fn()

vi.mock("@/products/mind/document-portal/current-document-adapter", () => ({
  approveCurrentDocumentEdit: vi.fn(),
  executeCurrentDocumentPortalTool: (...args: unknown[]) => executeTool(...args),
  isCurrentDocumentPortalTool: () => true,
}))

vi.mock("./useDocumentEditApprovalSetting", () => ({
  getDocumentEditApprovalEnabled: () => true,
}))

it("drops a tool completion after its conversation generation is superseded", async () => {
  let resolveTool: ((value: Record<string, unknown>) => void) | undefined
  executeTool.mockReturnValue(
    new Promise<Record<string, unknown>>(resolve => {
      resolveTool = resolve
    })
  )
  const addToolOutput = vi.fn().mockResolvedValue(undefined)
  const runtime = { generation: 1, workspaceId: "workspace-A" }
  const { result } = renderHook(() => useToolDispatcher({ runtime, addToolOutput }))

  let pending: Promise<void> | undefined
  act(() => {
    pending = result.current.onToolCall({
      toolCall: { toolName: "query_current_mindmap", toolCallId: "tool-1", input: {} },
    })
  })
  runtime.generation += 1
  resolveTool?.({ success: true })
  await pending

  expect(addToolOutput).not.toHaveBeenCalled()
  expect(executeTool).toHaveBeenCalledWith(
    "query_current_mindmap",
    {},
    expect.objectContaining({ resolver: expect.any(Object) })
  )
  const resolver = executeTool.mock.calls[0]?.[2]?.resolver as { resolve: () => string }
  expect(resolver.resolve()).toBe("workspace-A")
})

it("waits for the response body of every active transport request", async () => {
  let closeBody: (() => void) | undefined
  const sourceFetch = vi.fn().mockResolvedValue(
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          closeBody = () => controller.close()
        },
      })
    )
  )
  const tracker = trackFetchSettlement(sourceFetch)
  const response = await tracker.fetch("/chat")
  const consuming = response.text()
  let settled = false
  const waiting = tracker.settle().then(() => {
    settled = true
  })

  await Promise.resolve()
  expect(settled).toBe(false)
  closeBody?.()
  await consuming
  await waiting
  expect(settled).toBe(true)
})
