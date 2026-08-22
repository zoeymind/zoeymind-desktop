/**
 * DiffSummary —— 画布右下角浮标, 显示自上次保存以来的 diff 计数.
 *
 * 三个色块 + 数字, 点击后续可以做定位面板; v1 仅显示.
 * 无 diff 时不渲染.
 */
import { useMemo } from "react"
import { useDiffState } from "./useDiffTracking"

export function DiffSummary(): React.JSX.Element | null {
  const state = useDiffState()

  const counts = useMemo(
    () => ({
      add: state.addedUids.size,
      modify: state.modifiedUids.size,
      move: state.movedUids.size,
      remove: state.removedUids.size,
    }),
    [state]
  )

  const total = counts.add + counts.modify + counts.move + counts.remove
  if (total === 0) return null

  return (
    <div
      className="pointer-events-auto absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur"
      role="status"
      aria-label="自上次保存以来的改动统计"
    >
      <span className="text-muted-foreground">未保存改动</span>
      {counts.add > 0 && (
        <Chip color="#10b981" label={`+${counts.add}`} title={`新增 ${counts.add} 个节点`} />
      )}
      {counts.modify > 0 && (
        <Chip color="#f59e0b" label={`~${counts.modify}`} title={`修改 ${counts.modify} 个节点`} />
      )}
      {counts.move > 0 && (
        <Chip color="#3b82f6" label={`→${counts.move}`} title={`移动 ${counts.move} 个节点`} />
      )}
      {counts.remove > 0 && (
        <Chip color="#ef4444" label={`−${counts.remove}`} title={`删除 ${counts.remove} 个节点`} />
      )}
    </div>
  )
}

function Chip({
  color,
  label,
  title,
}: {
  color: string
  label: string
  title: string
}): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 font-medium tabular-nums"
      style={{ color }}
      title={title}
    >
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}
