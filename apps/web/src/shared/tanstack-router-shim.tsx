/**
 * @tanstack/react-router 的最小兼容 shim ——
 * 桌面端全程用 react-router-dom；老组件里的 `useNavigate({ to: '/org/$orgId/...', params })`
 * 都由本 shim 收敛，走 template 展开后交给 react-router-dom 的 navigate。
 */
import {
  useNavigate as useRouterNavigate,
  useParams as useRouterParams,
  useLocation,
  useSearchParams as useReactSearchParams,
  Link as RouterLink,
  type LinkProps as RouterLinkProps
} from 'react-router-dom'
import { useMemo } from 'react'

interface NavigateOptions {
  to?: string
  params?: Record<string, string | number>
  search?: Record<string, string | number | boolean | undefined> | ((prev: unknown) => unknown)
  replace?: boolean
  hash?: string
  state?: unknown
}

function expandTemplate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  let out = template
  for (const [key, value] of Object.entries(params)) {
    // tanstack template uses `$key`
    out = out.replace(new RegExp(`\\$${key}\\b`, 'g'), String(value))
  }
  return out
}

export function useNavigate() {
  const nav = useRouterNavigate()
  return (opts: NavigateOptions | string) => {
    if (typeof opts === 'string') return nav(opts)
    const path = expandTemplate(opts.to ?? '', opts.params)
    return nav(path, { replace: opts.replace, state: opts.state })
  }
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useRouterParams() as T
}

export function useSearch<T extends Record<string, unknown> = Record<string, unknown>>(): T {
  const [sp] = useReactSearchParams()
  return useMemo(() => Object.fromEntries(sp.entries()) as T, [sp])
}

export function useRouter() {
  const nav = useRouterNavigate()
  const location = useLocation()
  return {
    navigate: (opts: NavigateOptions) => {
      const path = expandTemplate(opts.to ?? '', opts.params)
      return nav(path, { replace: opts.replace, state: opts.state })
    },
    state: { location }
  }
}

export function useMatchRoute() {
  return (_opts: unknown) => false
}

/** Link —— 兼容 tanstack `<Link to="/...">`；params/search 展开到 pathname */
export function Link(
  props: {
    to?: string
    params?: Record<string, string | number>
    search?: Record<string, string | number | boolean | undefined>
  } & Omit<RouterLinkProps, 'to'>
) {
  const { to = '', params, search: _search, ...rest } = props
  const href = expandTemplate(to, params)
  return <RouterLink to={href} {...rest} />
}

/** 兼容原产品 route module 结构下的 createFileRoute（桌面端不用文件路由，返回占位对象即可） */
export function createFileRoute(_id: string) {
  return function () {
    return {
      useNavigate,
      useParams,
      useSearch
    }
  }
}

/** 类型占位 —— 老代码里 `type LinkComponentProps` 之类的引用 */
export type LinkComponentProps = RouterLinkProps
