// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * search_cases 工具的自定义UI
 */

import React from 'react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { SearchCasesInput } from '../../../ai-chat/types'
import { Hash, Flag } from 'lucide-react'

export function renderSearchCasesInput(input: SearchCasesInput): React.ReactNode {
  const keyword = input.query
  return (
    <div className="text-xs text-foreground">
      <div className="font-medium">
        {i18next.t('mindmap.aiChat.tools.searchCases.input', { query: keyword })}
      </div>
    </div>
  )
}

interface SearchCaseItem {
  caseId: string
  caseName: string
  moduleId: string
  moduleName: string
}

interface SearchCasesResultData {
  data?: SearchCasesResultData
  count: number
  cases?: SearchCaseItem[]
}

export function renderSearchCasesOutput(result: ExecutionResult): React.ReactNode {
  if (!result.success || !result.data) {
    return null
  }

  const rawData = result.data as SearchCasesResultData | undefined
  const actualData: SearchCasesResultData = rawData?.data || rawData || { count: 0 }
  const count = actualData.count || 0

  const handleNodeClick = (nodeId: string) => {
    window.dispatchEvent(new CustomEvent('mindmap:goToNode', { detail: { nodeId } }))
  }

  return (
    <div className="text-xs text-foreground">
      <div className="font-medium text-success mb-0.5">
        {i18next.t('mindmap.aiChat.tools.searchCases.found', { count })}
      </div>
      {actualData.cases && actualData.cases.length > 0 && actualData.cases.length <= 5 && (
        <div className="space-y-0.5 text-muted-foreground">
          {actualData.cases.map(testCase => (
            <div key={testCase.caseId} className="flex items-start gap-1">
              <Hash className="size-3 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div
                  className="truncate cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleNodeClick(testCase.caseId)}
                  title={i18next.t('mindmap.aiChat.tools.clickActivateNode')}
                >
                  {testCase.caseName}
                </div>
                <div
                  className="text-muted-foreground text-[10px] flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleNodeClick(testCase.moduleId)}
                  title={i18next.t('mindmap.aiChat.tools.clickActivateModule')}
                >
                  <Flag className="size-2 inline" />
                  <span>{testCase.moduleName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
