/**
 * QuestionToolUI — 把 'question' 工具的 UI 注册收成一个 hook.
 *
 * 之前: dispatcher 硬编码 'if toolName==="question"' → store.setSimpleAskUser →
 *   SimpleAskUserPanel 读 store → 提交时调 store.submitSimpleAskUser → runtime.addToolOutput
 *
 * 现在: 在 Panel 顶层一句 `useQuestionToolUI()` 就声明完了, 整条链路收成一个文件.
 */

import { useCallback } from 'react'
import { useToolUI } from '../../../ai-chat/context/ToolUIRegistry'
import { SimpleAskUserPanel } from '../../../ai-chat/components/inputView/SimpleAskUserPanel'

export interface QuestionItem {
  header?: string
  question: string
  options?: Array<{ label: string; description?: string }>
  multiple?: boolean
  placeholder?: string
}

interface QuestionArgs {
  questions: QuestionItem[]
}

/** question 工具的成功响应 — 用户答完点提交; data 是每题答案数组 (单选 length=1, 多选 length=0..N) */
interface QuestionResponse {
  success: true
  data: string[][]
}
/** question 工具的跳过响应 */
interface QuestionSkipResponse {
  success: true
  skipped: true
}

type QuestionOutput = QuestionResponse | QuestionSkipResponse

export function useQuestionToolUI(): void {
  // render 闭包用 useCallback 让 ToolUIRegistry 内部的 ref 转发是稳定的
  const render = useCallback(
    ({
      args,
      respond,
      skip
    }: {
      args: QuestionArgs
      respond: (output: QuestionOutput) => void
      skip?: () => void
    }) => (
      <SimpleAskUserPanel
        questions={args.questions}
        onSubmit={data => respond({ success: true, data })}
        onSkip={skip}
      />
    ),
    []
  )

  useToolUI<QuestionArgs, QuestionOutput>({
    name: 'question',
    parseArgs: input => {
      const raw = input as { questions?: QuestionItem[] }
      return {
        questions: Array.isArray(raw.questions) ? raw.questions : []
      }
    },
    shouldRender: input => {
      // 缺 questions 直接走 dispatcher 默认错误路径
      const raw = input as { questions?: QuestionItem[] }
      return Array.isArray(raw.questions) && raw.questions.length > 0
    },
    skipResponse: () => ({ success: true, skipped: true }),
    render
  })
}
