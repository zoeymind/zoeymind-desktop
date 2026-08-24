import { describe, expect, it } from "vitest"
import type { ModelsConfig } from "@/shared/native"
import { configuredAIModels } from "./useModelSelector"

const model = {
  id: "model-1",
  providerId: "provider-1",
  name: "gpt-4.1",
  alias: "GPT 4.1",
  capabilities: ["chat" as const],
}

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

    expect(configuredAIModels(cfg)).toMatchObject([{ id: "gpt-4.1", provider: "openai" }])
  })

  it("allows local Ollama models without an API key", () => {
    const cfg: ModelsConfig = {
      providers: [{ id: "provider-1", name: "Ollama", kind: "ollama" }],
      models: [model],
      defaults: {},
    }

    expect(configuredAIModels(cfg)).toMatchObject([{ id: "gpt-4.1", provider: "ollama" }])
  })
})
