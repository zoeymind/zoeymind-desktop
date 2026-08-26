// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

const preferences = vi.hoisted(() => new Map<string, string>())
vi.mock("@/shared/native/preferences", () => ({
  getPreference: (key: string) => preferences.get(key) ?? null,
  setPreference: (key: string, value: string) => preferences.set(key, value),
}))
import {
  DEFAULT_COMPACTION_THRESHOLD_PERCENT,
  getCompactionThresholdPercent,
  setCompactionThresholdPercent,
} from "./settings"

describe("compaction threshold settings", () => {
  beforeEach(() => preferences.clear())

  it("defaults to 85 percent and persists changes", () => {
    expect(getCompactionThresholdPercent()).toBe(DEFAULT_COMPACTION_THRESHOLD_PERCENT)
    setCompactionThresholdPercent(90)
    expect(getCompactionThresholdPercent()).toBe(90)
  })

  it("clamps malformed or unsafe stored values", () => {
    setCompactionThresholdPercent(100)
    expect(getCompactionThresholdPercent()).toBe(95)
    preferences.set("ai-chat-compaction-threshold-percent", "broken")
    expect(getCompactionThresholdPercent()).toBe(DEFAULT_COMPACTION_THRESHOLD_PERCENT)
  })
})
