import { readQuestions } from "./questionInput"

export interface AnsweredQuestion {
  question: string
  answers: string[]
}

export interface QuestionResult {
  skipped: boolean
  items: AnsweredQuestion[]
}

export function readQuestionResult(input: unknown, output: unknown): QuestionResult {
  const result = parseOutput(output)
  if (Reflect.get(result, "success") !== true) {
    throw new Error("Question result must be successful")
  }
  if (Reflect.get(result, "skipped") === true) return { skipped: true, items: [] }

  const answers = Reflect.get(result, "data")
  if (!Array.isArray(answers)) throw new Error("Question result data must be an array")

  const questions = readQuestions(input)
  return {
    skipped: false,
    items: questions.map((question, index) => ({
      question: question.question,
      answers: Array.isArray(answers[index])
        ? answers[index].filter((answer): answer is string => typeof answer === "string")
        : [],
    })),
  }
}

function parseOutput(output: unknown): object {
  if (typeof output === "object" && output !== null) return output
  if (typeof output !== "string") throw new Error("Question result must be JSON")
  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch (error) {
    throw new Error("Question result contains invalid JSON", { cause: error })
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Question result JSON must contain an object")
  }
  return parsed
}
