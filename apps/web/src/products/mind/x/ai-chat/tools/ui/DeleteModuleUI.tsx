import { Flag, AlertTriangle } from 'lucide-react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { DeleteModuleInput } from '../../../ai-chat/types'

export const renderDeleteModuleInput = (input: DeleteModuleInput) => {
  const moduleIds = input.moduleIds || []
  return (
    <div className="text-xs space-y-1">
      <div className="flex items-center gap-1 text-warning">
        <AlertTriangle className="size-3" />
        <span>
          {i18next.t('mindmap.aiChat.tools.deleteModule.warning', { count: moduleIds.length })}
        </span>
      </div>
      {moduleIds.map((id, idx) => (
        <div key={idx} className="flex items-center gap-1 text-foreground">
          <Flag className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            {i18next.t('mindmap.aiChat.tools.moduleFallback', { id: id.slice(0, 8) })}
          </span>
        </div>
      ))}
    </div>
  )
}

interface DeleteModuleResultItem {
  moduleId: string
  moduleName?: string
  success: boolean
  error?: string
}

interface DeleteModuleResultData {
  data?: DeleteModuleResultItem[]
}

export const renderDeleteModuleOutput = (result: ExecutionResult) => {
  if (!result.success) {
    return (
      <div className="text-xs text-destructive">
        {i18next.t('mindmap.aiChat.tools.failed', { error: result.error })}
      </div>
    )
  }

  if (!result.data) {
    return (
      <div className="text-xs text-muted-foreground">
        {i18next.t('mindmap.aiChat.tools.noData')}
      </div>
    )
  }

  const rawData = result.data as DeleteModuleResultData | DeleteModuleResultItem[]
  const actualData = Array.isArray(rawData)
    ? rawData
    : (rawData as DeleteModuleResultData).data || []
  const deletions = Array.isArray(actualData) ? actualData : []

  // 只显示失败的模块
  const failedDeletions = deletions.filter(d => !d.success)

  if (failedDeletions.length === 0) {
    return null // 全部成功，不显示任何内容
  }

  return (
    <div className="text-xs space-y-1 text-destructive">
      {failedDeletions.map((deletion, idx) => (
        <div key={idx}>
          {i18next.t('mindmap.aiChat.tools.deleteModule.failure', {
            id: deletion.moduleId.slice(0, 8),
            error: deletion.error ?? ''
          })}
        </div>
      ))}
    </div>
  )
}
