/**
 * Ghost 补全 —— 桌面端 no-op（用户明确"先不接 Ghost"）。
 * 保留导出让 PluginManager 编译，attach 时不做任何操作。
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function attachGhostCompletion(_MindMap: unknown, _getOrgId: () => string | undefined): void {
  return undefined
}
