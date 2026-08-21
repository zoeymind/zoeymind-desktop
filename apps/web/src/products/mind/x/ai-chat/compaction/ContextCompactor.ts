import {
  convertToModelMessages,
  generateText,
  pruneMessages,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai"
import { logger } from "@zoeymind/logger"
import {
  createLanguageModel,
  loadModelsConfig,
  resolveChatModel,
  resolveContextBudget,
  type ModelEntry,
  type ModelProvider,
  type ModelsConfig,
  type ResolvedContextBudget,
} from "@/shared/native"
import { chatDB, type CompactionState } from "../storage/chatDB"
import { countTokens } from "../utils/tokenCounter"
import { useCompactionStore } from "./useCompactionStore"

export const COMPACTION_HEADER =
  "📦 [对话历史已自动压缩 — 以下是工作交接备忘, 不是新的用户请求]\n\n"

export const FIRST_SUMMARY_PROMPT = `这个对话快要超出上下文窗口了。请把提供的历史写成可继续工作的交接备忘。
严格输出以下八个 Markdown 章节，不要代码围栏、寒暄、最终总结或编造内容：
## 1. 用户的总意图
包含用户最近一次明确请求的逐字引用。
## 2. 已对思维导图做过的改动
保留成功的 Portal 工具调用及其结构化证据。
## 3. 关键约定 / 用户偏好
## 4. 失败 / 已尝试过的操作
## 5. 当前在做的事
包含用户最近一条消息的逐字引用。
## 6. 下一步该做什么
## 7. 关键 Portal 证据
保留仍适用的 scope、path、anchorTag 和 revision。
## 8. 涉及到的知识库 / 外部资料
没有内容的章节写“无”。先思考时可用 <thinking> 标签，该标签内容不会保留。`

const ITERATIVE_PROMPT = `${FIRST_SUMMARY_PROMPT}
这是重复压缩：先前摘要会被丢弃。较新的事实优先；已解决的阻塞要更新状态；每个仍相关的事实必须被带入新摘要。`

export class CompactionUnavailableError extends Error {
  readonly code = "COMPACTION_UNAVAILABLE"
  constructor(message = "COMPACTION_UNAVAILABLE") {
    super(message)
    this.name = "CompactionUnavailableError"
  }
}

export interface ContextCompactorDependencies {
  loadConfig: () => Promise<ModelsConfig>
  loadState: (conversationId: string) => Promise<{
    transcript: UIMessage[]
    compaction: CompactionState | null
  }>
  commit: (conversationId: string, transcript: UIMessage[], state: CompactionState) => Promise<void>
  generateSummary: (input: {
    prompt: string
    maxOutputTokens: number
    entry: ModelEntry
    provider: ModelProvider
    signal?: AbortSignal
  }) => Promise<string>
  now: () => number
  createId: () => string
}

export interface PrepareInput {
  conversationId: string
  transcript: UIMessage[]
  requestedModelId: string
  system: string
  tools: ToolSet
  force: boolean
  signal?: AbortSignal
}

export interface PrepareResult {
  messages: UIMessage[]
  state: CompactionState | null
  compacted: boolean
}

const mutexes = new Map<string, Promise<void>>()

export function buildActiveProjection(
  transcript: UIMessage[],
  compaction: CompactionState | null
): UIMessage[] {
  if (!compaction) return transcript
  const boundaryIndex = transcript.findIndex(
    message => message.id === compaction.compactedThroughMessageId
  )
  if (boundaryIndex < 0) {
    logger.warn("[Compaction] 状态边界不在 transcript 中", {
      conversationId: compaction.conversationId,
      boundary: compaction.compactedThroughMessageId,
    })
    return transcript
  }
  const summary: UIMessage = {
    id: compaction.summaryMessageId,
    role: "user",
    parts: [{ type: "text", text: `${COMPACTION_HEADER}${compaction.summary}` }],
    metadata: {
      isCompactSummary: true,
      compactedCount: compaction.compactedCount,
      modelId: compaction.modelId,
      compactedAt: compaction.compactedAt,
    },
  }
  return [summary, ...transcript.slice(boundaryIndex + 1)]
}

export function estimateSerializedRequest(
  system: string,
  modelMessages: ModelMessage[],
  tools: ToolSet
): number {
  return countTokens(JSON.stringify({ system, messages: modelMessages, tools }))
}

function estimateMessage(message: UIMessage): number {
  return countTokens(JSON.stringify(message))
}

function turnStarts(messages: UIMessage[]): number[] {
  const starts: number[] = []
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index].role === "user") starts.push(index)
  }
  return starts
}

