import { describe, expect, it } from "vitest"
import { resolveModelDisplayName } from "./modelDisplayName"

const models = [
  {
    id: "provider-model-name",
    configId: "model-config-id",
    name: "Claude Sonnet",
    description: "provider-model-name",
    provider: "anthropic",
  },
]

describe("resolveModelDisplayName", () => {
  it("uses the same alias shown by the composer selector", () => {
    expect(resolveModelDisplayName("model-config-id", models)).toBe("Claude Sonnet")
    expect(resolveModelDisplayName("provider-model-name", models)).toBe("Claude Sonnet")
  })

  it("never exposes an unresolved internal model id", () => {
    expect(resolveModelDisplayName("unknown-internal-id", models)).toBeUndefined()
  })
})
