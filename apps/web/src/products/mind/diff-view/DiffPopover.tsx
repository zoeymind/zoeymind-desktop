/**
 * DiffPopover —— 悬停在 modified 节点上时弹字符级 diff 卡.
 *
 * 触发: 在画布容器上做事件委托, 捕获 mouseenter/leave 到带 data-uid 的
 *       .smm-diff-modify 节点 group 元素.
 * 定位: 用节点 group 的 getBoundingClientRect() 算, portal 到 document.body,
 *       让 SVG viewBox 变换后依然贴节点上方.
 * 内容: 用 diff npm 的 diffChars 做字符级差异, 红色划掉旧字, 绿色下划线新字.
 *       同时列 icon 变化 (罕见但存在) 和 hyperlink / note 是否变了.
 *
 * 引擎重新渲染时 group DOM 会被替换; 关闭时机: mouseleave 到画布或
 * data-uid 消失; useEffect cleanup 卸载所有监听器.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { diffChars, type Change } from "diff"
import { useDiffState } from "./useDiffTracking"
import type { NodeSnapshot } from "./diff-engine"

interface AnchoredUid {
  uid: string
  rect: DOMRect
}

interface Props {
  /** 画布容器: 事件委托挂在这里 */
  containerRef: React.RefObject<HTMLElement | null>
}

export function DiffPopover({ containerRef }: Props): React.JSX.Element | null {
  const diff = useDiffState()
  const [hovered, setHovered] = useState<AnchoredUid | null>(null)
  const currentUidRef = useRef<string | null>(null)

  // 事件委托: 挂在 containerRef 上, 捕获所有 .smm-diff-modify[data-uid] 的 hover
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const findModifiedGroup = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null
      // svgdotjs 的 group.node 是 SVGGElement, closest 支持
      const modifiedEl = target.closest(".smm-diff-modify") as HTMLElement | null
      if (!modifiedEl) return null
      if (!modifiedEl.dataset.uid) return null
      return modifiedEl
    }

    const handleOver = (event: MouseEvent) => {
      const modifiedEl = findModifiedGroup(event.target)
      if (!modifiedEl) return
      const uid = modifiedEl.dataset.uid
      if (!uid || uid === currentUidRef.current) return
      currentUidRef.current = uid
      setHovered({ uid, rect: modifiedEl.getBoundingClientRect() })
    }

    const handleOut = (event: MouseEvent) => {
      // relatedTarget 是即将进入的元素. 如果它还在同一个 modified 节点里, 忽略.
      const stillIn = findModifiedGroup(event.relatedTarget)
      if (stillIn && stillIn.dataset.uid === currentUidRef.current) return
      currentUidRef.current = null
      setHovered(null)
    }

    container.addEventListener("mouseover", handleOver)
    container.addEventListener("mouseout", handleOut)
    return () => {
      container.removeEventListener("mouseover", handleOver)
      container.removeEventListener("mouseout", handleOut)
    }
  }, [containerRef])

  // 用 diff-view 的最新 snapshot pair. 如果 hover 的 uid 已经不在 modifiedUids
  // (例如用户又改回原样), 自动关闭 popover.
  const pair = useMemo(() => {
    if (!hovered) return null
    if (!diff.modifiedUids.has(hovered.uid)) return null
    const before = diff.baselineByUid.get(hovered.uid)
    const after = diff.currentByUid.get(hovered.uid)
    if (!before || !after) return null
    return { before, after }
  }, [hovered, diff])

  if (!hovered || !pair) return null

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 min-w-[240px] max-w-[420px] rounded-md border border-border/70 bg-popover px-3 py-2 text-xs shadow-md"
      style={{
        top: Math.max(8, hovered.rect.top - 8),
        left: hovered.rect.left,
        transform: "translateY(-100%)",
      }}
    >
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        修改
      </div>
      <TextDiff before={pair.before.text} after={pair.after.text} />
      <AttributeChanges before={pair.before} after={pair.after} />
    </div>,
    document.body
  )
}

function TextDiff({ before, after }: { before: string; after: string }): React.JSX.Element | null {
  const changes = useMemo(() => diffChars(before, after), [before, after])
  if (before === after) return null
  return (
    <div className="space-y-1 font-mono leading-relaxed">
      <div className="flex items-start gap-2">
        <span className="mt-[1px] shrink-0 text-red-500">−</span>
        <div className="min-w-0 break-words">{renderSide(changes, "removed")}</div>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-[1px] shrink-0 text-emerald-500">+</span>
        <div className="min-w-0 break-words">{renderSide(changes, "added")}</div>
      </div>
    </div>
  )
}

function renderSide(changes: Change[], side: "removed" | "added"): React.JSX.Element[] {
  return changes
    .map((change, index) => {
      const isRemove = change.removed === true
      const isAdd = change.added === true
      if (side === "removed" && isAdd) return null
      if (side === "added" && isRemove) return null
      const highlight = side === "removed" ? isRemove : isAdd
      return (
        <span
          key={index}
          className={
            highlight
              ? side === "removed"
                ? "bg-red-500/15 text-red-600 line-through decoration-red-500/70"
                : "bg-emerald-500/15 text-emerald-600 underline decoration-emerald-500/70 underline-offset-2"
              : "text-muted-foreground"
          }
        >
          {change.value}
        </span>
      )
    })
    .filter((el): el is React.JSX.Element => el !== null)
}

/** icon / hyperlink / note 变化, 用一行简报, 不做字符级 diff. */
function AttributeChanges({
  before,
  after,
}: {
  before: NodeSnapshot
  after: NodeSnapshot
}): React.JSX.Element | null {
  const rows: React.JSX.Element[] = []
  if (!sameStringArray(before.icon, after.icon))
    rows.push(
      <AttrRow
        key="icon"
        label="图标"
        before={before.icon.join(", ") || "(无)"}
        after={after.icon.join(", ") || "(无)"}
      />
    )
  if (before.hyperlink !== after.hyperlink)
    rows.push(
      <AttrRow
        key="hyperlink"
        label="超链接"
        before={before.hyperlink || "(无)"}
        after={after.hyperlink || "(无)"}
      />
    )
  if (before.note !== after.note)
    rows.push(
      <AttrRow
        key="note"
        label="备注"
        before={before.note ? truncate(before.note, 40) : "(无)"}
        after={after.note ? truncate(after.note, 40) : "(无)"}
      />
    )
  if (rows.length === 0) return null
  return <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2">{rows}</div>
}

function AttrRow({
  label,
  before,
  after,
}: {
  label: string
  before: string
  after: string
}): React.JSX.Element {
  return (
    <div className="text-[11px]">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-red-600 line-through">{before}</span>
      <span className="mx-1 text-muted-foreground">→</span>
      <span className="text-emerald-600">{after}</span>
    </div>
  )
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}