export function selectCompactionCut(
  transcript: UIMessage[],
  existingBoundaryIndex: number,
  keepRecentTokens: number,
  summaryBudget: number
): number | null {
  const activeStart = existingBoundaryIndex + 1
  const active = transcript.slice(activeStart)
  const starts = turnStarts(active)
  if (starts.length < 2) return null
  let retainedTokens = 0
  let retainedStart = starts[starts.length - 1]
  for (let turn = starts.length - 1; turn >= 0; turn -= 1) {
    const start = starts[turn]
    const end = turn + 1 < starts.length ? starts[turn + 1] : active.length
    const size = active
      .slice(start, end)
      .reduce((sum, message) => sum + estimateMessage(message), 0)
    if (turn < starts.length - 1 && retainedTokens + size > keepRecentTokens) break
    retainedTokens += size
    retainedStart = start
  }
  if (retainedStart <= 0) return null
  const cut = activeStart + retainedStart - 1
  const compactableTokens = transcript
    .slice(activeStart, cut + 1)
    .reduce((sum, message) => sum + estimateMessage(message), 0)
  return compactableTokens > summaryBudget ? cut : null
}

function latestProviderOccupancy(projection: UIMessage[], modelId: string): number | null {
  for (let index = projection.length - 1; index >= 0; index -= 1) {
    const message = projection[index]
    const metadata = message.metadata as
      { modelId?: string; totalUsage?: { totalTokens?: number } } | undefined
    const total = metadata?.totalUsage?.totalTokens
    if (
      message.role === "assistant" &&
      metadata?.modelId === modelId &&
      typeof total === "number"
    ) {
      return (
        total +
        projection
          .slice(index + 1)
          .reduce((sum, addedMessage) => sum + estimateMessage(addedMessage), 0)
      )
    }
  }
  return null
}

