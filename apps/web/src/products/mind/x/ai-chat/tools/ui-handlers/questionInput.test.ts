import { describe, expect, it } from "vitest"
import { readQuestions } from "./questionInput"

describe("readQuestions", () => {
  it("returns no questions for incomplete persisted tool input", () => {
    expect(readQuestions(undefined)).toEqual([])
    expect(readQuestions(null)).toEqual([])
    expect(readQuestions({})).toEqual([])
  })

  it("returns available questions", () => {
    const questions = [{ question: "继续吗？" }]
    expect(readQuestions({ questions })).toBe(questions)
  })
})
