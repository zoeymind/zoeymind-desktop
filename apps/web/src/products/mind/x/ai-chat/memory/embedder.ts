// @ts-nocheck — dormant AI chat / MCP module (memory 索引在桌面端不启用)
/**
 * Embedder —— 桌面端不接嵌入模型。@huggingface/transformers 22MB 首次下载
 * 且要走 hf-mirror，用户体验重。桌面端 AI Chat 先只做对话，不做长期记忆索引。
 *
 * 保留原表面 (`getEmbedding` / `getEmbedderStatus` / `warmupEmbedder`) 让消费方
 * 编译无改。全部返回 idle/null。
 */

export type EmbedderStatus = 'idle' | 'downloading-model' | 'loading-model' | 'ready' | 'error'

export function getEmbedderStatus(): { status: EmbedderStatus; progress: number; error: string | null } {
  return { status: 'idle', progress: 0, error: null }
}

export async function warmupEmbedder(): Promise<void> {
  // no-op
}

export async function getEmbedding(_text: string): Promise<number[] | null> {
  return null
}

export function subscribeEmbedderStatus(_listener: (s: unknown) => void): () => void {
  return () => undefined
}

/** dormant 单例; getEmbedding 直接返 null. */
export const embedder = {
  async embed(_text: string): Promise<number[] | null> { return null },
  getStatus(): { status: EmbedderStatus; progress: number; error: string | null } {
    return { status: 'idle', progress: 0, error: null }
  }
}
