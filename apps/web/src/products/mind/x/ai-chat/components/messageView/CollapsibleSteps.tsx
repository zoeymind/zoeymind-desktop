/**
 * CollapsibleSteps - 可折叠的工具步骤区域
 *
 * 封装 GlowCard + StepsSummaryBar + 展开/折叠逻辑。
 * 当工具调用 >= 2 时由 AssistantMessage 使用。
 */

import React, { useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { GlowCard } from './GlowCard'
import { StepsSummaryBar } from './StepsSummaryBar'
import type { ToolCallPart } from './ToolCallCard'

interface IndexedToolPart {
  part: ToolCallPart
  index: number
}

interface CollapsibleStepsProps {
  /** 所有工具 parts（含原始 index） */
  toolParts: IndexedToolPart[]
  /** 当前消息是否正在处理 */
  isProcessing: boolean
  /** 所有 parts（用于折叠区域内的渲染） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allParts: any[]
  /** 最后一个活跃 part 的索引（在折叠区域外单独显示） */
  lastActivePartIndex: number
  /** 渲染单个 part 的函数 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderPart: (part: any, partIndex: number, isLastActive?: boolean) => React.ReactNode
}

export const CollapsibleSteps: React.FC<CollapsibleStepsProps> = ({
  toolParts,
  isProcessing,
  allParts,
  lastActivePartIndex,
  renderPart
}) => {
  const [stepsExpanded, setStepsExpanded] = useState(false)
  const toolsStartTimeRef = useRef<number | null>(null)

  if (toolParts.length > 0 && isProcessing && toolsStartTimeRef.current === null) {
    toolsStartTimeRef.current = Date.now()
  }

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
          startTime={toolsStartTimeRef.current}
        />
        <AnimatePresence initial={false}>
          {stepsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
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
