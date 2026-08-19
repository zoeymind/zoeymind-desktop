// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * get_module_cases 工具的自定义UI
 */

import React from 'react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { GetModuleCasesInput } from '../../../ai-chat/types'
import { Flag, Hash } from 'lucide-react'

interface GetModuleCasesInputExtended extends GetModuleCasesInput {
  moduleIds?: string[]
}

export function renderGetModuleCasesInput(input: GetModuleCasesInputExtended): React.ReactNode {
  // 支持 moduleId 单个或 moduleIds 数组
  const moduleIds = input.moduleIds || (input.moduleId ? [input.moduleId] : [])

  if (moduleIds.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {i18next.t('mindmap.aiChat.tools.noModules')}
      </span>
    )
  }

  return (
    <div className="text-xs text-foreground">
      <div className="font-medium">
        {i18next.t('mindmap.aiChat.tools.getModuleCases.input', { count: moduleIds.length })}
      </div>
    </div>
  )
}

interface ModuleCaseItem {
  id: string
  case: string
}

interface SubModuleItem {
  id: string
  name: string
}

interface ModuleResultItem {
  moduleId: string
  moduleName: string
  caseCount: number
  cases?: ModuleCaseItem[]
  subModules?: SubModuleItem[]
}

interface GetModuleCasesResultData {
  data?: GetModuleCasesResultData
  totalModules: number
  successCount: number
  totalCases: number
  results?: ModuleResultItem[]
}

export function renderGetModuleCasesOutput(result: ExecutionResult): React.ReactNode {
  if (!result.success || !result.data) {
    return null
  }

  const rawData = result.data as GetModuleCasesResultData | undefined
  const actualData: GetModuleCasesResultData = rawData?.data ||
    rawData || {
      totalModules: 0,
      successCount: 0,
      totalCases: 0
    }

  const successCount = actualData.successCount || 0
  const totalCases = actualData.totalCases || 0

  const handleNodeClick = (nodeId: string) => {
    window.dispatchEvent(new CustomEvent('mindmap:goToNode', { detail: { nodeId } }))
  }

  return (
    <div className="text-xs text-foreground">
      <div className="font-medium text-success mb-0.5">
        {i18next.t('mindmap.aiChat.tools.getModuleCases.success', {
          modules: successCount,
          cases: totalCases
        })}
      </div>
      {actualData.results && actualData.results.length > 0 && actualData.results.length <= 3 && (
        <div className="space-y-1">
          {actualData.results.map(module => (
            <div key={module.moduleId} className="border-l-2 border-primary/20 pl-2">
              <div
                className="flex items-center gap-1 cursor-pointer hover:bg-muted rounded px-1 -mx-1 mb-0.5"
                onClick={() => handleNodeClick(module.moduleId)}
              >
                <Flag className="size-3 text-primary flex-shrink-0" />
                <span className="truncate font-medium">{module.moduleName}</span>
                <span className="text-muted-foreground text-[10px] flex-shrink-0 flex items-center gap-0.5">
                  <Hash className="size-2" />
                  {i18next.t('mindmap.aiChat.tools.casesCount', { count: module.caseCount || 0 })}
                  {module.subModules && module.subModules.length > 0 && (
                    <span>
                      ·{' '}
                      {i18next.t('mindmap.aiChat.tools.subModulesCount', {
                        count: module.subModules.length
                      })}
                    </span>
                  )}
                </span>
              </div>
              {module.cases && module.cases.length > 0 && module.cases.length <= 3 && (
                <div className="space-y-0.5 ml-2">
                  {module.cases.map(testCase => (
                    <div
                      key={testCase.id}
                      className="flex items-center gap-1 text-muted-foreground cursor-pointer hover:bg-muted rounded px-1 -mx-1"
                      onClick={() => handleNodeClick(testCase.id)}
                    >
                      <Hash className="size-2.5 text-primary" />
                      <span className="truncate text-[10px]">{testCase.case}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
