import { Skeleton } from '@zoeymind/ui'

/**
 * 项目卡片骨架屏组件
 * 用于在加载项目列表时显示占位符
 */
export function ProjectCardSkeleton() {
  return (
    <div className="bg-card rounded-lg overflow-hidden h-full border border-border">
      <div className="aspect-[4/3] relative block overflow-hidden">
        {/* 预览区骨架 */}
        <Skeleton className="w-full h-full" />
      </div>
    </div>
  )
}
