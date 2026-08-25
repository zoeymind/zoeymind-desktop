import type { ReactNode } from "react"
import { cn } from "@/shared/app-shared"
import { MotionDisclosureChevron, MotionDisclosureContent } from "./MotionDisclosure"

export type ToolCallRowTone = "default" | "active" | "warning" | "destructive"

interface ToolCallRowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expandable: boolean
  icon: ReactNode
  badge?: ReactNode
  title: ReactNode
  meta?: ReactNode
  status?: ReactNode
  trailing?: ReactNode
  detail?: ReactNode
  tone?: ToolCallRowTone
  className?: string
  detailClassName?: string
}

const toneClasses: Record<ToolCallRowTone, string> = {
  default: "text-muted-foreground",
  active: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
}

export function ToolCallRow({
  open,
  onOpenChange,
  expandable,
  icon,
  badge,
  title,
  meta,
  status,
  trailing,
  detail,
  tone = "default",
  className,
  detailClassName,
}: ToolCallRowProps) {
  return (
    <div className={cn("my-0.5 w-full", className)}>
      <button
        type="button"
        aria-expanded={expandable ? open : false}
        disabled={!expandable}
        onClick={() => expandable && onOpenChange(!open)}
        className={cn(
          "group flex h-7 w-full min-w-0 items-center gap-1.5 rounded px-1.5 text-left text-xs text-muted-foreground",
          expandable && "hover:bg-muted/50",
          open && "bg-muted/35"
        )}
      >
        <span
          className={cn(
            "inline-flex size-3 shrink-0 items-center justify-center",
            toneClasses[tone]
          )}
        >
          {icon}
        </span>
        {badge}
        <span className={cn("min-w-0 truncate font-medium", toneClasses[tone])}>{title}</span>
        {meta ? (
          <span className="min-w-0 truncate text-[10px] text-muted-foreground/70">{meta}</span>
        ) : null}
        <span className="min-w-0 flex-1" />
        {status ? (
          <span className={cn("shrink-0 text-[10px] tabular-nums", toneClasses[tone])}>
            {status}
          </span>
        ) : null}
        {trailing}
        {expandable ? (
          <MotionDisclosureChevron open={open} className="opacity-60 group-hover:opacity-100" />
        ) : null}
      </button>

      <MotionDisclosureContent open={open} className={cn("ml-5", detailClassName)}>
        {detail}
      </MotionDisclosureContent>
    </div>
  )
}

interface ToolCallDetailProps {
  label: ReactNode
  children: ReactNode
  tone?: "default" | "destructive"
}

export function ToolCallDetail({ label, children, tone = "default" }: ToolCallDetailProps) {
  return (
    <section
      className={cn(
        "rounded px-2 py-1.5",
        tone === "destructive" ? "bg-destructive/8" : "bg-muted/35"
      )}
    >
      <div
        className={cn(
          "mb-1 text-[10px] font-medium",
          tone === "destructive" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {label}
      </div>
      {children}
    </section>
  )
}
