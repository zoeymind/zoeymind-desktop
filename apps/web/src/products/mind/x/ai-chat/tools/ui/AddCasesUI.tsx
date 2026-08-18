/**
 * add_cases 工具的自定义UI
 */

import React from 'react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { AddCasesInput } from '../../../ai-chat/types'
import { Hash } from 'lucide-react'

export function renderAddCasesInput(input: AddCasesInput): React.ReactNode {
  const cases = input.cases || []

  if (cases.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {i18next.t('mindmap.aiChat.tools.noCases')}
      </span>
    )
  }

  // 生成步骤的tooltip文本
  const getStepsTooltip = (steps?: string[]): string | undefined => {
    if (!steps || steps.length === 0) return undefined
    return steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
  }

  return (
    <div className="text-xs text-foreground">
      {cases.length <= 3 ? (
        <div className="space-y-1">
          {cases.map((testCase, index) => (
            <div key={index} className="flex items-start gap-1">
              <Hash className="size-3 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate" title={getStepsTooltip(testCase.steps)}>
                  {testCase.case}
                </div>
                {testCase.steps && testCase.steps.length > 0 && (
                  <div className="text-muted-foreground text-[10px]">
                    {i18next.t('mindmap.aiChat.tools.stepsCount', { count: testCase.steps.length })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Hash className="size-3 text-primary" />
          <span>{i18next.t('mindmap.aiChat.tools.addCases.summary', { count: cases.length })}</span>
        </div>
      )}
    </div>
  )
}

interface AddCasesResultData {
  message?: string
  moduleId?: string
  caseCount?: number
}

export function renderAddCasesOutput(result: ExecutionResult): React.ReactNode {
  if (!result.success || !result.data) {
    return null
  }

  // result.data 直接是 { message, moduleId, caseCount }
  const data = result.data as AddCasesResultData
  const caseCount = data.caseCount || 0

  return (
    <div className="text-xs text-success">
      {i18next.t('mindmap.aiChat.tools.addCases.success', { count: caseCount })}
    </div>
  )
}
