/**
 * ErrorCard - 错误信息展示卡片.
 *
 * 只渲染两种状态 (与后端约定的 code):
 *   - INSUFFICIENT_QUOTA: 额度不足 → 只展示文案 (无 CTA)
 *   - REQUEST_FAILED:     其它失败 → "重试" CTA (恢复输入回输入框)
 *
 * 故意不展示任何原始 message / responseBody / request id —— 避免泄露内部 AI 服务链路.
 * 真要排查问题, admin 看后端 logger.error 的完整记录.
 */

import React from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { useTranslation } from '@zoeymind/i18n'
import { useAIChatV2Store } from '../../../ai-chat/stores/useAIChatV2Store'
import type { ChatErrorCode } from '../../../ai-chat/utils/errorHandler'

interface ErrorCardProps {
  code: ChatErrorCode
  isLast?: boolean
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ code, isLast = false }) => {
  const { t } = useTranslation()
  const lastSentInput = useAIChatV2Store(s => s.lastSentInput)

  const isQuota = code === 'INSUFFICIENT_QUOTA'
  const title = isQuota
    ? t('mindmap.aiChat.error.insufficientQuota.title')
    : t('mindmap.aiChat.error.requestFailed.title')
  const body = isQuota
    ? t('mindmap.aiChat.error.insufficientQuota.body')
    : t('mindmap.aiChat.error.requestFailed.body')

  const handleRetry = () => {
    const s = useAIChatV2Store.getState()
    if (s.lastSentInput) {
      s.restoreInput()
    }
  }

  return (
    <div className="my-0.5 rounded-md border border-destructive/30 bg-destructive/[0.04] px-2.5 py-2">
      <div className="flex items-start gap-2">
        <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-destructive">{title}</div>
          <div className="text-[11px] text-destructive/80 mt-0.5">{body}</div>
          {isLast && !isQuota && lastSentInput && (
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
              >
                <RefreshCcw className="size-3" />
                {t('mindmap.aiChat.error.requestFailed.cta')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
