/**
 * 桌面端流式 AI Chat 客户端 —— 走 Rust invoke + Tauri event listen.
 *
 * 用法:
 *   const stop = await streamChat({ providerId, model, messages, onDelta, onDone, onError })
 *   stop()  // 中止
 */
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { createUUID } from '@/shared/app-shared'
import type { ModelProvider } from './models-config'

export interface StreamChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamChatOptions {
  provider: ModelProvider
  model: string
  messages: StreamChatMessage[]
  temperature?: number
  maxTokens?: number
  onDelta?: (text: string) => void
  onDone?: (finishReason: string) => void
  onError?: (message: string) => void
}

export interface StreamChatHandle {
  requestId: string
  abort: () => Promise<void>
}

interface DeltaEvent {
  payload: { text: string }
}
interface DoneEvent {
  payload: { finish_reason: string }
}
interface ErrorEvent {
  payload: { message: string }
}

export async function streamChat(opts: StreamChatOptions): Promise<StreamChatHandle> {
  const requestId = createUUID()
  const unlisten: UnlistenFn[] = []

  const cleanup = () => {
    for (const fn of unlisten) {
      try {
        fn()
      } catch {
        /* ignore */
      }
    }
    unlisten.length = 0
  }

  unlisten.push(
    await listen<DeltaEvent['payload']>(`chat:${requestId}:delta`, event => {
      opts.onDelta?.(event.payload.text)
    })
  )
  unlisten.push(
    await listen<DoneEvent['payload']>(`chat:${requestId}:done`, event => {
      opts.onDone?.(event.payload.finish_reason)
      cleanup()
    })
  )
  unlisten.push(
    await listen<ErrorEvent['payload']>(`chat:${requestId}:error`, event => {
      opts.onError?.(event.payload.message)
      cleanup()
    })
  )

  try {
    await invoke('chat_stream', {
      req: {
        requestId,
        provider: {
          kind: opts.provider.kind,
          baseURL: opts.provider.baseURL,
          apiKey: opts.provider.apiKey
        },
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens
      }
    })
  } catch (err) {
    cleanup()
    const msg = err instanceof Error ? err.message : String(err)
    opts.onError?.(msg)
    throw err
  }

  return {
    requestId,
    abort: async () => {
      try {
        await invoke('chat_stream_abort', { requestId })
      } finally {
        cleanup()
      }
    }
  }
}
