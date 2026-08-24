import { Skeleton } from "@zoeymind/ui"

/**
 * 项目列表项骨架屏组件
 * 用于在加载项目列表时显示占位符
 */
export function ProjectListItemSkeleton() {
  return (
    <div className="grid grid-cols-8 gap-4 items-center py-4 px-4 border-b border-border">
      {/* 缩略图骨架 */}
      <div className="col-span-1">
        <Skeleton className="size-16 rounded" />
      </div>

      {/* 项目名称骨架 */}
      <div className="col-span-2">
        <Skeleton className="h-5 w-3/4" />
      </div>

      {/* 统计信息骨架 */}
      <div className="col-span-4 flex gap-8">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* 操作按钮骨架 */}
      <div className="col-span-1 flex justify-end gap-2">
        <Skeleton className="size-8 rounded" />
      </div>
    </div>
  )
}
