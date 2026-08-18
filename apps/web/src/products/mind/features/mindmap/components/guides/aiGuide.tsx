/**
 * AI Guide 配置
 * 定义 AI 助手功能的用户引导步骤
 */

import type { Step } from 'react-joyride'
import type { TFunction } from 'i18next'

export const AI_GUIDE_STORAGE_KEY = 'mindmap-ai-guide-dismissed'

/**
 * AI 助手引导步骤工厂
 *
 * 由消费者在 `useMemo([t])` 中调用以避免每次渲染重建步骤。
 */
export function createAiGuideSteps(t: TFunction): Step[] {
  return [
    {
      target: '[data-tour="ai-button"]',
      content: (
        <div className="space-y-2">
          <div className="font-semibold">{t('mindmap.guides.aiButtonTitle')}</div>
          <div className="text-sm">{t('mindmap.guides.aiButtonDesc')}</div>
        </div>
      ),
      disableBeacon: true,
      placement: 'bottom',
      disableOverlayClose: true
    },
    {
      target: '[data-tour="ai-panel-mode-switch"]',
      content: (
        <div className="space-y-2">
          <div className="font-semibold">{t('mindmap.guides.modesTitle')}</div>
          <div className="text-sm space-y-1">
            <div>
              <strong>{t('mindmap.guides.modeAgentLabel')}</strong>
              {t('mindmap.guides.modeAgentDesc')}
            </div>
            <div>
              <strong>{t('mindmap.guides.modeGenLabel')}</strong>
              {t('mindmap.guides.modeGenDesc')}
            </div>
          </div>
        </div>
      ),
      disableBeacon: true,
      placement: 'bottom',
      disableOverlayClose: true
    },
    {
      target: '[data-tour="ai-panel-new-conversation"]',
      content: (
        <div className="space-y-2">
          <div className="font-semibold">{t('mindmap.guides.newConversationTitle')}</div>
          <div className="text-sm">
            {t('mindmap.guides.newConversationPrefix')}
            <strong>{t('mindmap.guides.newConversationButton')}</strong>
            {t('mindmap.guides.newConversationSuffix')}
          </div>
        </div>
      ),
      disableBeacon: true,
      placement: 'bottom',
      disableOverlayClose: true
    },
    {
      target: '[data-tour="ai-panel-history"]',
      content: (
        <div className="space-y-2">
          <div className="font-semibold">{t('mindmap.guides.historyTitle')}</div>
          <div className="text-sm space-y-1">
            <div>
              {t('mindmap.guides.historyPrefix')}
              <strong>{t('mindmap.guides.historyButton')}</strong>
              {t('mindmap.guides.historySuffix')}
            </div>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
              <li>{t('mindmap.guides.historyItem1')}</li>
              <li>{t('mindmap.guides.historyItem2')}</li>
              <li>{t('mindmap.guides.historyItem3')}</li>
            </ul>
          </div>
        </div>
      ),
      disableBeacon: true,
      placement: 'bottom',
      disableOverlayClose: true
    },
    {
      target: '[data-tour="ai-panel-input"]',
      content: (
        <div className="space-y-2">
          <div className="font-semibold">{t('mindmap.guides.inputTitle')}</div>
          <div className="text-sm space-y-2">
            <div>
              <strong>{t('mindmap.guides.inputFeaturesLabel')}</strong>
            </div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('mindmap.guides.inputFeature1')}</li>
              <li>{t('mindmap.guides.inputFeature2')}</li>
              <li>{t('mindmap.guides.inputFeature3')}</li>
            </ul>
            <div className="mt-2">
              <strong>{t('mindmap.guides.inputExamplesLabel')}</strong>
            </div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('mindmap.guides.inputExample1')}</li>
              <li>{t('mindmap.guides.inputExample2')}</li>
              <li>{t('mindmap.guides.inputExample3')}</li>
              <li>{t('mindmap.guides.inputExample4')}</li>
            </ul>
            <div className="mt-2">{t('mindmap.guides.inputFooter')}</div>
          </div>
        </div>
      ),
      disableBeacon: true,
      placement: 'top',
      disableOverlayClose: true
    }
  ]
}
