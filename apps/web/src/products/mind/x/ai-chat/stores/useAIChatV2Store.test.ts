// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { UIMessage } from "@ai-sdk/react"
import {
  registerModuleAIChatRuntime,
  unregisterModuleAIChatRuntime,
  type AIChatRuntime,
} from "../context/ai-chat-runtime"
import { sqliteChatStore } from "../storage/sqliteChatStore"
import { useTabs } from "@/shared/tabs/store"
import { useAIChatV2Store } from "./useAIChatV2Store"

const targetMessage: UIMessage = {
  id: "resume-target",
  role: "user",
  parts: [{ type: "text", text: "original" }],
}
const owners: Array<{ workspaceId: string; owner: symbol }> = []

function registerRuntime(
  workspaceId: string,
  runtime: Omit<AIChatRuntime, "workspaceId" | "instanceId">
): void {
  const owner = Symbol(workspaceId)
  owners.push({ workspaceId, owner })
  registerModuleAIChatRuntime(workspaceId, owner, { ...runtime, workspaceId, instanceId: owner })
}

describe("AI chat resume resend", () => {
  beforeEach(() => {
    useTabs.setState({ activeId: "workspace-1" })
    useAIChatV2Store.setState({
      currentConversationId: "conversation-1",
      conversationIdsByWorkspace: { "workspace-1": "conversation-1" },
      knowledgeBaseIdsByWorkspace: {},
      compactionsByWorkspace: {},
    })
  })

  afterEach(() => {
    for (const { workspaceId, owner } of owners.splice(0))
      unregisterModuleAIChatRuntime(workspaceId, owner)
    vi.restoreAllMocks()
  })

  it("loads the persisted transcript and sends one request when resume is triggered concurrently", async () => {
    let releaseLoad: (() => void) | undefined
    const loadGate = new Promise<void>(resolve => {
      releaseLoad = resolve
    })
    vi.spyOn(sqliteChatStore, "loadConversationState").mockImplementation(async () => {
      await loadGate
      return { transcript: [targetMessage], compaction: null }
    })
    vi.spyOn(sqliteChatStore, "truncateConversation").mockResolvedValue()

    const sendMessage = vi.fn()
    const setMessages = vi.fn()
    registerRuntime("workspace-1", {
      sendMessage,
      regenerate: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      setMessages,
      addToolOutput: vi.fn().mockResolvedValue(undefined),
      messages: [],
      status: "ready",
      error: undefined,
    })

    const resend = () =>
      useAIChatV2Store
        .getState()
        .resendMessageFrom(
          targetMessage.id,
          { text: "resumed", attachments: [] },
          "workspace-1",
          "model-1"
        )

    const first = resend()
    const duplicate = resend()
    expect(await duplicate).toBe(false)
    releaseLoad?.()

    expect(await first).toBe(true)
    expect(setMessages).toHaveBeenCalledWith([])
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "resumed",
        metadata: expect.objectContaining({ model: "model-1" }),
      })
    )
  })
})

