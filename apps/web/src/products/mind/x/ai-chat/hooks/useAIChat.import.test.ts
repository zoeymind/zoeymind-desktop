import { describe, expect, it } from "vitest"

import { useAIChat } from "./useAIChat"

describe("useAIChat module", () => {
  it("loads with the transport hook bound", () => {
    expect(useAIChat).toBeTypeOf("function")
  })
})
