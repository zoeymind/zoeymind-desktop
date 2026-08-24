/**
 * 桌面端 AI Chat 面板 —— 从 models.json 读 provider/model, 通过 Rust
 * chat_stream 流式对话, SQLite chat_conversations/chat_messages 持久化.
 *
 * 特性:
 *   - 模型选择器 (dropdown 显示所有 cfg.models, 按 provider 分组)
 *   - 消息列表 (user/assistant 气泡), assistant 流式追加
 *   - 输入框 + 发送/停止按钮 (Ctrl/Cmd+Enter 发送)
 *   - 会话切换 (侧边 dropdown), '+' 新建, '×' 删除
 *   - 无消息时空态; 无模型时引导去设置
 *
 * 数据流:
 *   sendMessage -> appendMessage(user) -> streamChat -> onDelta 累积 ->
 *   onDone appendMessage(assistant) -> 清空 streaming state
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import {
  ChevronDown,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  StopCircle,
  Trash2,
} from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Textarea,
  cn,
} from "@zoeymind/ui"
import { logger } from "@zoeymind/logger"
import {
  chatRepo,
  loadModelsConfig,
  streamChat,
  type ChatConversationRow,
  type ChatMessageRow,
  type ModelsConfig,
  type ModelProvider,
  type StreamChatHandle,
} from "@/shared/native"
import { toast } from "@/shared/app-shared"
import { useProjectContext } from "@/products/mind/features/mindmap/contexts/project-context"

interface DesktopAIPanelProps {
  isActive?: boolean
}

interface ModelOption {
  key: string // provider.id + '::' + model.name
  provider: ModelProvider
  modelName: string
  label: string
  maxOutputTokens?: number
}

const LAST_MODEL_KEY = "zm.desktopChat.lastModelKey"

export function DesktopAIPanel({ isActive }: DesktopAIPanelProps): ReactElement | null {
  const { workspaceId } = useProjectContext()
  const [cfg, setCfg] = useState<ModelsConfig | null>(null)
  const [conversations, setConversations] = useState<ChatConversationRow[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [streaming, setStreaming] = useState<string | null>(null) // in-progress assistant text
  const [sending, setSending] = useState(false)
  const [modelKey, setModelKey] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const streamHandleRef = useRef<StreamChatHandle | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Load config on mount
  useEffect(() => {
    void loadModelsConfig().then(setCfg)
  }, [])

  // Load conversations for this project
  useEffect(() => {
    void chatRepo.listConversations(workspaceId ?? null).then(rows => {
      setConversations(rows)
      setCurrentConvId(current => current ?? rows[0]?.id ?? null)
    })
  }, [workspaceId])

  // Load messages of current conversation
  useEffect(() => {
    const request = currentConvId
      ? chatRepo.listMessages(currentConvId)
      : Promise.resolve([] as ChatMessageRow[])
    void request.then(setMessages)
  }, [currentConvId])

  // Model list
  const modelOptions: ModelOption[] = useMemo(() => {
    if (!cfg) return []
    return cfg.models.flatMap(m => {
      const provider = cfg.providers.find(p => p.id === m.providerId)
      if (!provider) return []
      return [
        {
          key: `${provider.id}::${m.name}`,
          provider,
          modelName: m.name,
          label: m.alias,
          maxOutputTokens: m.maxOutputTokens,
        },
      ]
    })
  }, [cfg])

  // Restore last selected model, fall back to first
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved =
        typeof localStorage !== "undefined" ? localStorage.getItem(LAST_MODEL_KEY) : null
      const found = saved && modelOptions.find(option => option.key === saved)
      setModelKey(found ? found.key : (modelOptions[0]?.key ?? null))
    })
    return () => cancelAnimationFrame(frame)
  }, [modelOptions])

  useEffect(() => {
    if (modelKey && typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_MODEL_KEY, modelKey)
    }
  }, [modelKey])

  // Auto-scroll on messages/streaming change
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  const currentModel = useMemo(
    () => modelOptions.find(o => o.key === modelKey) ?? null,
    [modelOptions, modelKey]
  )

  // Group model options by provider for the picker
  const modelGroups = useMemo(() => {
    const groups = new Map<string, ModelOption[]>()
    for (const opt of modelOptions) {
      const key = opt.provider.id
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(opt)
    }
    return groups
  }, [modelOptions])

  const providerLabel = (provider: ModelProvider): string => provider.name

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (currentConvId) return currentConvId
    const conv = await chatRepo.createConversation(workspaceId ?? null, "新对话")
    setConversations(prev => [conv, ...prev])
    setCurrentConvId(conv.id)
    return conv.id
  }, [currentConvId, workspaceId])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    if (!currentModel) {
      toast.error("请先在设置里配置并勾选模型")
      return
    }

    setSending(true)
    setInput("")
    let assistantAccum = ""
    try {
      const convId = await ensureConversation()
      const userMsg = await chatRepo.appendMessage(convId, "user", text)
      setMessages(prev => [...prev, userMsg])
      setStreaming("")

      // 第一次发送: 用 user 首句前 30 字自动改标题
      if (messages.length === 0) {
        const title = text.slice(0, 30)
        await chatRepo.renameConversation(convId, title)
        setConversations(prev => prev.map(c => (c.id === convId ? { ...c, title } : c)))
      }

      // Build message history (with the new user msg)
      const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
        ...messages
          .filter(m => m.role === "user" || m.role === "assistant" || m.role === "system")
          .map(m => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })),
        { role: "user" as const, content: text },
      ]

      const handle = await streamChat({
        provider: currentModel.provider,
        model: currentModel.modelName,
        messages: history,
        maxTokens: currentModel.maxOutputTokens,
        onDelta: delta => {
          assistantAccum += delta
          setStreaming(assistantAccum)
        },
        onDone: async () => {
          const finalText = assistantAccum
          const assistantMsg = await chatRepo.appendMessage(convId, "assistant", finalText)
          setMessages(prev => [...prev, assistantMsg])
          setStreaming(null)
          setSending(false)
          streamHandleRef.current = null
        },
        onError: msg => {
          toast.error(`AI 响应失败: ${msg}`)
          logger.error("desktop chat error", msg)
          setStreaming(null)
          setSending(false)
          streamHandleRef.current = null
        },
      })
      streamHandleRef.current = handle
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`发送失败: ${msg}`)
      setStreaming(null)
      setSending(false)
    }
  }, [currentModel, ensureConversation, input, messages])

  const stopStreaming = useCallback(async () => {
    const handle = streamHandleRef.current
    if (!handle) return
    await handle.abort()
    // 抢救: 若已经积累了部分文本, 存下来
    if (streaming && streaming.length > 0 && currentConvId) {
      const msg = await chatRepo.appendMessage(currentConvId, "assistant", streaming)
      setMessages(prev => [...prev, msg])
    }
    setStreaming(null)
    setSending(false)
    streamHandleRef.current = null
  }, [currentConvId, streaming])

  const newConversation = useCallback(async () => {
    const conv = await chatRepo.createConversation(workspaceId ?? null, "新对话")
    setConversations(prev => [conv, ...prev])
    setCurrentConvId(conv.id)
    setMessages([])
  }, [workspaceId])

  const removeConversation = useCallback(
    async (id: string) => {
      await chatRepo.deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (currentConvId === id) {
        setCurrentConvId(null)
        setMessages([])
      }
    },
    [currentConvId]
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      void sendMessage()
    }
  }

  if (!isActive) return null

  const hasModels = modelOptions.length > 0
  const currentConv = conversations.find(c => c.id === currentConvId) ?? null

  return (
    <div
      className={cn(
        "fixed top-12 right-4 z-10 flex h-[calc(100vh-96px)] w-[380px] flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <ConversationPicker
          conversations={conversations}
          currentId={currentConvId}
          currentTitle={currentConv?.title ?? "新对话"}
          onSelect={setCurrentConvId}
          onNew={newConversation}
          onDelete={removeConversation}
        />
        <div className="flex-1" />
        <Button variant="ghost" size="icon-xs" title="新建会话" onClick={newConversation}>
          <MessageSquarePlus className="size-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !streaming && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Sparkles className="size-8 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">
              和 AI 讨论你的思维导图.
              {!hasModels && " 先到设置配置模型."}
            </p>
          </div>
        )}
        {messages.map(m => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streaming !== null && <MessageBubble role="assistant" content={streaming} streaming />}
      </div>

      {/* Input */}
      <div className="border-t bg-muted/20 p-3">
        <div className="mb-2 flex items-center gap-2">
          <ModelPicker
            options={modelOptions}
            groups={modelGroups}
            providers={cfg?.providers ?? []}
            providerLabel={providerLabel}
            currentKey={modelKey}
            currentLabel={currentModel?.label ?? "选择模型"}
            onSelect={setModelKey}
          />
        </div>
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={hasModels ? "发消息 (Cmd/Ctrl+Enter)" : "先在设置里配置模型"}
          className="min-h-16 resize-none"
          disabled={!hasModels}
        />
        <div className="mt-2 flex justify-end gap-2">
          {sending ? (
            <Button size="sm" variant="destructive" onClick={stopStreaming}>
              <StopCircle className="mr-1 size-3.5" />
              停止
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void sendMessage()}
              disabled={!hasModels || !input.trim()}
            >
              <Send className="mr-1 size-3.5" />
              发送
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: ChatMessageRow["role"]
  content: string
  streaming?: boolean
}): ReactElement {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground">
          <MarkdownishText content={content} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-foreground",
          streaming && "ring-1 ring-primary/30"
        )}
      >
        <MarkdownishText content={content} />
        {streaming && (
          <Loader2 className="ml-1 inline-block size-3 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  )
}

/** 最小 markdown: 保留换行和代码块 (```...```). 不引 react-markdown 减少依赖. */
function MarkdownishText({ content }: { content: string }): ReactElement {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3).replace(/^[\w-]*\n/, "")
          return (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed"
            >
              {inner}
            </pre>
          )
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part}
          </span>
        )
      })}
    </>
  )
}

