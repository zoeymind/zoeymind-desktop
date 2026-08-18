/**
 * tRPC 桌面端 no-op stub。
 *
 * 产品仓的 mindmap features 目前有 60+ 处 `trpc.*.useQuery` / `.useMutation`。
 * 桌面端所有网络路由都要重接到本地 SqlProjectRepo / SqlFolderRepo / 直连 provider。
 * 中间态先给一个"处处返回空态"的 Proxy 承接，避免每个 call site 编译失败；
 * 具体 hook 替换完成后 stub 剩余的 call sites 应该只在被禁用的功能里。
 *
 * 语义：
 *   - `trpc.<anything>` → 无穷嵌套代理
 *   - `.useQuery(...)` / `.useInfiniteQuery(...)` / `.useSuspenseQuery(...)` → QueryResult
 *   - `.useMutation(...)` → MutationResult
 *   - `.useSubscription(...)` → { data, status }
 *   - `trpc.useUtils()` → 同款嵌套代理，`.invalidate()` 是 no-op
 *   - `trpcClient.<x>.query/mutate(...)` → 空 Promise
 */

const NOOP = (): void => undefined
const NOOP_ASYNC = async (): Promise<undefined> => undefined

interface QueryResult {
  data: unknown
  isLoading: boolean
  isPending: boolean
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
  error: unknown
  refetch: () => Promise<undefined>
  status: string
}

interface MutationResult {
  mutate: (input?: unknown) => void
  mutateAsync: (input?: unknown) => Promise<undefined>
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  error: unknown
  reset: () => void
  status: string
}

/**
 * `TrpcLike` 允许在任意深度取键或作为函数调用，返回同类型；用于承接
 * 产品仓那些 `trpc.mindmap.foo.useQuery(input)` 的动态形状。call site
 * 逐步替换为本地 repo 后，这个类型可以随 stub 一起下线。
 */
export interface TrpcLike {
  (...args: unknown[]): TrpcLike
  [key: string]: TrpcLike
}

function queryResult(): QueryResult {
  return {
    data: undefined,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isSuccess: false,
    isError: false,
    error: null,
    refetch: NOOP_ASYNC,
    status: 'idle'
  }
}

function mutationResult(): MutationResult {
  return {
    mutate: NOOP,
    mutateAsync: NOOP_ASYNC,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: NOOP,
    status: 'idle'
  }
}

const LEAF_QUERY: Record<string, true> = {
  useQuery: true,
  useInfiniteQuery: true,
  useSuspenseQuery: true
}
const LEAF_MUTATION: Record<string, true> = { useMutation: true }
const NOOP_ASYNC_METHODS: Record<string, true> = {
  invalidate: true,
  reset: true,
  setData: true,
  cancel: true,
  query: true,
  mutate: true
}

function nestedProxy(): TrpcLike {
  const proxied = new Proxy(() => undefined, {
    get(_target, prop): unknown {
      if (typeof prop === 'symbol') return undefined
      if (LEAF_QUERY[prop]) return () => queryResult()
      if (LEAF_MUTATION[prop]) return () => mutationResult()
      if (prop === 'useSubscription') return () => ({ data: undefined, status: 'idle' })
      if (NOOP_ASYNC_METHODS[prop]) return NOOP_ASYNC
      return nestedProxy()
    },
    apply(): unknown {
      return nestedProxy()
    }
  })
  return proxied as unknown as TrpcLike
}

export const trpc = new Proxy({}, {
  get(_target, prop): unknown {
    if (prop === 'useUtils') return nestedProxy
    if (typeof prop === 'symbol') return undefined
    return nestedProxy()
  }
}) as unknown as TrpcLike

export const trpcClient = nestedProxy()

/** 产品仓里少数地方直接 import 类型 `RouterOutputs`；桌面端给个占位。 */
export type RouterOutputs = Record<string, unknown>