function safeJson(value: unknown, limit: number): string {
  let text: string
  try {
    text = typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

export function serializeForSummary(messages: UIMessage[]): string {
  const lines: string[] = []
  for (const message of messages) {
    const role = message.role === "user" ? "我" : message.role === "assistant" ? "你" : "System"
    for (const part of message.parts ?? []) {
      const candidate = part as {
        type?: string
        text?: string
        input?: unknown
        output?: unknown
        mediaType?: string
        filename?: string
      }
      if (candidate.type === "text" && candidate.text) lines.push(`[${role}] ${candidate.text}`)
      else if (candidate.type === "reasoning" && candidate.text)
        lines.push(`[${role} 思考] ${safeJson(candidate.text, 100)}`)
      else if (candidate.type?.startsWith("tool-")) {
        const output = candidate.output as { error?: string; data?: unknown } | undefined
        const outputText = output?.error
          ? `失败: ${safeJson(output.error, 2_000)}`
          : safeJson(output ?? candidate.output, 2_000)
        lines.push(
          `[${role} 工具调用] ${candidate.type.slice(5)}(${safeJson(candidate.input, 200)}) → ${outputText}`
        )
      } else if (candidate.type === "file") {
        lines.push(
          `[${role} 附件] ${candidate.filename ?? "未命名"} (${candidate.mediaType ?? "未知类型"})`
        )
      }
    }
  }
  return lines.join("\n")
}

async function defaultGenerateSummary(input: {
  prompt: string
  maxOutputTokens: number
  entry: ModelEntry
  provider: ModelProvider
  signal?: AbortSignal
}): Promise<string> {
  const result = await generateText({
    model: createLanguageModel(input.provider, input.entry),
    messages: [{ role: "user", content: input.prompt }],
    maxOutputTokens: input.maxOutputTokens,
    maxRetries: 1,
    abortSignal: input.signal,
  })
  return result.text
}

const defaultDependencies: ContextCompactorDependencies = {
  loadConfig: loadModelsConfig,
  loadState: conversationId => chatDB.loadConversationState(conversationId),
  commit: (conversationId, transcript, state) =>
    chatDB.commitCompaction(conversationId, transcript, state),
  generateSummary: defaultGenerateSummary,
  now: Date.now,
  createId: () => crypto.randomUUID(),
}

export class ContextCompactor {
  private readonly dependencies: ContextCompactorDependencies

  constructor(dependencies: ContextCompactorDependencies = defaultDependencies) {
    this.dependencies = dependencies
  }

  async prepare(input: PrepareInput): Promise<PrepareResult> {
    const previous = mutexes.get(input.conversationId) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => {
      release = resolve
    })
    const queued = previous.then(() => current)
    mutexes.set(input.conversationId, queued)
    await previous
    try {
      return await this.prepareLocked(input)
    } finally {
      release()
      if (mutexes.get(input.conversationId) === queued) mutexes.delete(input.conversationId)
    }
  }

  private async prepareLocked(input: PrepareInput): Promise<PrepareResult> {
    const persisted = await this.dependencies.loadState(input.conversationId)
    const state = persisted.compaction
    const previousProjection = buildActiveProjection(input.transcript, state)
    try {
      const config = await this.dependencies.loadConfig()
      const { entry, provider } = resolveChatModel(config, input.requestedModelId)
      const budget = resolveContextBudget(entry)
      const converted = await convertToModelMessages(previousProjection)
      const pruned = pruneMessages({
        messages: converted,
        reasoning: "before-last-message",
        emptyMessages: "remove",
      })
      const localEstimate = estimateSerializedRequest(input.system, pruned, input.tools)
      const providerEstimate = latestProviderOccupancy(previousProjection, entry.id) ?? 0
      const occupancy = Math.max(localEstimate, providerEstimate)
      if (!input.force && occupancy <= budget.triggerTokens) {
        return { messages: previousProjection, state, compacted: false }
      }
      return await this.compact(
        input,
        entry,
        provider,
        budget,
        state,
        previousProjection,
        occupancy
      )
    } catch (error) {
      useCompactionStore.getState().setError(error instanceof Error ? error.message : String(error))
      if (input.force) throw error
      logger.warn("[Compaction] 维护压缩失败，沿用先前投影", { error })
      return { messages: previousProjection, state, compacted: false }
    }
  }

  private async compact(
    input: PrepareInput,
    entry: ModelEntry,
    provider: ModelProvider,
    budget: ResolvedContextBudget,
    state: CompactionState | null,
    previousProjection: UIMessage[],
    occupancy: number
  ): Promise<PrepareResult> {
    useCompactionStore.getState().setPhase("pending")
    const previousBoundary = state
      ? input.transcript.findIndex(message => message.id === state.compactedThroughMessageId)
      : -1
    if (state && previousBoundary < 0)
      throw new CompactionUnavailableError("Invalid compaction boundary")
    const summaryBudget = Math.min(
      4_096,
      budget.maxOutputTokens,
      Math.floor(budget.reserveTokens / 2)
    )
    const targets = input.force
      ? Array.from(new Set([budget.keepRecentTokens, 8_000, 4_000, 2_000])).filter(
          target => target <= budget.keepRecentTokens
        )
      : [budget.keepRecentTokens]
    let cut: number | null = null
    for (const target of targets) {
      cut = selectCompactionCut(input.transcript, previousBoundary, target, summaryBudget)
      if (cut !== null) break
    }
    if (cut === null) {
      if (input.force) throw new CompactionUnavailableError()
      useCompactionStore.getState().setPhase("idle")
      return { messages: previousProjection, state, compacted: false }
    }
    const newPrefix = input.transcript.slice(previousBoundary + 1, cut + 1)
    const prompt = `${state ? ITERATIVE_PROMPT : FIRST_SUMMARY_PROMPT}\n\n${
      state ? `<prior-summary>\n${state.summary}\n</prior-summary>\n\n` : ""
    }<new-history>\n${serializeForSummary(newPrefix)}\n</new-history>`
    let summary = await this.dependencies.generateSummary({
      prompt,
      maxOutputTokens: summaryBudget,
      entry,
      provider,
      signal: input.signal,
    })
    summary = summary.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim()
    if (!summary) throw new Error("EMPTY_COMPACTION_SUMMARY")
    const now = this.dependencies.now()
    const nextState: CompactionState = {
      conversationId: input.conversationId,
      summary,
      summaryMessageId: `compact-${this.dependencies.createId()}`,
      compactedThroughMessageId: input.transcript[cut].id,
      compactedAt: now,
      modelId: entry.id,
      compactedCount: cut + 1,
      tokensBefore: occupancy,
    }
    await this.dependencies.commit(input.conversationId, input.transcript, nextState)
    useCompactionStore.getState().setCompaction(nextState)
    return {
      messages: buildActiveProjection(input.transcript, nextState),
      state: nextState,
      compacted: true,
    }
  }
}

export const contextCompactor = new ContextCompactor()
