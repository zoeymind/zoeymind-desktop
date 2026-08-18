/**
 * 切换 org 时对当前 URL 做安全改写: 只保留 `/org/<newOrgId>/<app>` 前缀,
 * 剥掉 workspaceId 及后续段, 让 app 入口页自行决定 fallback (跳新 org 首个
 * workspace 或渲染 CreateFirstWorkspaceWizard).
 *
 * 保留旧 workspaceId 会导致新 org 里根本没这个 workspace, 后端全部 404 而
 * 前端 layout 仍渲染骨架 → 用户点击创建按钮时才发现全都失败.
 *
 * 特殊路径规则:
 *   - `/org/<x>/<app>/<workspaceId>/*` → 折成 `/org/<newOrg>/<app>`
 *   - `/org/<x>/<app>`                 → 只换 orgId 段
 *   - `/org/<x>` 或 `/org/<x>/`        → `/org/<newOrg>`
 *   - 非 /org 开头                      → '/'
 */
export function switchOrgInPath(pathname: string, newOrgId: string): string {
  const m = pathname.match(/^\/org\/[^/]+(\/(.*))?$/)
  if (!m) return '/'
  const rest = m[2] ?? ''
  if (!rest) return `/org/${newOrgId}`

  const segs = rest.split('/').filter(Boolean)
  if (segs.length === 0) return `/org/${newOrgId}`
  const app = segs[0]
  if (segs.length === 1) return `/org/${newOrgId}/${app}`
  // 有 workspaceId 或更深段: 折成 app 入口页, 由 index 路由处理 fallback
  return `/org/${newOrgId}/${app}`
}
