// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * update_cases 工具的自定义UI
 */

import React from 'react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { UpdateCasesInput } from '../../../ai-chat/types'
import { Hash } from 'lucide-react'

export function renderUpdateCasesInput(input: UpdateCasesInput): React.ReactNode {
  const updates = input.updates

  if (!updates || updates.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {i18next.t('mindmap.aiChat.tools.noUpdates')}
      </span>
    )
  }

  const handleCaseClick = (caseId: string) => {
    window.dispatchEvent(new CustomEvent('mindmap:goToNode', { detail: { nodeId: caseId } }))
  }

  // 生成步骤的tooltip文本
  const getStepsTooltip = (steps?: string[]): string | undefined => {
    if (!steps || steps.length === 0) return undefined
    return steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
  }

  return (
    <div className="text-xs text-foreground">
      {updates.length <= 3 ? (
        <div className="space-y-1">
          {updates.map(update => (
            <div key={update.caseId} className="flex items-start gap-1">
              <Hash className="size-3 text-warning mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div
                  className="truncate cursor-pointer hover:text-warning transition-colors"
                  onClick={() => handleCaseClick(update.caseId)}
                  title={
                    getStepsTooltip(update.steps) ||
                    i18next.t('mindmap.aiChat.tools.clickActivateNode')
                  }
                >
                  {update.case ||
                    i18next.t('mindmap.aiChat.tools.caseFallback', {
                      id: update.caseId.slice(0, 8)
                    })}
                </div>
                {update.steps && (
                  <div className="text-muted-foreground text-[10px]">
                    {i18next.t('mindmap.aiChat.tools.stepsCount', { count: update.steps.length })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Hash className="size-3 text-warning" />
          <span>
            {i18next.t('mindmap.aiChat.tools.updateCases.summary', { count: updates.length })}
          </span>
        </div>
      )}
    </div>
  )
}

export function renderUpdateCasesOutput(result: ExecutionResult): React.ReactNode {
  if (!result.success || !result.data) {
    return null
  }

  interface UpdateResultItem {
    caseId?: string
    success?: boolean
    error?: string
  }
  interface UpdateResultData {
    data?: UpdateResultData
    results?: UpdateResultItem[]
    updates?: UpdateResultItem[]
    successCount?: number
    failedCount?: number
  }
  const rawData = result.data as UpdateResultData | undefined
  const actualData: UpdateResultData = rawData?.data || rawData || {}

  // 工具返回的是 { total, successCount, failedCount, results: [ { caseId, success, error? } ] }
  const results: UpdateResultItem[] = actualData.results || actualData.updates || []
  const successCount = actualData.successCount || results.filter(u => u.success).length
  const failedCount = actualData.failedCount || results.filter(u => !u.success).length

  const handleCaseClick = (caseId: string) => {
    window.dispatchEvent(new CustomEvent('mindmap:goToNode', { detail: { nodeId: caseId } }))
  }

  return (
    <div className="text-xs space-y-2">
      {/* 统计信息 */}
      <div>
        {failedCount === 0 ? (
          <div className="text-success font-medium">
            {i18next.t('mindmap.aiChat.tools.updateCases.success', { count: successCount })}
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="text-success font-medium">
              {i18next.t('mindmap.aiChat.tools.successCount', { count: successCount })}
            </div>
            <div className="text-destructive font-medium">
              {i18next.t('mindmap.aiChat.tools.failedCount', { count: failedCount })}
            </div>
          </div>
        )}
      </div>

      {/* 可点击的用例列表 */}
      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((item, idx) => (
            <div key={idx} className="flex items-start gap-1">
              <Hash
                className={`size-3 mt-0.5 flex-shrink-0 ${item.success ? 'text-success' : 'text-destructive'}`}
              />
              <div
                className="truncate cursor-pointer hover:text-warning transition-colors"
                onClick={() => item.caseId && handleCaseClick(item.caseId)}
                title={item.error || i18next.t('mindmap.aiChat.tools.clickActivateNode')}
              >
                {i18next.t('mindmap.aiChat.tools.caseFallback', {
                  id: item.caseId?.slice(0, 8) ?? ''
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
