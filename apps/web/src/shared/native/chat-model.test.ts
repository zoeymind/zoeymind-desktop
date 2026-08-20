import { describe, expect, it } from "vitest"
import { resolveChatModel, UnknownModelError } from "./chat-model"
import type { ModelsConfig } from "./models-config"

const config: ModelsConfig = {
  providers: [{ id: "provider", name: "Local", kind: "ollama" }],
  models: [
    {
      id: "configured-id",
      providerId: "provider",
      name: "model-name",
      alias: "Model",
    },
  ],
  defaults: { chat: "configured-id" },
}

describe("resolveChatModel", () => {
  it("accepts configured id and provider model name", () => {
    expect(resolveChatModel(config, "configured-id").entry.name).toBe("model-name")
    expect(resolveChatModel(config, "model-name").entry.id).toBe("configured-id")
  })

  it("never silently falls back for an explicit unknown model", () => {
    expect(() => resolveChatModel(config, "unknown")).toThrow(UnknownModelError)
  })
})
