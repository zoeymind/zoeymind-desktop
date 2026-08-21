// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * Tool UI Registry — 声明式注册"哪个工具弹什么 UI" + 自动接 respond 链路.
 *
 * 借鉴 CopilotKit `useCopilotAction({ renderAndWaitForResponse })` 的 API 形状,
 * 但不引入整个 CopilotKit (太重). 我们只复刻 hook 接口, 内部走自家 dispatcher.
 *
 * 用法 (在 AIchatV2 Panel 内任何子组件):
 *
 *   useToolUI<QuestionArgs, QuestionResponse>({
 *     name: 'question',
 *     render: ({ args, respond, skip }) => (
 *       <SimpleAskUserPanel
 *         questions={args.questions}
 *         onSubmit={answers => respond({ success: true, data: answers })}
 *         onSkip={skip}
 *       />
 *     )
 *   })
 *
 * 然后 dispatcher 收到 'question' 工具调用 → 把这次调用入 pending 队列 →
 * `<ToolUIRenderer />` 渲染对应 handler → 用户操作 → respond → SDK 接到结果.
 *
 * shouldRender 用于动态开关 (e.g. case review 设置关时, 直接 fall back 到默认执行).
 */
import { useEffect, useRef, type ReactNode } from "react"

/** 一次工具调用 + 对应的 UI handler 的运行时上下文 */
export interface ToolUIRenderContext<TArgs = unknown, TOutput = unknown> {
  /** AI SDK 的 tool call id */
  toolCallId: string
  /** 实际触发的工具名 (handler 注册多个名字时需要据此分流) */
  toolName: string
  /** 已经 parseArgs 加工过的 args */
  args: TArgs
  /**
   * 用户提交结果: 自动调 runtime.addToolOutput(serialized(output)) + 出队.
   * 适用于"用户直接给答案, 不需要再跑工具"的简单 HITL (如 question).
   */
  respond: (output: TOutput) => Promise<void>
  /**
   * 用户跳过 (仅 handler 提供 skipResponse 时存在). 等价于 respond(skipResponse()).
   */
  skip?: () => void
  /**
   * 仅出队, 不调 runtime.addToolOutput.
   * 用于"handler 自己已经通过其它途径 (store action) 处理了 addToolOutput, 这里只是把 UI 关掉".
   * 典型场景: case review — store.submitCaseConfirm 自己跑 toolExecutor + addToolOutput, hook 只需 dismiss.
   */
  dismiss: () => void
}
/** 在 useToolUI 里声明的注册项 */
export interface ToolUIHandler<TArgs = unknown, TOutput = unknown> {
  /** 工具名, 单个或多个 (多个 = 同一 UI 处理多种工具) */
  name: string | readonly string[]
  /**
   * 决定是否真的弹 UI. false → dispatcher 跳过 UI 走默认执行链路.
   * 用于 "case review 关闭时跳过 UI" 这种动态开关.
   */
  shouldRender?: (input: unknown, toolName: string) => boolean
  /** 解析 SDK 给的 raw input 成 UI 友好的 args. 不传则原样透传 */
  parseArgs?: (input: unknown, toolName: string) => TArgs
  /** 用户提交结果后, 把 TOutput 转成给 SDK 的 string output. 不传则 JSON.stringify */
  serializeOutput?: (output: TOutput) => string
  /** 用户点跳过时的 output. 不传则不显示 skip 按钮 */
  skipResponse?: () => TOutput
  /** UI 渲染. 注意每次注册都会重新写到 registry, render 闭包要走 useCallback 防抖. */
  render: (ctx: ToolUIRenderContext<TArgs, TOutput>) => ReactNode
}

/** Pending 队列里的一项, 由 dispatcher 推入, renderer 消费 */
export interface PendingToolUICall {
  toolCallId: string
  toolName: string
  /** SDK 原始 input, renderer 拿出来调 handler.parseArgs */
  input: unknown
  /** 入队时间戳, 用于去重 / 排序 */
  enqueuedAt: number
}

type Listener = () => void

/**
 * 模块单例 — 类似 AIChatRuntimeContext, 既能在组件树通过 hook 注册,
 * 也能在 dispatcher / 非组件代码里通过模块函数访问.
 */
class ToolUIRegistry {
  private handlers = new Map<string, ToolUIHandler>()
  private pending: PendingToolUICall[] = []
  private listeners = new Set<Listener>()

  register(handler: ToolUIHandler): () => void {
    const names = Array.isArray(handler.name) ? handler.name : [handler.name]
    for (const n of names) {
      this.handlers.set(n, handler as ToolUIHandler)
    }
    return () => {
      for (const n of names) {
        // 注销前确认 handler 还是自己, 防止热替换时误删后注册的
        if (this.handlers.get(n) === (handler as ToolUIHandler)) {
          this.handlers.delete(n)
        }
      }
    }
  }

  getHandler(toolName: string): ToolUIHandler | undefined {
    return this.handlers.get(toolName)
  }

