import type { QuestionItem } from "./QuestionToolUI"

export function readQuestions(input: unknown): QuestionItem[] {
  if (typeof input !== "object" || input === null) return []
  const questions = Reflect.get(input, "questions")
  return Array.isArray(questions) ? questions : []
}
