import { describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { resolveContextBudget } from "@/shared/native"
import {
  buildActiveProjection,
  FIRST_SUMMARY_PROMPT,
  selectCompactionCut,
  serializeForSummary,
} from "./ContextCompactor"
import type { CompactionState } from "../storage/sqliteChatStore"

const message = (id: string, role: "user" | "assistant", text: string): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text }],
})

describe("compaction handoff prompt", () => {
  it("preserves structured Portal evidence", () => {
    expect(FIRST_SUMMARY_PROMPT).toContain("scope、path、anchorTag 和 revision")
  })
})

describe("context budget", () => {
  const entry = {
    id: "m",
    providerId: "p",
    name: "m",
    alias: "m",
    maxContextTokens: 32_000,
    maxOutputTokens: 2_000,
  }

  it("uses the configured context occupancy threshold", () => {
    expect(resolveContextBudget(entry, 90)).toEqual({
      contextWindow: 32_000,
      maxOutputTokens: 2_000,
      reserveTokens: 4_800,
      triggerTokens: 28_800,
      keepRecentTokens: 4_000,
    })
  })

  it("defaults to 85 percent and clamps unsafe values", () => {
    expect(resolveContextBudget(entry).triggerTokens).toBe(27_200)
    expect(resolveContextBudget(entry, 100).triggerTokens).toBe(30_400)
    expect(resolveContextBudget(entry, 1).triggerTokens).toBe(16_000)
  })
})

describe("active projection", () => {
  it("keeps the transcript durable and inserts a request-only user summary", () => {
    const transcript = [
      message("u1", "user", "old"),
      message("a1", "assistant", "done"),
      message("u2", "user", "new"),
    ]
    const state: CompactionState = {
      conversationId: "c",
      summary: "handoff",
      summaryMessageId: "summary",
      compactedThroughMessageId: "a1",
      compactedAt: 1,
      modelId: "m",
      compactedCount: 2,
      tokensBefore: 100,
    }
    const projection = buildActiveProjection(transcript, state)
    expect(projection.map(item => item.id)).toEqual(["summary", "u2"])
    expect(projection[0].role).toBe("user")
    expect(transcript.map(item => item.id)).toEqual(["u1", "a1", "u2"])
  })

  it("falls back to the full transcript for a dangling boundary", () => {
    const transcript = [message("u1", "user", "old")]
    const state = {
      conversationId: "c",
      summary: "handoff",
      summaryMessageId: "summary",
      compactedThroughMessageId: "missing",
      compactedAt: 1,
      modelId: "m",
      compactedCount: 1,
      tokensBefore: 100,
    }
    expect(buildActiveProjection(transcript, state)).toBe(transcript)
  })
})

describe("whole-turn cutting", () => {
  it("cuts only before a retained user turn and keeps tool parts paired", () => {
    const huge = "x".repeat(1_000)
    const transcript: UIMessage[] = [
      message("u1", "user", huge),
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-edit",
            toolCallId: "t",
            state: "output-available",
            input: {},
            output: { success: true },
          },
        ],
      },
      message("u2", "user", huge),
      message("a2", "assistant", "done"),
      message("u3", "user", "latest"),
    ]
    expect(selectCompactionCut(transcript, -1, 10, 5)).toBe(3)
    expect(serializeForSummary(transcript.slice(0, 4))).toContain('"success":true')
  })
})
