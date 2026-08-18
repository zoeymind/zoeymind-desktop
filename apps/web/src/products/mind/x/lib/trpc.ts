// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * 模块内部使用的 tRPC 类型入口。
 *
 * `@zoeymind/app-shared` 导出的 `trpc / trpcClient` 类型指向基座 `AppRouter`，其中不含
 * 本模块的顶层命名空间。这里在类型上把它们补回来 —— 运行时是同一份 proxy，
 * `trpc.mcp.list.useQuery(...)` 会正确转发。
 *
 * 具体路由的入参/返回不做静态绑定（那会把 apps/api 的编译上下文拉进本项目）。
 * 调用方用泛型参数声明期望形态：`useQuery<{ tools: Tool[] }>()`，缺省为 `unknown`。
 */
import { trpc as baseTrpc, trpcClient as baseTrpcClient } from '@/shared/app-shared'

interface QueryResult<TData> {
  data: TData | undefined
  isLoading: boolean
  isPending: boolean
  error: { message: string } | null
  refetch: () => void
}

interface MutationResult<TData, TInput> {
  mutate: (input?: TInput, opts?: Record<string, unknown>) => void
  mutateAsync: (input?: TInput, opts?: Record<string, unknown>) => Promise<TData>
  isPending: boolean
  isLoading: boolean
  error: { message: string } | null
  data: TData | undefined
}

/**
 * 任意 procedure 的结构面。泛型参数由调用方指定，未指定时为 `unknown`。
 */
interface AnyProcedure {
  useQuery: <TData = unknown, TInput = unknown>(
    input?: TInput,
    opts?: Record<string, unknown>
  ) => QueryResult<TData>
  useMutation: <TData = unknown, TInput = unknown>(
    opts?: Record<string, unknown>
  ) => MutationResult<TData, TInput>
  query: <TData = unknown, TInput = unknown>(input?: TInput) => Promise<TData>
  mutate: <TData = unknown, TInput = unknown>(input?: TInput) => Promise<TData>
  invalidate: (input?: unknown) => Promise<void>
}

type ModuleNamespace = Record<string, AnyProcedure>

interface ModuleNamespaces {
  aiV2: ModuleNamespace
  ghost: ModuleNamespace
  mcp: ModuleNamespace
  models: ModuleNamespace
  prompt: ModuleNamespace
  rag: ModuleNamespace
}

type BaseTrpc = typeof baseTrpc
type BaseTrpcClient = typeof baseTrpcClient

type BaseUtils = ReturnType<BaseTrpc['useUtils']>

type ExpandedTrpc = Omit<BaseTrpc, 'useUtils'> &
  ModuleNamespaces & {
    useUtils: () => BaseUtils & ModuleNamespaces
  }
type ExpandedTrpcClient = BaseTrpcClient & ModuleNamespaces

export const trpc = baseTrpc as unknown as ExpandedTrpc
export const trpcClient = baseTrpcClient as unknown as ExpandedTrpcClient