  /**
   * dispatcher 调: 判断是否要走 UI 路径.
   * 命中 + shouldRender 通过 → 入队 → 返回 true (dispatcher 不再 fall through)
   * 否则 → 返回 false (dispatcher 走默认执行)
   */
  tryEnqueue(call: { toolCallId: string; toolName: string; input: unknown }): boolean {
    const handler = this.handlers.get(call.toolName)
    if (!handler) return false
    if (handler.shouldRender && !handler.shouldRender(call.input, call.toolName)) return false
    if (this.pending.some(c => c.toolCallId === call.toolCallId)) return true // 已入队
    this.pending = [...this.pending, { ...call, enqueuedAt: Date.now() }]
    this.emit()
    return true
  }

  /** 用户提交后, 从 pending 移除 (respond 内部调) */
  complete(toolCallId: string): void {
    const next = this.pending.filter(c => c.toolCallId !== toolCallId)
    if (next.length !== this.pending.length) {
      this.pending = next
      this.emit()
    }
  }

  /** 给 renderer 订阅用 */
  getPending(): PendingToolUICall[] {
    return this.pending
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 切换对话 / panel 卸载时清空 */
  reset(): void {
    if (this.pending.length === 0) return
    this.pending = []
    this.emit()
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }
}

const registry = new ToolUIRegistry()

/**
 * 在组件里声明"这个工具用这个 UI". Mount 注册, unmount 注销.
 * handler 闭包用 useCallback 包一下, 不然 render 函数每次 re-render 都会变.
 */
export function useToolUI<TArgs = unknown, TOutput = unknown>(
  handler: ToolUIHandler<TArgs, TOutput>
): void {
  // ref 持续指向最新 handler, 让 dispatcher 通过 registry.getHandler 拿到最新闭包
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    // 用代理 handler 让所有方法走 ref, 这样 render 闭包变化时无需重新注册
    const proxy: ToolUIHandler<TArgs, TOutput> = {
      name: handler.name,
      shouldRender: (input, name) => handlerRef.current.shouldRender?.(input, name) ?? true,
      parseArgs: handler.parseArgs
        ? (input, name) => handlerRef.current.parseArgs!(input, name)
        : undefined,
      serializeOutput: handler.serializeOutput
        ? out => handlerRef.current.serializeOutput!(out)
        : undefined,
      skipResponse: handler.skipResponse ? () => handlerRef.current.skipResponse!() : undefined,
      render: ctx => handlerRef.current.render(ctx),
    }
    return registry.register(proxy as ToolUIHandler)
    // 仅在 name (注册键) 变化时 re-register
  }, [Array.isArray(handler.name) ? handler.name.join("|") : handler.name])
}

/** dispatcher 调: 命中 UI handler 则入队并返回 true, 否则 false */
export function enqueueToolUICall(call: {
  toolCallId: string
  toolName: string
  input: unknown
}): boolean {
  return registry.tryEnqueue(call)
}

/** renderer 用: 当前 pending 列表 */
export function getToolUIPending(): PendingToolUICall[] {
  return registry.getPending()
}

export function subscribeToolUIPending(listener: () => void): () => void {
  return registry.subscribe(listener)
}

export function getToolUIHandler(name: string): ToolUIHandler | undefined {
  return registry.getHandler(name)
}

export function completeToolUICall(toolCallId: string): void {
  registry.complete(toolCallId)
}

export function resetToolUI(): void {
  registry.reset()
}

/**
 * 从历史 messages 里扫"未答的 tool call", 重新入队到 pending 队列.
 *
 * 用途:
 *   - 用户刷新页面 / 重开 app → useChat 内存态丢, 但 messages 已经持久化到 chatDB
 *   - 历史 messages 里如果有 input-available 但没 output 的 tool part, 说明用户
 *     还没回答 → 重新弹出 UI 让用户接着填
 *   - 内部去重 (tryEnqueue 会检查 toolCallId), 重复调用安全
 *
 * 调用时机:
 *   - useToolUI 注册 handler 后立即扫一次 (恢复属于这个 handler 的 pending)
 *   - useConversationLifecycle 加载完 messages 后扫一次 (覆盖切对话场景)
 */
export function restorePendingFromMessages(messages: readonly unknown[]): void {
  if (!Array.isArray(messages) || messages.length === 0) return

  // 只扫最后一条 assistant 消息 — pending tool 一定在最新一轮回复里, 老消息的 tool 早就答过了
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; parts?: Array<unknown> }
    if (msg?.role !== "assistant") continue

    for (const part of msg.parts ?? []) {
      const p = part as {
        type?: string
        state?: string
        toolCallId?: string
        input?: unknown
      }
      if (typeof p.type !== "string") continue
      if (!p.type.startsWith("tool-")) continue
      if (!p.toolCallId) continue
      // 仅 input-* 状态 (没拿到结果), 已经 output-* 的不再恢复
      if (p.state !== "input-available" && p.state !== "input-streaming") continue

      const toolName = p.type.slice("tool-".length)
      // 内部去重 + handler 检查; 没注册 handler 时直接返 false 不影响
      registry.tryEnqueue({
        toolCallId: p.toolCallId,
        toolName,
        input: p.input,
      })
    }
    return // 找到最后一条 assistant 就停
  }
}
