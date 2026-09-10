/**
 * nativeFetch —— fetch shim, 请求走 tauri invoke 到 Rust reqwest, 绕开浏览器 CORS.
 *
 * 用于给 AI SDK provider (createOpenAI({fetch: nativeFetch}) / createAnthropic({fetch})
 * / createGoogle({fetch})) 提供一个可跨域的 fetch, 让 streamText 直接跑在前端.
 *
 * 实现:
 *   1. invoke http_stream_start(requestId, url, method, headers, body)
 *   2. 监听 http:{id}:head -> 拿到 status + headers, 构造 Response, 初始化 body ReadableStream
 *   3. 监听 http:{id}:chunk -> base64 解码, controller.enqueue(bytes)
 *   4. 监听 http:{id}:done -> controller.close()
 *   5. 监听 http:{id}:error -> controller.error(...)
 *   6. AbortSignal -> invoke http_stream_abort, 关流
 */
import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { createUUID } from "@/shared/app-shared"

interface HeadEventPayload {
  status: number
  headers: Record<string, string>
}
interface ChunkEventPayload {
  bytes: string // base64
}
interface ErrorEventPayload {
  message: string
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const nativeFetch: typeof fetch = async (input, init) => {
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  signal?.throwIfAborted()
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
  const headers: Record<string, string> = {}
  const hdr = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  hdr.forEach((v, k) => {
    headers[k] = v
  })

  let bodyStr: string | undefined
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body === "string") {
      bodyStr = init.body
    } else if (init.body instanceof Uint8Array) {
      bodyStr = new TextDecoder().decode(init.body)
    } else if (init.body instanceof ArrayBuffer) {
      bodyStr = new TextDecoder().decode(init.body)
    } else if (init.body instanceof URLSearchParams) {
      bodyStr = init.body.toString()
    } else if (typeof (init.body as { text?: () => Promise<string> }).text === "function") {
      bodyStr = await (init.body as unknown as Blob).text()
    } else {
      bodyStr = JSON.stringify(init.body)
    }
  } else if (input instanceof Request && input.body) {
    bodyStr = await input.text()
  }

  signal?.throwIfAborted()
  const requestId = createUUID()
  const unlisten: UnlistenFn[] = []
  let resolveResponse!: (response: Response) => void
  let rejectResponse!: (error: unknown) => void
  const responsePromise = new Promise<Response>((resolve, reject) => {
    resolveResponse = resolve
    rejectResponse = reject
  })
  let finished = false
  let started = false
  let hasHeaders = false
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const cleanup = () => {
    signal?.removeEventListener("abort", onAbort)
    for (const dispose of unlisten.splice(0)) dispose()
  }
  const fail = (error: unknown) => {
    if (finished) return
    finished = true
    rejectResponse(error)
    controller.error(error)
    cleanup()
  }
  const abortNative = () => {
    if (started) void invoke("http_stream_abort", { requestId }).catch(() => undefined)
  }
  const onAbort = () => {
    if (finished) return
    abortNative()
    fail(signal?.reason ?? new DOMException("The request was aborted", "AbortError"))
  }
  // Buffer immediately: native head/chunk/done events can arrive in the same task.
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    },
    cancel() {
      if (finished) return
      finished = true
      abortNative()
      cleanup()
    },
  })
  signal?.addEventListener("abort", onAbort, { once: true })
  if (signal?.aborted) onAbort()

  const subscribe = async <T>(event: string, callback: (payload: T) => void) => {
    if (finished) return
    const dispose = await listen<T>(`http:${requestId}:${event}`, event => {
      if (!finished) callback(event.payload)
    })
    if (finished) dispose()
    else unlisten.push(dispose)
  }
  const start = async () => {
    await subscribe<HeadEventPayload>("head", head => {
      try {
        const nullBody = method === "HEAD" || [204, 205, 304].includes(head.status)
        resolveResponse(new Response(nullBody ? null : body, head))
        hasHeaders = true
      } catch (error) {
        abortNative()
        fail(error)
      }
    })
    await subscribe<ChunkEventPayload>("chunk", chunk => {
      try {
        controller.enqueue(base64ToUint8Array(chunk.bytes))
      } catch (error) {
        abortNative()
        fail(error)
      }
    })
    await subscribe("done", () => {
      if (!hasHeaders) {
        fail(new Error("HTTP stream ended before response headers"))
        return
      }
      finished = true
      controller.close()
      cleanup()
    })
    await subscribe<ErrorEventPayload>("error", error => fail(new Error(error.message)))
    if (finished) return
    started = true
    await invoke("http_stream_start", {
      req: { requestId, url, method, headers, body: bodyStr },
    })
    // Abort may race with native registration while the start command is in flight.
    if (signal?.aborted) abortNative()
  }
  void start().catch(fail)
  return responsePromise
}
