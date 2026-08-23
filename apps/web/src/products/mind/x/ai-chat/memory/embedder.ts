/**
 * Embedder — 浏览器内嵌入向量生成 (基于 transformers.js).
 *
 * 模型: `Xenova/all-MiniLM-L6-v2` (量化版 ~22MB), 输出 384 维归一化向量,
 * 中英文 OK. 首次加载会自动下载 + 缓存到浏览器 (HTTP cache + IndexedDB).
 *
 * 状态机:
 *   idle → downloading-model → loading-model → ready
 *                ↓ (error)            ↓ (error)
 *               error                error
 *
 * 设计要点:
 *   - 单例 pipeline, 全局共享一个 extractor 实例
 *   - 监听 transformers.js 的 progress_callback, 把"下载 / 加载"两个阶段
 *     合成一个 status 状态机
 *   - 不阻塞 UI: getEmbedding() 在 ready 之前返 null, 调用方自己决定要不要 wait
 */
import { logger } from "@zoeymind/logger"
import { getMirrorHost } from "./settings"
import { describeModelLoadError } from "./model-load-error"
import type { FeatureExtractionPipeline } from "@huggingface/transformers"

type TransformersModule = typeof import("@huggingface/transformers")

let transformersModule: Promise<TransformersModule> | null = null

/**
 * 动态加载 transformers.js. 库本体(含 onnxruntime 绑定)重 ~500KB minified,
 * 静态打包会进启动路径; 只有用户真正启用 AI 长期记忆并触发首次 load() 才需要.
 * Vite 会把 dynamic import 拆成独立 chunk, 首屏不付这笔解析成本.
 */
function loadTransformers(): Promise<TransformersModule> {
  if (!transformersModule) {
    transformersModule = import("@huggingface/transformers")
  }
  return transformersModule
}

/**
 * 配置模型下载来源.
 *   - 默认 'https://huggingface.co/', 国内访问被墙
 *   - hf-mirror.com 是社区维护的 huggingface.co 全镜像, 国内可访问
 *   - 自托管: env.remoteHost 指向自家 CDN (需要先 mirror 一份模型文件)
 * 在 settings 里允许用户切换, 默认走 hf-mirror.com 兼容国内
 */
function applyMirrorConfig(mod: Pick<TransformersModule, "env">) {
  const host = getMirrorHost()
  mod.env.remoteHost = host
  // wasm 文件也要走镜像 (transformers.js 默认从 jsdelivr CDN 拉, 国内一般 OK; 保留默认)
  // env.backends.onnx.wasm.wasmPaths 不动
}

const MODEL_ID = "Xenova/all-MiniLM-L6-v2"

/** 384 维, 跟 MiniLM-L6 一致 */
export const EMBEDDING_DIMENSION = 384

export type EmbedderStatus =
  | { kind: "idle" }
  | { kind: "downloading-model"; progress: number; loadedBytes: number; totalBytes: number }
  | { kind: "loading-model" }
  | { kind: "ready" }
  | { kind: "error"; message: string }

type Listener = (status: EmbedderStatus) => void

class Embedder {
  private extractor: FeatureExtractionPipeline | null = null
  private loading: Promise<FeatureExtractionPipeline | null> | null = null
  private status: EmbedderStatus = { kind: "idle" }
  private listeners = new Set<Listener>()

  /** 监听状态变化, 返回 unsubscribe */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => this.listeners.delete(listener)
  }

  getStatus(): EmbedderStatus {
    return this.status
  }

  /**
   * 加载模型 (idempotent). 首次调用触发下载, 后续直接复用单例.
   * 返回 extractor (已 ready) 或 null (加载失败).
   */
  async load(): Promise<FeatureExtractionPipeline | null> {
    if (this.extractor) return this.extractor
    if (this.loading) return this.loading

    this.loading = this.doLoad()
    return this.loading
  }

  private async doLoad(): Promise<FeatureExtractionPipeline | null> {
    try {
      // 动态 import 在此 await — 模块求值成本只由真正启用记忆的用户支付
      const { env, pipeline } = await loadTransformers()
      // 应用镜像配置 — 每次 load 都重读, 用户改了 settings 后下次 retry 立刻生效
      applyMirrorConfig({ env })
      this.setStatus({ kind: "loading-model" })
      const ext = (await pipeline("feature-extraction", MODEL_ID, {
        progress_callback: (data: unknown) => this.handleProgress(data),
      })) as FeatureExtractionPipeline

      this.extractor = ext
      this.setStatus({ kind: "ready" })
      logger.info("[Embedder] 模型加载完成", { model: MODEL_ID })
      return ext
    } catch (error) {
      const message = describeModelLoadError(error)
      logger.error("[Embedder] 模型加载失败", { error: message })
      this.setStatus({ kind: "error", message })
      this.loading = null // 允许重试
      return null
    }
  }

  /**
   * 给一段文本算 embedding. 模型未就绪时返 null (调用方决定要不要先 await load()).
   * 384 维 Float32 归一化向量, 内积 = cosine similarity.
   */
  async embed(text: string): Promise<Float32Array | null> {
    if (!this.extractor) return null
    if (!text || !text.trim()) return null

    try {
      const output = await this.extractor(text.trim(), {
        pooling: "mean",
        normalize: true,
      })
      // output.data 是 Float32Array, length = 384
      return output.data as Float32Array
    } catch (error) {
      logger.warn("[Embedder] embed 失败", {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /** 重置 (用于"清空记忆"按钮 - 实际上不卸载模型, 只清下游 vectorStore). 状态保持 ready. */
  // 注: 真要卸载模型 transformers.js 没暴露 API, 直接刷新页面更稳, 我们这里只清缓存.

  private handleProgress(data: unknown): void {
    const evt = data as {
      status?: string
      file?: string
      progress?: number
      loaded?: number
      total?: number
    }
    if (!evt || typeof evt !== "object") return

    // transformers.js 的 progress 事件:
    //   - status: 'initiate' | 'download' | 'progress' | 'done' | 'ready'
    //   - file: model file 名
    //   - progress: 0..100 (注意: 是百分比, 不是 0..1)
    //   - loaded / total: bytes
    if (evt.status === "download" || evt.status === "progress") {
      const progress = typeof evt.progress === "number" ? evt.progress / 100 : 0
      this.setStatus({
        kind: "downloading-model",
        progress: Math.min(Math.max(progress, 0), 1),
        loadedBytes: evt.loaded ?? 0,
        totalBytes: evt.total ?? 0,
      })
    }
    // 'initiate' / 'done' 阶段不切状态, 让 doLoad 的 'loading-model' 持续到 ready
  }

  private setStatus(status: EmbedderStatus): void {
    this.status = status
    for (const l of this.listeners) l(status)
  }
}

export const embedder = new Embedder()
