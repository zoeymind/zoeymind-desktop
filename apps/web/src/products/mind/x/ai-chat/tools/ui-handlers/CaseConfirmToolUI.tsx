// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * CaseConfirmToolUI — add_cases / update_cases / delete_cases 工具的 review/confirm UI.
 *
 * 收 dispatcher 派发的 add_cases/update_cases/delete_cases 调用, 弹 `<CaseConfirmPanel>`
 * 让用户逐条 accept/reject + 写 feedback, 然后:
 *   1. 过滤出被接受的用例, 拼成新的 toolInput
 *   2. 本地 toolExecutor 跑一遍 (而不是把 input 直接回给 AI, AI 收到的是已执行的结果)
 *   3. 把执行结果 + 被拒列表的 feedback 汇总成模型友好的 ZTDL 摘要
 *   4. runtime.addToolOutput(...) 回传给 AI
 *   5. ctx.dismiss() 出队, 关闭 UI
 *
 * 开关: 仅在 localStorage `ai-case-review-enabled === 'true'` 时启用; 关闭时返回
 * shouldRender=false, dispatcher 会 fall through 到默认的 toolExecutor.execute 路径.
 */

import { useCallback } from "react"
import { useToolUI } from "../../../ai-chat/context/ToolUIRegistry"
import { CaseConfirmPanel } from "../../../ai-chat/components/inputView/CaseConfirmPanel"
import { useProjectSessionStore, type ProjectSessionStore } from "@/products/mind/editor-session"
import { getModuleAIChatRuntime } from "../../../ai-chat/context/AIChatRuntimeContext"
import { resolveToolInput } from "../../../ai-chat/hooks/internal/resolveToolInput"
import { toolExecutor } from "../../../ai-chat/tools/executor"
import { findNodeByUid } from "../../../ai-chat/tools/mindmap/mindmap-node-tree"
import {
  bindPreAssignedIds,
  cacheToolResult,
  toModelOutput,
  type PreAssignedId,
} from "../../../ai-chat/tools/types"
import type { CaseConfirmItem, ToolArgs } from "../../../ai-chat/types"
import { logger } from "@zoeymind/logger"

type CaseToolName = "add_cases" | "update_cases" | "delete_cases"

const CASE_REVIEW_SETTING_KEY = "ai-case-review-enabled"

interface ParsedArgs {
  toolName: CaseToolName
  /** 给 panel 渲染用的用例条目 */
  cases: CaseConfirmItem[]
  /** resolveToolInput 后的原始入参 (后面用来构造执行用的 toolInput) */
  resolvedInput: ToolArgs
  /** 用户接受的用例对应的预分配短 ID (索引对齐 acceptedItems) */
  preAssignedIds: PreAssignedId[]
}

type ConfirmResult = Record<string, { action: "accept" | "reject"; feedback?: string }>

export function useCaseConfirmToolUI(): void {
  const sessionStore = useProjectSessionStore()
  const render = useCallback(
    ({
      args,
      toolCallId,
      dismiss,
    }: {
      args: ParsedArgs
      toolCallId: string
      dismiss: () => void
    }) => (
      <CaseConfirmPanel
        cases={args.cases}
        operation={args.toolName}
        onConfirm={async results => {
          await executeCaseConfirm(args, toolCallId, results, sessionStore)
          dismiss()
        }}
      />
    ),
    [sessionStore]
  )

  useToolUI<ParsedArgs, never>({
    name: ["add_cases", "update_cases", "delete_cases"],
    shouldRender: () => {
      // 用户没开 review 就让 dispatcher 走默认执行
      return (
        typeof window !== "undefined" && localStorage.getItem(CASE_REVIEW_SETTING_KEY) === "true"
      )
    },
    parseArgs: (input, toolName) =>
      parseCaseConfirmArgs(input, toolName as CaseToolName, sessionStore),
    render,
  })
}

function parseCaseConfirmArgs(
  input: unknown,
  toolName: CaseToolName,
  sessionStore: ProjectSessionStore
): ParsedArgs {
  const runtime = getModuleAIChatRuntime()
  const mapper = runtime?.getIdMapper() ?? null
  const mindMap = sessionStore.getState().mindMap

  let resolvedInput = input as ToolArgs
  let preAssignedIds: PreAssignedId[] = []
  if (mapper) {
    const result = resolveToolInput(toolName, input as Record<string, unknown>, mapper)
    resolvedInput = result.resolved as ToolArgs
    preAssignedIds = result.preAssignedIds
  }

  const resolveCaseTitle = (caseId: string) => {
    if (!mindMap) return `用例 ${caseId.slice(0, 6)}...`
    const node = findNodeByUid(mindMap, caseId)
    return node?.data?.text || `用例 ${caseId.slice(0, 6)}...`
  }

  const resolveCaseSteps = (caseId: string) => {
    if (!mindMap) return undefined
    const node = findNodeByUid(mindMap, caseId)
    if (!node?.children || !Array.isArray(node.children)) return undefined
    const steps = node.children
      .map(child => child?.data?.text)
      .filter((step): step is string => typeof step === "string" && step.trim().length > 0)
    return steps.length > 0 ? steps : undefined
  }

  let cases: CaseConfirmItem[] = []
  const obj = resolvedInput as Record<string, unknown>

  if (toolName === "add_cases") {
    const casesInput = obj.cases as Array<{ case: string; steps?: string[] }> | undefined
    if (casesInput?.length) {
      cases = casesInput.map((c, idx) => ({
        caseId: `new-${Date.now()}-${idx}`,
        caseText: c.case,
        steps: c.steps,
        operation: "add" as const,
        preAssignedShortId: preAssignedIds.find(p => p.index === idx)?.shortId,
      }))
    }
  } else if (toolName === "update_cases") {
    const updates = obj.updates as
      Array<{ caseId: string; case?: string; steps?: string[] }> | undefined
    if (updates?.length) {
      cases = updates.map(u => ({
        caseId: u.caseId,
        caseText: u.case || resolveCaseTitle(u.caseId),
        steps: u.steps && u.steps.length > 0 ? u.steps : resolveCaseSteps(u.caseId),
        operation: "update" as const,
      }))
    }
  } else if (toolName === "delete_cases") {
    const caseIds = obj.caseIds as string[] | undefined
    if (caseIds?.length) {
      cases = caseIds.map(caseId => ({
        caseId,
        caseText: resolveCaseTitle(caseId),
        steps: resolveCaseSteps(caseId),
        operation: "delete" as const,
      }))
    }
  }

  return {
    toolName,
    cases,
    resolvedInput,
    preAssignedIds,
  }
}