describe("workspace runtime ownership", () => {
  afterEach(() => {
    for (const { workspaceId, owner } of owners.splice(0))
      unregisterModuleAIChatRuntime(workspaceId, owner)
    vi.restoreAllMocks()
  })

  it("awaits stop settlement and sends the captured draft through its original runtime", async () => {
    let settleStop: (() => void) | undefined
    const stop = vi.fn(
      () =>
        new Promise<void>(resolve => {
          settleStop = resolve
        })
    )
    const sendA = vi.fn().mockResolvedValue(undefined)
    const sendB = vi.fn().mockResolvedValue(undefined)
    const base = {
      regenerate: vi.fn().mockResolvedValue(undefined),
      stop,
      setMessages: vi.fn(),
      addToolOutput: vi.fn().mockResolvedValue(undefined),
      messages: [],
      status: "streaming",
      error: undefined,
    }
    registerRuntime("workspace-A", { ...base, sendMessage: sendA })
    registerRuntime("workspace-B", {
      ...base,
      stop: vi.fn().mockResolvedValue(undefined),
      sendMessage: sendB,
    })
    useAIChatV2Store.setState({
      currentConversationId: "conversation-A",
      conversationIdsByWorkspace: { "workspace-A": "conversation-A" },
      inputMessage: "draft A",
      attachments: [],
    })

    const pending = useAIChatV2Store.getState().interruptAndSend("workspace-A", "model-A")
    await Promise.resolve()
    expect(sendA).not.toHaveBeenCalled()
    useAIChatV2Store.setState({ inputMessage: "draft B" })
    settleStop?.()
    await pending

    expect(sendA).toHaveBeenCalledWith(expect.objectContaining({ text: "draft A" }))
    expect(sendB).not.toHaveBeenCalled()
    expect(useAIChatV2Store.getState().inputMessage).toBe("draft B")
  })

  it("sends immediately after an already-settled stop without polling stale status", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    registerRuntime("workspace", {
      sendMessage: send,
      regenerate: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      setMessages: vi.fn(),
      addToolOutput: vi.fn().mockResolvedValue(undefined),
      messages: [],
      status: "streaming",
      error: undefined,
    })
    useAIChatV2Store.setState({
      currentConversationId: "conversation",
      conversationIdsByWorkspace: { workspace: "conversation" },
      inputMessage: "next",
      attachments: [],
    })

    await useAIChatV2Store.getState().interruptAndSend("workspace", "model")

    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ text: "next" }))
  })

  it("does not let an old owner unregister a replacement runtime", async () => {
    const oldOwner = Symbol("old")
    const newOwner = Symbol("new")
    const oldSend = vi.fn().mockResolvedValue(undefined)
    const newSend = vi.fn().mockResolvedValue(undefined)
    const runtime = (sendMessage: AIChatRuntime["sendMessage"]): AIChatRuntime => ({
      workspaceId: "workspace",
      instanceId: newOwner,
      sendMessage,
      regenerate: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      setMessages: vi.fn(),
      addToolOutput: vi.fn().mockResolvedValue(undefined),
      messages: [],
      status: "ready",
      error: undefined,
    })
    registerModuleAIChatRuntime("workspace", oldOwner, runtime(oldSend))
    registerModuleAIChatRuntime("workspace", newOwner, runtime(newSend))
    owners.push({ workspaceId: "workspace", owner: newOwner })
    unregisterModuleAIChatRuntime("workspace", oldOwner)
    useAIChatV2Store.setState({ inputMessage: "hello", attachments: [] })

    await useAIChatV2Store.getState().sendMessage("workspace", "model")

    expect(oldSend).not.toHaveBeenCalled()
    expect(newSend).toHaveBeenCalledOnce()
  })

  it("routes a keepalive workspace send to its own conversation after another workspace was selected", async () => {
    const sendA = vi.fn().mockResolvedValue(undefined)
    const sendB = vi.fn().mockResolvedValue(undefined)
    const runtime = (sendMessage: AIChatRuntime["sendMessage"]) => ({
      sendMessage,
      regenerate: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      setMessages: vi.fn(),
      addToolOutput: vi.fn().mockResolvedValue(undefined),
      messages: [],
      status: "ready" as const,
      error: undefined,
    })
    registerRuntime("workspace-A", runtime(sendA))
    registerRuntime("workspace-B", runtime(sendB))
    useAIChatV2Store.setState({
      currentConversationId: "conversation-B",
      conversationIdsByWorkspace: {
        "workspace-A": "conversation-A",
        "workspace-B": "conversation-B",
      },
      inputMessage: "from A",
      attachments: [],
    })

    await useAIChatV2Store.getState().sendMessage("workspace-A", "model")

    expect(sendA).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ conversationId: "conversation-A" }),
      })
    )
    expect(sendB).not.toHaveBeenCalled()
  })

  it("does not let a hidden workspace load overwrite the active selection", async () => {
    useTabs.setState({ activeId: "workspace-B" })
    useAIChatV2Store.setState({
      currentConversationId: "conversation-B",
      conversationIdsByWorkspace: { "workspace-B": "conversation-B" },
    })
    vi.spyOn(sqliteChatStore, "getConversation").mockResolvedValue({
      id: "conversation-A",
      workspaceId: "workspace-A",
      title: "A",
      createdAt: 1,
      updatedAt: 1,
    })
    vi.spyOn(sqliteChatStore, "loadConversationState").mockResolvedValue({
      transcript: [],
      compaction: null,
    })

    await useAIChatV2Store.getState().loadConversation("conversation-A")

    expect(useAIChatV2Store.getState().conversationIdsByWorkspace["workspace-A"]).toBe(
      "conversation-A"
    )
    expect(useAIChatV2Store.getState().currentConversationId).toBe("conversation-B")
  })
})
