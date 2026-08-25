import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/shared/app-shared"

interface MotionDisclosureContentProps {
  open: boolean
  children: ReactNode
  className?: string
}

export function MotionDisclosureContent({
  open,
  children,
  className,
}: MotionDisclosureContentProps) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduceMotion ? { display: "none" } : { height: 0, opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.15, ease: "easeInOut" }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

interface MotionDisclosureChevronProps {
  open: boolean
  className?: string
}

export function MotionDisclosureChevron({ open, className }: MotionDisclosureChevronProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.span
      aria-hidden
      animate={{ rotate: open ? 90 : 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.15, ease: "easeInOut" }}
      className={cn("inline-flex shrink-0", className)}
    >
      <ChevronRight className="size-3" />
    </motion.span>
  )
}
