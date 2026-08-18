// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * list_modules 工具的自定义UI
 */

import React from 'react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { ToolArgs } from '../../../ai-chat/types'
import { Flag, Hash } from 'lucide-react'

export function renderListModulesInput(_args: ToolArgs): React.ReactNode {
  return (
    <div className="text-xs text-foreground">
      <div className="font-medium">{i18next.t('mindmap.aiChat.tools.listModules.input')}</div>
    </div>
  )
}

/** 模块数据结构 */
interface ModuleItem {
  id: string
  name: string
  caseCount: number
  children?: ModuleItem[]
}

/** 扁平化后的模块项 */
interface FlatModuleItem {
  id: string
  name: string
  caseCount: number
  depth: number
}

/** 模块列表响应数据 */
interface ListModulesData {
  data?: ListModulesData
  totalCount: number
  modules?: ModuleItem[]
}

// 由于不能在渲染函数中使用hooks，使用全局事件系统
function renderListModulesOutputInternal(result: ExecutionResult): React.ReactNode {
  if (!result.success || !result.data) {
    return null
  }

  // 处理嵌套的数据结构：result.data 可能是 {success, data: {...}} 或直接是数据
  const rawData = result.data as ListModulesData | undefined
  const actualData: ListModulesData = rawData?.data || rawData || { totalCount: 0 }

  // 递归扁平化模块列表
  const flattenModules = (modules: ModuleItem[], depth = 0): FlatModuleItem[] => {
    const items: FlatModuleItem[] = []
    for (const module of modules) {
      items.push({
        id: module.id,
        name: module.name,
        caseCount: module.caseCount || 0,
        depth
      })
      if (module.children && module.children.length > 0) {
        items.push(...flattenModules(module.children, depth + 1))
      }
    }
    return items
  }

  const flatModules = actualData.modules ? flattenModules(actualData.modules) : []
  const totalCount = actualData.totalCount || 0

  const handleModuleClick = (moduleId: string) => {
    window.dispatchEvent(new CustomEvent('mindmap:goToNode', { detail: { nodeId: moduleId } }))
  }

  return (
    <div className="text-xs text-foreground">
      <div className="font-medium text-success mb-1">
        {i18next.t('mindmap.aiChat.tools.listModules.total', { count: totalCount })}
      </div>
      {flatModules.length > 0 && (
        <div className="space-y-0.5 text-muted-foreground">
          {flatModules.map(module => (
            <div
              key={module.id}
              className="flex items-center gap-1 cursor-pointer hover:bg-muted rounded px-1 py-0.5 -mx-1"
              onClick={() => handleModuleClick(module.id)}
              style={{ paddingLeft: `${module.depth * 12 + 4}px` }}
            >
              <Flag className="size-3 text-primary flex-shrink-0" />
              <span className="truncate flex-1">{module.name}</span>
              <span className="text-muted-foreground text-[10px] flex-shrink-0 flex items-center gap-0.5">
                <Hash className="size-2" />
                {module.caseCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function renderListModulesOutput(result: ExecutionResult): React.ReactNode {
  return renderListModulesOutputInternal(result)
}