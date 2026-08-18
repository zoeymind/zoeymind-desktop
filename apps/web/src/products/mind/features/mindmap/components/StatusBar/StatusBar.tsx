import { type FC } from "react"
import { useMindMapModules } from "@/products/mind/features/mindmap/hooks/useMindMapModules"
import { useMindMapStore } from "@/products/mind/features/mindmap/stores/mindmap-store"
import { usePermissionStore } from "@/products/mind/features/mindmap/stores/permission-store"
import { useProjectContext } from "@/products/mind/features/mindmap/contexts/ProjectContext"
import { TestCaseStats } from "./TestCaseStats"
import { PermissionIndicator } from "./PermissionIndicator"

export const StatusBar: FC = () => {
  const { workspaceId, cloudMode } = useProjectContext()
  const { mindMap } = useMindMapStore()
  const { role, isOwner } = usePermissionStore()
  const { getTestCasesCount } = useMindMapModules(mindMap)
  const testCasesCount = getTestCasesCount()

  // 检查是否有权限信息需要显示
  const showPermission = cloudMode && workspaceId && role && !isOwner

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-muted px-4 text-xs text-muted-foreground">
      {/* 左侧信息区 */}
      <div className="flex items-center gap-4">
        {/* 用例数量统计 */}
        <TestCaseStats
          total={testCasesCount.total}
          p1={testCasesCount.p1}
          p2={testCasesCount.p2}
          p3={testCasesCount.p3}
        />

        {/* 权限显示 */}
        {showPermission && <PermissionIndicator role={role} />}
      </div>
      {/* 右侧 — 暂留, 后续放真正的工具入口 */}
      <div className="flex items-center gap-3" />
    </footer>
  )
}
