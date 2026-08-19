import { describe, expect, it } from "vitest"
import { isNewerVersion } from "./app-version"

describe("app release versions", () => {
  it("detects a newer patch, minor, or major release", () => {
    expect(isNewerVersion("v0.1.1", "0.1.0")).toBe(true)
    expect(isNewerVersion("v0.2.0", "0.1.9")).toBe(true)
    expect(isNewerVersion("v1.0.0", "0.9.9")).toBe(true)
  })

  it("does not offer the installed or an older release", () => {
    expect(isNewerVersion("v0.1.0", "0.1.0")).toBe(false)
    expect(isNewerVersion("v0.0.9", "0.1.0")).toBe(false)
  })

  it("rejects malformed release tags", () => {
    expect(isNewerVersion("latest", "0.1.0")).toBe(false)
  })
})
