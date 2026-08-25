// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveChatModel, type ModelsConfig } from "@/shared/native"
import { configuredAIModels, useModelSelector } from "./useModelSelector"

const loadModelsConfig = vi.hoisted(() => vi.fn<() => Promise<ModelsConfig>>())

vi.mock("@/shared/native", async importOriginal => ({
  ...(await importOriginal<typeof import("@/shared/native")>()),
  loadModelsConfig,
}))

const model = {
  id: "model-1",
  providerId: "provider-1",
  name: "gpt-4.1",
  alias: "GPT 4.1",
  capabilities: ["chat" as const],
}

beforeEach(() => {
  localStorage.clear()
  loadModelsConfig.mockReset()
})

describe("configuredAIModels", () => {
  it("does not expose a cloud model without an API key", () => {
    const cfg: ModelsConfig = {
      providers: [{ id: "provider-1", name: "OpenAI", kind: "openai", apiKey: "  " }],
      models: [model],
      defaults: {},
    }

    expect(configuredAIModels(cfg)).toEqual([])
  })

  it("exposes a cloud model after its API key is configured", () => {
    const cfg: ModelsConfig = {
      providers: [{ id: "provider-1", name: "OpenAI", kind: "openai", apiKey: "local-key" }],
      models: [model],
      defaults: {},
    }

    expect(configuredAIModels(cfg)).toMatchObject([{ id: "model-1", provider: "openai" }])
  })

  it("allows local Ollama models without an API key", () => {
    const cfg: ModelsConfig = {
      providers: [{ id: "provider-1", name: "Ollama", kind: "ollama" }],
      models: [model],
      defaults: {},
    }

    expect(configuredAIModels(cfg)).toMatchObject([{ id: "model-1", provider: "ollama" }])
  })

  it("uses the config model id so identical remote model names remain selectable", () => {
    const cfg: ModelsConfig = {
      providers: [
        { id: "provider-1", name: "Primary", kind: "openai", apiKey: "primary-key" },
        { id: "provider-2", name: "Backup", kind: "openai", apiKey: "backup-key" },
      ],
      models: [
        model,
        { ...model, id: "model-2", providerId: "provider-2", alias: "Backup GPT 4.1" },
      ],
      defaults: { chat: "model-2" },
    }

    expect(configuredAIModels(cfg)).toMatchObject([
      { id: "model-1", description: "gpt-4.1", name: "GPT 4.1" },
      { id: "model-2", description: "gpt-4.1", name: "Backup GPT 4.1" },
    ])

    expect(resolveChatModel(cfg, "model-2")).toMatchObject({
      entry: { id: "model-2", name: "gpt-4.1" },
      provider: { id: "provider-2", name: "Backup" },
    })
  })
})

describe("useModelSelector", () => {
  it("reloads the chat model list after settings save", async () => {
    const initial: ModelsConfig = {
      providers: [{ id: "provider-1", name: "OpenAI", kind: "openai", apiKey: "local-key" }],
      models: [model],
      defaults: {},
    }
    const updated: ModelsConfig = {
      ...initial,
      models: [model, { ...model, id: "model-2", name: "gpt-4.2", alias: "GPT 4.2" }],
    }
    loadModelsConfig.mockResolvedValueOnce(initial).mockResolvedValueOnce(updated)

    const { result } = renderHook(() => useModelSelector())
    await waitFor(() => expect(result.current.models.map(item => item.id)).toEqual(["model-1"]))

    act(() => window.dispatchEvent(new Event("zm:models-updated")))

    await waitFor(() =>
      expect(result.current.models.map(item => item.id)).toEqual(["model-1", "model-2"])
    )
  })
})