/**
 * 用户提交 review 结果 → 过滤接受的用例 → 本地跑 toolExecutor → 回传 AI.
 *
 * 这块逻辑原来在 store.submitCaseConfirm, 现在搬到 hook handler 里, 把 UI 状态 +
 * 执行逻辑都收在一处, 不再和 store 字段交叉耦合.
 */
async function executeCaseConfirm(
  args: ParsedArgs,
  toolCallId: string,
  results: ConfirmResult,
  sessionStore: ProjectSessionStore
): Promise<void> {
  const runtime = getModuleAIChatRuntime()
  if (!runtime) {
    logger.error("[CaseConfirmToolUI] runtime 未初始化")
    return
  }

  const { toolName, cases, resolvedInput, preAssignedIds } = args

  // 拆分 accept / reject
  const acceptedItems = cases.filter(item => results[item.caseId]?.action === "accept")
  const rejectedItems = cases.filter(item => results[item.caseId]?.action === "reject")

  // 构造执行用的 toolInput
  const toolInput: Record<string, unknown> = {}
  if (toolName === "add_cases") {
    toolInput.moduleId = (resolvedInput as Record<string, unknown>).moduleId
    toolInput.cases = acceptedItems.map(c => ({ case: c.caseText, steps: c.steps }))
  } else if (toolName === "update_cases") {
    toolInput.updates = acceptedItems.map(c => ({
      caseId: c.caseId,
      case: c.caseText,
      steps: c.steps,
    }))
  } else {
    toolInput.caseIds = acceptedItems.map(c => c.caseId).filter((id): id is string => !!id)
  }

  // 取 MindMap + idMapper
  const mindMap = sessionStore.getState().mindMap
  const idMapper = runtime.getIdMapper()
  if (!mindMap || !idMapper) {
    logger.error("[CaseConfirmToolUI] mindMap 或 idMapper 不存在")
    await runtime.addToolOutput({
      tool: toolName,
      toolCallId,
      state: "output-error",
      errorText: "MindMap 或 idMapper 未初始化",
    })
    return
  }

  // 重新对齐预分配 ID 到过滤后的 acceptedItems 顺序
  const correctedPreAssignedIds: PreAssignedId[] = []
  for (let i = 0; i < acceptedItems.length; i++) {
    if (acceptedItems[i].preAssignedShortId) {
      correctedPreAssignedIds.push({
        shortId: acceptedItems[i].preAssignedShortId!,
        index: i,
      })
    }
  }
  // 释放被拒/未接受的预分配 ID
  const acceptedShortIds = new Set(correctedPreAssignedIds.map(p => p.shortId))
  for (const item of cases) {
    if (item.preAssignedShortId && !acceptedShortIds.has(item.preAssignedShortId)) {
      idMapper.unreserve(item.preAssignedShortId)
    }
  }
  // 顺便用一下 preAssignedIds (原始 dispatcher 解析的, 留作日志参考)
  if (preAssignedIds.length !== correctedPreAssignedIds.length) {
    logger.debug("[CaseConfirmToolUI] 预分配 ID 调整", {
      original: preAssignedIds.length,
      corrected: correctedPreAssignedIds.length,
    })
  }

  // 本地执行
  let executionResult
  try {
    executionResult = await toolExecutor.execute(toolName, toolInput, mindMap, idMapper)
    if (correctedPreAssignedIds.length > 0) {
      bindPreAssignedIds(toolName, executionResult, correctedPreAssignedIds, idMapper)
    }
  } catch (error) {
    logger.error("[CaseConfirmToolUI] 工具执行失败", { error })
    for (const { shortId } of correctedPreAssignedIds) {
      idMapper.unreserve(shortId)
    }
    await runtime.addToolOutput({
      tool: toolName,
      toolCallId,
      state: "output-error",
      errorText: error instanceof Error ? error.message : String(error),
    })
    return
  }

  // 缓存完整 result 给 UI 渲染卡片
  cacheToolResult(toolCallId, executionResult)

  // 给 AI 的精简输出: ztdl + review summary (被拒列表 + 用户 feedback)
  let modelResult = executionResult
  if (rejectedItems.length > 0) {
    const rejLines = rejectedItems
      .map(r => `!「${r.caseText}」${results[r.caseId]?.feedback || "用户选择拒绝此修改"}`)
      .join("\n")
    const reviewSummary = `# review: ${acceptedItems.length}ok/${rejectedItems.length}rejected\n${rejLines}`
    modelResult = {
      ...executionResult,
      ztdl: executionResult.ztdl ? `${executionResult.ztdl}\n${reviewSummary}` : reviewSummary,
    }
  }

  await runtime.addToolOutput({
    tool: toolName,
    toolCallId,
    output: toModelOutput(modelResult),
  })
}
