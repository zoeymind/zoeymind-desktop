import { describe, expect, it } from "vitest"
import { serializeQuestionOutput } from "./QuestionToolUI"
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

describe("question result", () => {
  it("tells the model that answers are already rendered", () => {
    const output = JSON.parse(
      serializeQuestionOutput({ success: true, data: [["Staging"], ["Chrome"]] })
    )

    expect(output.data).toEqual([["Staging"], ["Chrome"]])
    expect(output.ui.answersRendered).toBe(true)
    expect(output.ui.instruction).toContain("Do not repeat")
    expect(output.ui.instruction).toContain("Continue directly")
  })
})
