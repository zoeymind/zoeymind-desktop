// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
import { Flag } from 'lucide-react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { AddModuleInput } from '../../../ai-chat/types'

export const renderAddModuleInput = (input: AddModuleInput) => {
  const parentModuleId = input.parentModuleId
  const modules = input.modules || []

  return (
    <div className="text-xs space-y-1">
      {parentModuleId && (
        <div className="text-muted-foreground">
          <span className="text-muted-foreground">
            {i18next.t('mindmap.aiChat.tools.addModule.parentLabel')}
          </span>{' '}
          {parentModuleId.slice(0, 8)}...
        </div>
      )}
      <div className="text-muted-foreground">
        <span className="text-muted-foreground">
          {i18next.t('mindmap.aiChat.tools.addModule.countLabel')}
        </span>{' '}
        {i18next.t('mindmap.aiChat.tools.addModule.countValue', { count: modules.length })}
      </div>
      {modules.map((module, idx) => (
        <div key={idx} className="flex items-start gap-1 text-foreground">
          <Flag className="size-3 mt-0.5 text-primary flex-shrink-0" />
          <span className="font-medium">{module.name}</span>
        </div>
      ))}
    </div>
  )
}

interface AddModuleResultData {
  moduleId: string
  moduleName: string
}

export const renderAddModuleOutput = (result: ExecutionResult) => {
  if (!result.success) {
    return (
      <div className="text-xs text-destructive">
        {i18next.t('mindmap.aiChat.tools.failed', { error: result.error })}
      </div>
    )
  }

  // result.data 直接是数组 [{ moduleId, moduleName }, ...]
  const modulesData = (Array.isArray(result.data) ? result.data : []) as AddModuleResultData[]
  const count = modulesData.length

  return (
    <div className="text-xs text-success">
      {i18next.t('mindmap.aiChat.tools.addModule.success', { count })}
    </div>
  )
}