// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * delete_cases 工具的自定义UI
 */

import React from 'react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { DeleteCasesInput } from '../../../ai-chat/types'
import { Hash } from 'lucide-react'

export function renderDeleteCasesInput(input: DeleteCasesInput): React.ReactNode {
  const caseIds = input.caseIds || []

  if (caseIds.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {i18next.t('mindmap.aiChat.tools.noCases')}
      </span>
    )
  }

  const handleCaseClick = (caseId: string) => {
    window.dispatchEvent(new CustomEvent('mindmap:goToNode', { detail: { nodeId: caseId } }))
  }

  return (
    <div className="text-xs text-foreground">
      {caseIds.length <= 3 ? (
        <div className="space-y-1">
          {caseIds.map(caseId => (
            <div key={caseId} className="flex items-center gap-1">
              <Hash className="size-3 text-destructive" />
              <span
                className="text-muted-foreground font-mono cursor-pointer hover:text-destructive transition-colors"
                onClick={() => handleCaseClick(caseId)}
                title={i18next.t('mindmap.aiChat.tools.clickActivateNode')}
              >
                {caseId.slice(0, 8)}...
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Hash className="size-3 text-destructive" />
          <span>
            {i18next.t('mindmap.aiChat.tools.deleteCases.summary', { count: caseIds.length })}
          </span>
        </div>
      )}
    </div>
  )
}

interface DeleteCasesResultData {
  data?: DeleteCasesResultData
  deletedCount?: number
  deleted?: number
}

export function renderDeleteCasesOutput(result: ExecutionResult): React.ReactNode {
  if (!result.success || !result.data) {
    return null // 错误由默认UI处理
  }

  const rawData = result.data as DeleteCasesResultData | undefined
  const actualData: DeleteCasesResultData = rawData?.data || rawData || {}
  const deletedCount = actualData.deletedCount || actualData.deleted || 0

  return (
    <div className="text-xs text-success font-medium">
      {i18next.t('mindmap.aiChat.tools.deleteCases.success', { count: deletedCount })}
    </div>
  )
}