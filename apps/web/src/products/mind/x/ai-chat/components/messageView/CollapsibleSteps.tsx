/**
 * CollapsibleSteps - 可折叠的工具步骤区域
 *
 * 封装 GlowCard + StepsSummaryBar + 展开/折叠逻辑。
 * 当工具调用 >= 2 时由 AssistantMessage 使用。
 */

import React, { useState, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import { GlowCard } from "./GlowCard"
import { StepsSummaryBar } from "./StepsSummaryBar"
import type { ToolCallPart } from "./tool-call-part"

interface IndexedToolPart {
  part: ToolCallPart
  index: number
}

interface CollapsibleStepsProps {
  /** 所有工具 parts（含原始 index） */
  toolParts: IndexedToolPart[]
  /** 当前消息是否正在处理 */
  isProcessing: boolean
  /** 用户发送到当前/最终响应的整轮 wall-clock。 */
  turnStartedAt?: number
  turnDurationMs?: number
  /** All message parts, retained as unknown until the renderer narrows each part. */
  allParts: unknown[]
  /** Index of the final active part rendered outside the collapsed region. */
  lastActivePartIndex: number
  renderPart: (part: unknown, partIndex: number, isLastActive?: boolean) => React.ReactNode
}

export const CollapsibleSteps: React.FC<CollapsibleStepsProps> = ({
  toolParts,
  isProcessing,
  turnStartedAt,
  turnDurationMs,
  allParts,
  lastActivePartIndex,
  renderPart,
}) => {
  const [stepsExpanded, setStepsExpanded] = useState(false)

  const handleToggleSteps = useCallback(() => {
    setStepsExpanded(prev => !prev)
  }, [])

  return (
    <>
      <GlowCard active={isProcessing}>
        <StepsSummaryBar
          toolParts={toolParts.map(t => t.part)}
          isExpanded={stepsExpanded}
          onToggle={handleToggleSteps}
          isProcessing={isProcessing}
          turnStartedAt={turnStartedAt}
          turnDurationMs={turnDurationMs}
        />
        <AnimatePresence initial={false}>
          {stepsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/40 px-2 py-1.5 space-y-0">
                {allParts.map((part, partIndex) => {
                  if (partIndex === lastActivePartIndex) return null
                  return renderPart(part, partIndex)
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlowCard>

      {lastActivePartIndex >= 0 && allParts[lastActivePartIndex] && (
        <div className="mt-2">
          {renderPart(allParts[lastActivePartIndex], lastActivePartIndex, true)}
        </div>
      )}
    </>
  )
}
