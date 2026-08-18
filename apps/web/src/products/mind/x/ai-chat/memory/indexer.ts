/**
 * 索引器 — 把消息 embed 后存入 IndexedDB.
 *
 * 调用入口:
 *   - 实时索引: useConversationLifecycle 防抖保存消息后, 增量 embed 新消息
 *   - 回填索引: 用户首次开启长期记忆时, 后台慢慢 embed 之前的全部历史
 *
 * 都通过 indexer.enqueue(...) 入队, 内部串行执行 (避免并发抢模型), 不阻塞 UI.
 */

import { embedder } from './embedder'
import { toStoredVector } from './vectorStore'
import { chatDB, type MessageEmbedding } from '../storage/chatDB'
import { getMemoryEnabled } from './settings'
import { logger } from '@zoeymind/logger'
import type { UIMessage } from '@ai-sdk/react'

interface IndexTask {
  message: UIMessage
  conversationId: string
}

type ProgressListener = (state: BackfillState) => void

export interface BackfillState {
  /** 是否正在回填 */
  active: boolean
  current: number
  total: number
}

class Indexer {
  private queue: IndexTask[] = []
  private processing = false
  private backfillState: BackfillState = { active: false, current: 0, total: 0 }
  private listeners = new Set<ProgressListener>()

  /** 监听回填进度 */
  subscribe(l: ProgressListener): () => void {
    this.listeners.add(l)
    l(this.backfillState)
    return () => this.listeners.delete(l)
  }

  getBackfillState(): BackfillState {
    return this.backfillState
  }

  /** 入队一条消息, 异步消费 (调用方 fire-and-forget) */
  enqueue(message: UIMessage, conversationId: string): void {
    if (!getMemoryEnabled()) return
    this.queue.push({ message, conversationId })
    void this.processQueue()
  }

  /** 入队整条对话的所有消息 (回填用), 跳过已索引的 messageId */
  async backfill(messages: ChatMessageLike[]): Promise<void> {
    if (!getMemoryEnabled()) return
    if (messages.length === 0) return

    const indexed = await chatDB.getIndexedMessageIds()
    const pending = messages.filter(m => !indexed.has(m.id))
    if (pending.length === 0) return

    this.backfillState = { active: true, current: 0, total: pending.length }
    this.emit()

    for (let i = 0; i < pending.length; i++) {
      const m = pending[i]
      await this.indexOne({ message: m as UIMessage, conversationId: m.conversationId })
      this.backfillState = { active: true, current: i + 1, total: pending.length }
      this.emit()
    }

    this.backfillState = { active: false, current: pending.length, total: pending.length }
    this.emit()
    logger.info('[Indexer] 回填完成', { count: pending.length })
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true
    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift()!
        await this.indexOne(task)
      }
    } finally {
      this.processing = false
    }
  }

  private async indexOne(task: IndexTask): Promise<void> {
    const text = extractText(task.message)
    if (!text.trim()) return

    // 跳过已索引
    const existing = await chatDB.getIndexedMessageIds()
    if (existing.has(task.message.id)) return

    // 确保模型 ready
    if (embedder.getStatus().kind !== 'ready') {
      const loaded = await embedder.load()
      if (!loaded) return
    }

    const vec = await embedder.embed(text)
    if (!vec) return

    const entry: MessageEmbedding = {
      messageId: task.message.id,
      conversationId: task.conversationId,
      role: task.message.role === 'user' ? 'user' : 'assistant',
      text: truncate(text, 2000),
      embedding: toStoredVector(vec),
      timestamp: Date.now()
    }
    await chatDB.putMessageEmbedding(entry)
  }

  private emit(): void {
    for (const l of this.listeners) l(this.backfillState)
  }
}

export const indexer = new Indexer()

interface ChatMessageLike extends UIMessage {
  conversationId: string
}

function extractText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n')
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}
