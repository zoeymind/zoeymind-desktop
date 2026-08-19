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
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { createUUID } from '@/shared/app-shared'

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
  const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const headers: Record<string, string> = {}
  const hdr = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  hdr.forEach((v, k) => {
    headers[k] = v
  })

  let bodyStr: string | undefined
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body === 'string') {
      bodyStr = init.body
    } else if (init.body instanceof Uint8Array) {
      bodyStr = new TextDecoder().decode(init.body)
    } else if (init.body instanceof ArrayBuffer) {
      bodyStr = new TextDecoder().decode(init.body)
    } else if (init.body instanceof URLSearchParams) {
      bodyStr = init.body.toString()
    } else if (typeof (init.body as { text?: () => Promise<string> }).text === 'function') {
      bodyStr = await (init.body as unknown as Blob).text()
    } else {
      bodyStr = JSON.stringify(init.body)
    }
  } else if (input instanceof Request && input.body) {
    bodyStr = await input.text()
  }

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

  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
  let headResolve: ((h: HeadEventPayload) => void) | null = null
  let headReject: ((e: unknown) => void) | null = null
  const headPromise = new Promise<HeadEventPayload>((resolve, reject) => {
    headResolve = resolve
    headReject = reject
  })

  unlisten.push(
    await listen<HeadEventPayload>(`http:${requestId}:head`, event => {
      headResolve?.(event.payload)
    })
  )
  unlisten.push(
    await listen<ChunkEventPayload>(`http:${requestId}:chunk`, event => {
      if (!controllerRef) return
      try {
        controllerRef.enqueue(base64ToUint8Array(event.payload.bytes))
      } catch {
        /* stream closed */
      }
    })
  )
  unlisten.push(
    await listen<Record<string, never>>(`http:${requestId}:done`, () => {
      try {
        controllerRef?.close()
      } catch {
        /* already closed */
      }
      cleanup()
    })
  )
  unlisten.push(
    await listen<ErrorEventPayload>(`http:${requestId}:error`, event => {
      const err = new Error(event.payload.message)
      if (controllerRef) {
        try {
          controllerRef.error(err)
        } catch {
          /* already closed */
        }
      } else {
        headReject?.(err)
      }
      cleanup()
    })
  )

  // AbortSignal: 触发 Rust 侧取消 + 关流
  const onAbort = () => {
    void invoke('http_stream_abort', { requestId }).catch(() => undefined)
    try {
      controllerRef?.close()
    } catch {
      /* ignore */
    }
    cleanup()
  }
  init?.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    await invoke('http_stream_start', {
      req: {
        requestId,
        url,
        method,
        headers,
        body: bodyStr
      }
    })
  } catch (err) {
    cleanup()
    throw err
  }

  const head = await headPromise
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
    },
    cancel() {
      onAbort()
    }
  })

  return new Response(body, {
    status: head.status,
    headers: new Headers(head.headers)
  })
}