interface ConversationPickerProps {
  conversations: ChatConversationRow[]
  currentId: string | null
  currentTitle: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function ConversationPicker({
  conversations,
  currentId,
  currentTitle,
  onSelect,
  onNew,
  onDelete,
}: ConversationPickerProps): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="flex min-w-0 flex-1 items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs hover:bg-muted/60"
            title="切换会话"
          >
            <span className="truncate font-medium">{currentTitle || "新对话"}</span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">会话</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {conversations.length === 0 && <DropdownMenuItem disabled>无会话</DropdownMenuItem>}
        {conversations.map(c => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn("flex items-center gap-2 text-xs", c.id === currentId && "bg-muted")}
          >
            <span className="flex-1 truncate">{c.title || "未命名"}</span>
            <button
              className="text-muted-foreground hover:text-destructive"
              onClick={e => {
                e.stopPropagation()
                onDelete(c.id)
              }}
              title="删除"
            >
              <Trash2 className="size-3" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNew} className="text-xs">
          <MessageSquarePlus className="mr-2 size-3.5" />
          新建会话
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ModelPickerProps {
  options: ModelOption[]
  groups: Map<string, ModelOption[]>
  providers: ModelProvider[]
  providerLabel: (provider: ModelProvider) => string
  currentKey: string | null
  currentLabel: string
  onSelect: (key: string) => void
}

function ModelPicker({
  options,
  groups,
  providers,
  providerLabel,
  currentKey,
  currentLabel,
  onSelect,
}: ModelPickerProps): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50"
            disabled={options.length === 0}
          >
            <span className="max-w-[220px] truncate font-mono">{currentLabel}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="max-h-96 w-64 overflow-y-auto">
        {options.length === 0 && <DropdownMenuItem disabled>请先在设置里勾选模型</DropdownMenuItem>}
        {providers.map(p => {
          const opts = groups.get(p.id) ?? []
          if (opts.length === 0) return null
          return (
            <div key={p.id}>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {providerLabel(p)}
              </DropdownMenuLabel>
              {opts.map(o => (
                <DropdownMenuItem
                  key={o.key}
                  onClick={() => onSelect(o.key)}
                  className={cn("font-mono text-xs", o.key === currentKey && "bg-muted")}
                >
                  {o.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
