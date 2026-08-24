/**
 * Ghost 补全 —— 桌面端 no-op（用户明确"先不接 Ghost"）。
 * 保留导出让 PluginManager 编译，attach 时不做任何操作。
 */

export function attachGhostCompletion(mindMap: unknown, getOrgId: () => string | undefined): void {
  void mindMap
  void getOrgId
}
