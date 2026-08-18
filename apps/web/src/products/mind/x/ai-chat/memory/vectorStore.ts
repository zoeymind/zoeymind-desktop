/**
 * 向量检索 — 在 IndexedDB 全量 messageEmbeddings 上做 cosine top-K.
 *
 * 数据规模假设: 单用户单浏览器累计千级消息, 全量加载到内存做 cosine 即可, 不引 IndexedDB index.
 * 1000 条 × 384 dim × 4 bytes ≈ 1.5 MB / cosine 计算 < 5 ms, 完全可承受.
 *
 * 嵌入是已归一化的 (embedder 里 normalize: true), 所以余弦相似度 = 点积.
 */

import { chatDB, type MessageEmbedding } from '../storage/chatDB'

export interface MemoryHit {
  /** 命中分数, 已归一化向量的点积 ∈ [-1, 1] */
  score: number
  entry: MessageEmbedding
}

/**
 * cosine top-K. embeddings 都是 normalize 过的 Float32Array, 直接点积即可.
 *
 * @param query  query embedding (归一化)
 * @param k      top-K
 * @param excludeMessageIds  排除集 (通常是 messages 数组里"最近 N 条"的 id, 避免召回重复)
 * @param scoreThreshold     最低分数门槛, 防止给 AI 灌进无关历史 (默认 0.45)
 */
export async function searchSimilar(
  query: Float32Array,
  k: number,
  excludeMessageIds: Set<string>,
  scoreThreshold = 0.45
): Promise<MemoryHit[]> {
  const all = await chatDB.getAllMessageEmbeddings()
  if (all.length === 0) return []

  const dim = query.length
  const hits: MemoryHit[] = []
  for (const entry of all) {
    if (excludeMessageIds.has(entry.messageId)) continue
    if (entry.embedding.length !== dim) continue
    let score = 0
    for (let i = 0; i < dim; i++) {
      score += query[i] * entry.embedding[i]
    }
    if (score < scoreThreshold) continue
    hits.push({ score, entry })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, k)
}

/**
 * Float32Array → 普通 number[] (供 IndexedDB 写入).
 * structuredClone 能 clone Float32Array, 但为了类型稳定我们存 number[].
 */
export function toStoredVector(vec: Float32Array): number[] {
  return Array.from(vec)
}

/** 反向: number[] → Float32Array */
export function fromStoredVector(vec: number[]): Float32Array {
  return Float32Array.from(vec)
}
