// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import { Flag } from 'lucide-react'
import { i18next } from '@zoeymind/i18n'
import type { ExecutionResult } from '../../../ai-chat/tools/types'
import type { UpdateModuleInput } from '../../../ai-chat/types'

export const renderUpdateModuleInput = (input: UpdateModuleInput) => {
  const updates = input.updates || []
  return (
    <div className="text-xs space-y-1.5">
      <div className="text-muted-foreground">
        {i18next.t('mindmap.aiChat.tools.updateModule.summary', { count: updates.length })}
      </div>
      {updates.map((update, idx) => (
        <div key={idx} className="flex items-start gap-1.5 text-foreground">
          <span className="text-muted-foreground">#{idx + 1}</span>
          <Flag className="size-3 mt-0.5 text-primary flex-shrink-0" />
          <div className="flex-1 space-y-0.5">
            {update.name && (
              <div>
                <span className="text-muted-foreground">
                  {i18next.t('mindmap.aiChat.tools.updateModule.newName')}
                </span>{' '}
                <span className="font-medium">{update.name}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface UpdateModuleResultItem {
  moduleId: string
  moduleName?: string
  success: boolean
  error?: string
}

interface UpdateModuleResultData {
  data?: UpdateModuleResultItem[]
}

export const renderUpdateModuleOutput = (result: ExecutionResult) => {
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

  // 工具返回的是 { success: true, data: [ { moduleId, moduleName?, success, error? } ] }
  const rawData = result.data as UpdateModuleResultData | UpdateModuleResultItem[]
  const actualData = Array.isArray(rawData)
    ? rawData
    : (rawData as UpdateModuleResultData).data || []
  const results = Array.isArray(actualData) ? actualData : [actualData]

  const successCount = results.filter(u => u.success).length

  const handleModuleClick = (moduleId: string) => {
    window.dispatchEvent(new CustomEvent('mindmap:goToNode', { detail: { nodeId: moduleId } }))
  }

  return (
    <div className="text-xs space-y-2">
      {/* 统计信息 */}
      <div className={successCount > 0 ? 'text-success' : 'text-destructive'}>
        {successCount > 0
          ? i18next.t('mindmap.aiChat.tools.updateModule.success', { count: successCount })
          : i18next.t('mindmap.aiChat.tools.updateModule.allFailed')}
      </div>

      {/* 可点击的模块列表 */}
      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((item, idx) => (
            <div key={idx} className="flex items-start gap-1">
              <Flag
                className={`size-3 mt-0.5 flex-shrink-0 ${item.success ? 'text-success' : 'text-destructive'}`}
              />
              <div
                className="truncate cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleModuleClick(item.moduleId)}
                title={item.error || i18next.t('mindmap.aiChat.tools.clickActivateNode')}
              >
                {item.moduleName ||
                  i18next.t('mindmap.aiChat.tools.moduleFallback', {
                    id: item.moduleId.slice(0, 8)
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
